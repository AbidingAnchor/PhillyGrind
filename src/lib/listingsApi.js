import { fallbackGigs, fallbackJobs } from '../data/listings.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { attachPosterRatings, getProfileRating, getProfileRatings } from './reviewsApi.js';

const tableFor = (type) => (type === 'gig' ? 'gigs' : 'jobs');
const fallbackFor = (type) => (type === 'gig' ? fallbackGigs : fallbackJobs);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeDisplayName(value, fallback = 'PhillyGrind user') {
  const trimmed = String(value || '').trim();
  if (!trimmed || emailPattern.test(trimmed)) return fallback;
  return trimmed;
}

function normalizeListing(item, type) {
  const boostExpired = item.boost_expires_at && new Date(item.boost_expires_at) <= new Date();
  return {
    ...item,
    type,
    is_boosted: Boolean(item.is_boosted && !boostExpired),
    boost_tier: item.is_boosted && !boostExpired ? item.boost_tier : null,
    boost_expires_at: item.is_boosted && !boostExpired ? item.boost_expires_at : null,
    pendingBoostTier: item.boost_pending ? item.boost_tier : null,
    boost_pending: Boolean(item.boost_pending),
    post_type: type === 'gig' ? item.post_type || 'seeking' : item.post_type,
  };
}

function boostRank(listing) {
  if (!listing.is_boosted) return 0;
  if (listing.boost_tier === 'pro') return 2;
  if (listing.boost_tier === 'basic') return 1;
  return 0;
}

function sortListings(listings) {
  return [...(listings ?? [])].sort((a, b) => {
    const boostDelta = boostRank(b) - boostRank(a);
    if (boostDelta) return boostDelta;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}

let boostExpiryCheckedAt = 0;

async function expireBoostsIfNeeded() {
  if (!hasSupabaseConfig) return;

  const now = Date.now();
  if (now - boostExpiryCheckedAt < 60_000) return;
  boostExpiryCheckedAt = now;

  try {
    const response = await fetch('/api/orders?action=expire-boosts', { method: 'POST' });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Could not expire boosts.');
    }
  } catch (error) {
    console.warn(error);
  }
}

function normalizePayload(type, listing) {
  const nextListing = { ...listing };

  if (type === 'job') {
    nextListing.apply_url = nextListing.apply_url?.trim() || null;
  } else {
    delete nextListing.apply_url;
  }

  return nextListing;
}

async function attachPosterNames(listings) {
  const list = listings ?? [];
  if (!hasSupabaseConfig || !list.length) {
    return list.map((listing) => ({
      ...listing,
      posterName: safeDisplayName(listing.company, 'PhillyGrind user'),
    }));
  }

  const userIds = [...new Set(list.map((listing) => listing.user_id).filter(Boolean))];
  if (!userIds.length) {
    return list.map((listing) => ({
      ...listing,
      posterName: safeDisplayName(listing.company, 'PhillyGrind user'),
    }));
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id,name')
    .in('id', userIds);

  if (error) throw error;

  const namesById = Object.fromEntries((data ?? []).map((profile) => [profile.id, profile.name]));
  return list.map((listing) => ({
    ...listing,
    posterName: safeDisplayName(namesById[listing.user_id] || listing.company, 'PhillyGrind user'),
  }));
}

async function attachBidCounts(listings) {
  const list = listings ?? [];
  const gigIds = [...new Set(list
    .filter((listing) => listing.type === 'gig')
    .map((listing) => listing.id)
    .filter(Boolean))];

  if (!hasSupabaseConfig || !gigIds.length) {
    return list.map((listing) => ({
      ...listing,
      bidCount: listing.type === 'gig' ? Number(listing.bidCount || 0) : listing.bidCount,
    }));
  }

  let countsByListingId = {};
  try {
    const response = await fetch('/api/bid-counts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ listing_ids: gigIds }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Could not load bid counts.');
    }

    countsByListingId = payload.counts || {};
  } catch (error) {
    console.warn(error);
  }

  return list.map((listing) => ({
    ...listing,
    bidCount: listing.type === 'gig' ? countsByListingId[listing.id] || 0 : listing.bidCount,
  }));
}

function filterFallbackListings(listings, type, { keyword = '', category = 'All', neighborhood = '', postType = 'All' } = {}) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const normalizedNeighborhood = neighborhood.trim().toLowerCase();

  return listings.filter((listing) => {
    const normalizedListing = normalizeListing(listing, type);
    const matchesKeyword = !normalizedKeyword
      || listing.title.toLowerCase().includes(normalizedKeyword)
      || listing.description.toLowerCase().includes(normalizedKeyword);
    const matchesCategory = category === 'All' || listing.category === category;
    const matchesNeighborhood = !normalizedNeighborhood
      || listing.neighborhood.toLowerCase().includes(normalizedNeighborhood);
    const matchesPostType = type !== 'gig' || postType === 'All' || normalizedListing.post_type === postType;

    return matchesKeyword && matchesCategory && matchesNeighborhood && matchesPostType;
  });
}

