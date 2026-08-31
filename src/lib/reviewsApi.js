import { hasSupabaseConfig, supabase } from './supabase.js';
import { getProfilesByIds } from './messagesApi.js';
import { ensureOwnProfile } from './profileApi.js';

function summarizeRatings(reviews) {
  const grouped = new Map();

  for (const review of reviews ?? []) {
    const current = grouped.get(review.reviewee_id) || { total: 0, count: 0 };
    grouped.set(review.reviewee_id, {
      total: current.total + Number(review.rating),
      count: current.count + 1,
    });
  }

  return new Map([...grouped.entries()].map(([userId, value]) => [
    userId,
    {
      average: value.count ? value.total / value.count : 0,
      count: value.count,
    },
  ]));
}

export const emptyRating = { average: 0, count: 0 };

export async function getProfileRatings(userIds) {
  if (!hasSupabaseConfig) return new Map();

  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from('reviews')
    .select('reviewee_id,rating')
    .in('reviewee_id', ids);

  if (error) {
    console.warn(error);
    return new Map();
  }

  return summarizeRatings(data);
}

export async function getProfileRating(userId) {
  if (!userId) return emptyRating;

  const ratingsByUser = await getProfileRatings([userId]);
  return ratingsByUser.get(userId) || emptyRating;
}

export async function attachPosterRatings(listings) {
  const list = listings ?? [];
  const ratingsByUser = await getProfileRatings(list.map((listing) => listing.user_id));

  return list.map((listing) => ({
    ...listing,
    posterRating: ratingsByUser.get(listing.user_id) || emptyRating,
  }));
}

/**
 * Completed-order review targets for the current user on a listing.
 * Returns one entry per completed order the user hasn't reviewed yet.
 */
export async function getCompletedOrderReviewTargets({ currentUserId, listingId, orderKind }) {
  if (!hasSupabaseConfig || !currentUserId || !listingId || !orderKind) return [];

  let orderRows = [];

  if (orderKind === 'gig') {
    const { data, error } = await supabase
      .from('orders')
      .select('id, hirer_id, worker_id')
      .eq('listing_id', listingId)
      .eq('status', 'completed')
      .or(`hirer_id.eq.${currentUserId},worker_id.eq.${currentUserId}`);

    if (error) throw error;

    orderRows = (data ?? []).map((order) => ({
      orderId: order.id,
      revieweeId: order.hirer_id === currentUserId ? order.worker_id : order.hirer_id,
    }));
  } else if (orderKind === 'marketplace') {
    const { data, error } = await supabase
      .from('marketplace_orders')
      .select('id, buyer_id, seller_id')
      .eq('listing_id', listingId)
      .eq('status', 'completed')
      .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`);

    if (error) throw error;

    orderRows = (data ?? []).map((order) => ({
      orderId: order.id,
      revieweeId: order.buyer_id === currentUserId ? order.seller_id : order.buyer_id,
    }));
  }

  if (!orderRows.length) return [];

  const orderIds = orderRows.map((row) => row.orderId);
  const { data: existingReviews, error: existingError } = await supabase
    .from('reviews')
    .select('order_id')
    .eq('reviewer_id', currentUserId)
    .in('order_id', orderIds);

  if (existingError) throw existingError;

  const reviewedOrderIds = new Set((existingReviews ?? []).map((review) => review.order_id));
  const pending = orderRows.filter((row) => !reviewedOrderIds.has(row.orderId));

  if (!pending.length) return [];

  const profileIds = [...new Set(pending.map((row) => row.revieweeId))];
  const profilesById = await getProfilesByIds(profileIds);

  return pending.map((row) => ({
    orderId: row.orderId,
    revieweeId: row.revieweeId,
    name: profilesById.get(row.revieweeId) || 'PhillyGrind user',
    listingType: orderKind,
  }));
}

export async function createReview({
  listingId,
  orderId,
  listingType,
  revieweeId,
  rating,
  comment,
}) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before leaving a review.');
  }

  if (userData.user.id === revieweeId) {
    throw new Error('You cannot review yourself.');
  }

  if (!orderId || !listingType) {
    throw new Error('Reviews require a completed order.');
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      listing_id: listingId,
      order_id: orderId,
      listing_type: listingType,
      reviewer_id: userData.user.id,
      reviewee_id: revieweeId,
      rating,
      comment,
    })
    .select('id,listing_id,order_id,listing_type,reviewer_id,reviewee_id,rating,comment,created_at')
    .single();

  if (error) throw error;

  return data;
}

const PUBLIC_PROFILE_BASE = 'id,name,bio,skills,availability,neighborhood,neighborhoods,avatar_url,banner_url,profile_tags,identity_verified,created_at';

async function fetchPublicProfile(userId) {
  const selects = [
    `${PUBLIC_PROFILE_BASE},staff_title`,
    `${PUBLIC_PROFILE_BASE},neighbors_invited,staff_title`,
    `${PUBLIC_PROFILE_BASE},neighbors_invited`,
    PUBLIC_PROFILE_BASE,
  ];

  let lastError = null;
  for (const select of selects) {
    const result = await supabase
      .from('profiles_public')
      .select(select)
      .eq('id', userId)
      .maybeSingle();
    if (!result.error) return result;
    lastError = result.error;
  }

  return { data: null, error: lastError };
}

export async function getUserReviews(userId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const [profileResult, reviewsResult] = await Promise.all([
    fetchPublicProfile(userId),
    supabase
      .from('reviews')
      .select('id,listing_id,order_id,listing_type,reviewer_id,reviewee_id,rating,comment,created_at')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  let profile = profileResult.data;
  if (!profile) {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id === userId) {
      profile = await ensureOwnProfile();
    }
  }

  if (!profile) {
    throw new Error('This profile could not be loaded. Please try again.');
  }

  const data = reviewsResult.data ?? [];

  const profilesById = await getProfilesByIds([
    userId,
    ...data.map((review) => review.reviewer_id),
  ]);
  const rating = summarizeRatings(data).get(userId) || { average: 0, count: 0 };

  return {
    profileName: profile.name || profilesById.get(userId) || profile.id,
    profileCreatedAt: profile.created_at,
    profile,
    rating,
    reviews: data.map((review) => ({
      ...review,
      reviewerName: profilesById.get(review.reviewer_id) || 'PhillyGrind user',
    })),
  };
}
