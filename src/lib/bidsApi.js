import { hasSupabaseConfig, supabase } from './supabase.js';
import { emptyRating, getProfileRatings } from './reviewsApi.js';

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

async function attachWorkerProfiles(bids) {
  const workerIds = [...new Set((bids ?? []).map((bid) => bid.worker_id).filter(Boolean))];
  if (!workerIds.length) return bids ?? [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,stripe_account_id,stripe_onboarding_complete')
    .in('id', workerIds);

  if (error) throw error;

  const profilesById = new Map((data ?? []).map((profile) => [profile.id, profile]));
  return (bids ?? []).map((bid) => ({
    ...bid,
    workerName: profilesById.get(bid.worker_id)?.name || 'PhillyGrind user',
    workerStripeAccountId: profilesById.get(bid.worker_id)?.stripe_account_id || '',
    workerStripeOnboardingComplete: Boolean(profilesById.get(bid.worker_id)?.stripe_onboarding_complete),
    workerStripeReady: Boolean(
      profilesById.get(bid.worker_id)?.stripe_account_id
      && profilesById.get(bid.worker_id)?.stripe_onboarding_complete,
    ),
  }));
}

async function attachWorkerRatings(bids) {
  const workerIds = [...new Set((bids ?? []).map((bid) => bid.worker_id).filter(Boolean))];
  if (!workerIds.length) return bids ?? [];

  const ratingsByUser = await getProfileRatings(workerIds);
  return (bids ?? []).map((bid) => ({
    ...bid,
    workerRating: ratingsByUser.get(bid.worker_id) || emptyRating,
  }));
}

export async function getBidsForListing(listingId) {
  if (!hasSupabaseConfig || !listingId) return [];

  const { data, error } = await supabase
    .from('bids')
    .select('id,listing_id,worker_id,pitch,status,created_at')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const bidsWithProfiles = await attachWorkerProfiles(data ?? []);
  return attachWorkerRatings(bidsWithProfiles);
}

export async function getMyBids() {
  if (!hasSupabaseConfig) return [];

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in first.');
  }

  const { data, error } = await supabase
    .from('bids')
    .select('id,listing_id,worker_id,pitch,status,created_at')
    .eq('worker_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const listingIds = [...new Set(data.map((bid) => bid.listing_id))];
  const { data: gigs, error: gigsError } = await supabase
    .from('gigs')
    .select('id,title,category,neighborhood,status')
    .in('id', listingIds);

  if (gigsError) throw gigsError;

  const gigsById = Object.fromEntries((gigs ?? []).map((gig) => [gig.id, gig]));
  return data.map((bid) => ({
    ...bid,
    listing: gigsById[bid.listing_id],
  }));
}

export async function submitBid({ listingId, pitch }) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before submitting a bid.');
  }

  const { data, error } = await supabase
    .from('bids')
    .insert({
      listing_id: listingId,
      worker_id: userData.user.id,
      pitch,
      status: 'pending',
    })
    .select('id,listing_id,worker_id,pitch,status,created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('You already submitted a bid for this gig.');
    }

    throw error;
  }

  return data;
}

export async function updateBidStatus({ bidId, status }) {
  const token = await getAccessToken();
  const response = await fetch('/api/update-bid-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bid_id: bidId, status }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Could not update bid.');
  }

  return payload;
}