async function getAccessToken() {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Please log in first.');
  }

  return data.session.access_token;
}

async function hasBlockingOrder(listingId) {
  const { data, error } = await supabase
    .from('orders')
    .select('id,status')
    .eq('listing_id', listingId)
    .neq('status', 'cancelled')
    .limit(1);

  if (error) throw error;

  return Boolean(data?.length);
}

async function removeListingsWithActiveOrders(listings) {
  const list = listings ?? [];
  const listingIds = list.map((listing) => listing.id).filter(Boolean);

  if (!hasSupabaseConfig || !listingIds.length) return list;

  try {
    const response = await fetch('/api/unavailable-listings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ listing_ids: listingIds }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Could not check listing availability.');
    }

    const unavailableIds = new Set(payload.unavailableListingIds || []);
    return list.filter((listing) => !unavailableIds.has(listing.id));
  } catch (error) {
    console.warn(error);
    return list;
  }
}

export async function getListings(type, filters = {}) {
  if (!hasSupabaseConfig) {
    return sortListings(filterFallbackListings(fallbackFor(type), type, filters));
  }

  await expireBoostsIfNeeded();

  const { keyword = '', category = 'All', neighborhood = '', postType = 'All' } = filters;
  let query = supabase
    .from(tableFor(type))
    .select('*')
    .eq('boost_pending', false)
    .order('created_at', { ascending: false });

  if (type === 'gig') {
    query = query.eq('status', 'open');
  }

  if (category && category !== 'All') {
    query = query.eq('category', category);
  }

  if (neighborhood.trim()) {
    query = query.ilike('neighborhood', `%${neighborhood.trim()}%`);
  }

  if (type === 'gig' && postType && postType !== 'All') {
    query = query.eq('post_type', postType);
  }

  if (keyword.trim()) {
    const escapedKeyword = keyword.trim().replaceAll('%', '\\%').replaceAll('_', '\\_');
    query = query.or(`title.ilike.%${escapedKeyword}%,description.ilike.%${escapedKeyword}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const listings = type === 'job'
    ? await removeListingsWithActiveOrders(data?.map((item) => normalizeListing(item, type)) ?? [])
    : data?.map((item) => normalizeListing(item, type)) ?? [];
  return sortListings(await attachPosterRatings(await attachBidCounts(await attachPosterNames(listings))));
}

export async function getListing(type, id) {
  if (!hasSupabaseConfig) {
    return fallbackFor(type).find((listing) => listing.id === id);
  }

  await expireBoostsIfNeeded();

  if (!uuidPattern.test(id)) {
    return undefined;
  }

  const { data, error } = await supabase
    .from(tableFor(type))
    .select(type === 'gig'
      ? 'id,user_id,post_type,status,title,company,contact,category,neighborhood,pay,description,is_boosted,boost_tier,boost_expires_at,boost_pending,created_at'
      : 'id,user_id,title,company,contact,category,neighborhood,pay,description,apply_url,is_boosted,boost_tier,boost_expires_at,boost_pending,created_at')
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  if (!data) return undefined;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('name,stripe_account_id,stripe_onboarding_complete')
    .eq('id', data.user_id)
    .maybeSingle();

  if (profileError) {
    console.warn(profileError);
  }

  const [posterRating, listingWithBidCount] = await Promise.all([
    getProfileRating(data.user_id),
    attachBidCounts([normalizeListing(data, type)]),
  ]);

  return {
    ...normalizeListing(data, type),
    bidCount: listingWithBidCount[0]?.bidCount || 0,
    posterName: safeDisplayName(profile?.name || data.company, 'PhillyGrind user'),
    workerStripeAccountId: profile?.stripe_account_id || '',
    workerStripeOnboardingComplete: Boolean(profile?.stripe_onboarding_complete),
    workerStripeReady: Boolean(profile?.stripe_account_id && profile?.stripe_onboarding_complete),
    posterRating,
  };
}

export async function getFeaturedWorkers(limit = 4) {
  if (!hasSupabaseConfig) return [];

  await expireBoostsIfNeeded();

  const { data: gigs, error } = await supabase
    .from('gigs')
    .select('id,user_id,title,category,neighborhood,pay,description,company,created_at,is_boosted,boost_tier,boost_expires_at,boost_pending')
    .eq('is_boosted', true)
    .eq('boost_tier', 'pro')
    .eq('boost_pending', false)
    .eq('post_type', 'offering')
    .eq('status', 'open')
    .gt('boost_expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const listings = (gigs ?? []).map((gig) => normalizeListing(gig, 'gig'));
  const userIds = [...new Set(listings.map((listing) => listing.user_id).filter(Boolean))];

  if (!userIds.length) return [];

  const [{ data: profiles, error: profileError }, ratingsByUser] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,name,avatar_url')
      .in('id', userIds),
    getProfileRatings(userIds),
  ]);

  if (profileError) throw profileError;

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return listings.map((listing) => {
    const profile = profilesById.get(listing.user_id);
    return {
      ...listing,
      posterName: safeDisplayName(profile?.name || listing.company, 'PhillyGrind user'),
      posterAvatarUrl: profile?.avatar_url || '',
      posterRating: ratingsByUser.get(listing.user_id) || { average: 0, count: 0 },
    };
  });
}

export async function getUserListings(userId) {
  if (!hasSupabaseConfig || !userId) {
    return [];
  }

  await expireBoostsIfNeeded();

  const [jobsResult, gigsResult] = await Promise.all([
    supabase
      .from('jobs')
      .select('id,user_id,title,company,category,neighborhood,pay,description,apply_url,is_boosted,boost_tier,boost_expires_at,boost_pending,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('gigs')
      .select('id,user_id,post_type,title,company,category,neighborhood,pay,description,is_boosted,boost_tier,boost_expires_at,boost_pending,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (jobsResult.error) throw jobsResult.error;
  if (gigsResult.error) throw gigsResult.error;

  const listings = [
    ...(jobsResult.data ?? []).map((job) => normalizeListing(job, 'job')),
    ...(gigsResult.data ?? []).map((gig) => normalizeListing(gig, 'gig')),
  ];

  return sortListings(await attachPosterRatings(await attachBidCounts(await attachPosterNames(listings))));
}

export async function createListing(type, listing, options = {}) {
  const payload = normalizePayload(type, listing);
  const boostTier = ['basic', 'pro'].includes(options.boostTier) ? options.boostTier : null;
  const boostFields = boostTier
    ? {
      is_boosted: false,
      boost_tier: boostTier,
      boost_expires_at: null,
      boost_pending: true,
    }
    : {};

  if (!hasSupabaseConfig) {
    return { ...payload, ...boostFields, id: crypto.randomUUID(), type };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error('You must be logged in to post a listing.');
  }

  const { data, error } = await supabase
    .from(tableFor(type))
    .insert({ ...payload, ...boostFields, user_id: userData.user.id })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return { ...data, type };
}

export async function setListingBoostPending(type, id, boostPending) {
  if (!hasSupabaseConfig) {
    return { id, type, boost_pending: Boolean(boostPending) };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error('You must be logged in to update this listing.');
  }

  const payload = boostPending
    ? { boost_pending: true, is_boosted: false, boost_expires_at: null }
    : { boost_pending: false, is_boosted: false, boost_tier: null, boost_expires_at: null };

  const { data, error } = await supabase
    .from(tableFor(type))
    .update(payload)
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return { ...data, type };
}

export async function updateListing(type, id, listing) {
  const payload = normalizePayload(type, listing);

  if (!hasSupabaseConfig) {
    return { ...payload, id, type };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error('You must be logged in to edit a listing.');
  }

  const { data, error } = await supabase
    .from(tableFor(type))
    .update(payload)
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return { ...data, type };
}

export async function deleteListing(type, id) {
  if (!hasSupabaseConfig) {
    return;
  }

  if (await hasBlockingOrder(id)) {
    throw new Error('This listing cannot be deleted because it has an active or completed order.');
  }

  const token = await getAccessToken();
  const response = await fetch('/api/delete-listing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      listing_id: id,
      listing_type: type,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Could not delete this ${type}.`);
  }
}
