import { fallbackMarketplace } from '../data/listings.js';
import { hasSupabaseConfig, supabase } from './supabase.js';
import { createListingWithModeration } from './adminApi.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeDisplayName(value, fallback = 'PhillyGrind user') {
  const trimmed = String(value || '').trim();
  if (!trimmed || emailPattern.test(trimmed)) return fallback;
  return trimmed;
}

function normalizeItem(item) {
  return {
    ...item,
    type: 'marketplace',
    pay: item.price,
    photo_urls: item.photo_urls ?? [],
  };
}

function filterFallbackListings(listings, { keyword = '', category = 'All', condition = 'All', location = '' } = {}) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const normalizedLocation = location.trim().toLowerCase();

  return listings.filter((listing) => {
    const matchesKeyword = !normalizedKeyword
      || listing.title.toLowerCase().includes(normalizedKeyword)
      || listing.description.toLowerCase().includes(normalizedKeyword);
    const matchesCategory = category === 'All' || listing.category === category;
    const matchesCondition = condition === 'All' || listing.condition === condition;
    const matchesLocation = !normalizedLocation
      || listing.location.toLowerCase().includes(normalizedLocation);

    return matchesKeyword && matchesCategory && matchesCondition && matchesLocation && listing.status === 'active';
  });
}

async function attachSellerInfo(listings) {
  const list = listings ?? [];
  if (!hasSupabaseConfig || !list.length) {
    return list.map((listing) => ({
      ...listing,
      sellerName: safeDisplayName(listing.sellerName, 'PhillyGrind user'),
      posterName: safeDisplayName(listing.sellerName, 'PhillyGrind user'),
    }));
  }

  const userIds = [...new Set(list.map((listing) => listing.user_id).filter(Boolean))];
  if (!userIds.length) return list;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,stripe_account_id,stripe_onboarding_complete')
    .in('id', userIds);

  if (error) throw error;

  const profilesById = Object.fromEntries((data ?? []).map((profile) => [profile.id, profile]));
  return list.map((listing) => {
    const profile = profilesById[listing.user_id];
    const sellerName = safeDisplayName(profile?.name || listing.sellerName, 'PhillyGrind user');
    return {
      ...listing,
      sellerName,
      posterName: sellerName,
      workerStripeAccountId: profile?.stripe_account_id || '',
      workerStripeOnboardingComplete: Boolean(profile?.stripe_onboarding_complete),
      workerStripeReady: Boolean(profile?.stripe_account_id && profile?.stripe_onboarding_complete),
    };
  });
}

export async function getMarketplaceListings(filters = {}) {
  if (!hasSupabaseConfig) {
    return filterFallbackListings(fallbackMarketplace.map(normalizeItem), filters);
  }

  const { keyword = '', category = 'All', condition = 'All', location = '' } = filters;
  let query = supabase
    .from('marketplace_listings')
    .select('*')
    .eq('status', 'active')
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false });

  if (category && category !== 'All') {
    query = query.eq('category', category);
  }

  if (condition && condition !== 'All') {
    query = query.eq('condition', condition);
  }

  if (location.trim()) {
    query = query.ilike('location', `%${location.trim()}%`);
  }

  if (keyword.trim()) {
    const escapedKeyword = keyword.trim().replaceAll('%', '\\%').replaceAll('_', '\\_');
    query = query.or(`title.ilike.%${escapedKeyword}%,description.ilike.%${escapedKeyword}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const listings = (data ?? []).map(normalizeItem);
  return attachSellerInfo(listings);
}

export async function getMarketplaceListing(id) {
  if (!hasSupabaseConfig) {
    const listing = fallbackMarketplace.find((item) => item.id === id);
    return listing ? normalizeItem(listing) : undefined;
  }

  if (!uuidPattern.test(id)) return undefined;

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) return undefined;

  const [listing] = await attachSellerInfo([normalizeItem(data)]);
  return listing;
}

export async function uploadMarketplacePhoto(file, listingId, index) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before uploading photos.');
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Photos must be JPG, PNG, or WebP.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Each photo must be 10MB or smaller.');
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userData.user.id}/${listingId}/${index}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('marketplace-photos')
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage
    .from('marketplace-photos')
    .getPublicUrl(path);

  return publicData.publicUrl;
}

export async function createMarketplaceListing(listing, photoFiles = []) {
  const payload = {
    title: listing.title.trim(),
    description: listing.description.trim(),
    price: parseFloat(listing.price) || 0,
    category: listing.category,
    condition: listing.condition,
    location: listing.location.trim(),
    payment_type: listing.payment_type || 'both',
    status: 'active',
    photos: [],
  };

  if (!hasSupabaseConfig) {
    return {
      ...payload,
      id: crypto.randomUUID(),
      type: 'marketplace',
      user_id: 'demo-user',
      sellerName: 'You',
      photos: photoFiles.length
        ? [URL.createObjectURL(photoFiles[0])]
        : ['https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop'],
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to post a listing.');
  }

  const { listing: data } = await createListingWithModeration('marketplace', {
    title: payload.title,
    description: payload.description,
    price: payload.price,
    category: payload.category,
    condition: payload.condition,
    location: payload.location,
    payment_type: payload.payment_type,
  });

  if (photoFiles.length) {
    const photoUrls = await Promise.all(
      photoFiles.map((file, index) => uploadMarketplacePhoto(file, data.id, index)),
    );

    const { data: updated, error: updateError } = await supabase
      .from('marketplace_listings')
      .update({ photos: photoUrls })
      .eq('id', data.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return normalizeItem(updated);
  }

  return normalizeItem(data);
}
