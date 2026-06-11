import { hasSupabaseConfig, supabase } from './supabase.js';
import { getProfilesByIds } from './messagesApi.js';

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

export async function getExistingReview({ listingId, reviewerId }) {
  if (!hasSupabaseConfig || !reviewerId) return null;

  const { data, error } = await supabase
    .from('reviews')
    .select('id')
    .eq('listing_id', listingId)
    .eq('reviewer_id', reviewerId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function getReviewTargets({ currentUserId, listing }) {
  if (!hasSupabaseConfig || !currentUserId || !listing?.user_id) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('sender_id,receiver_id')
    .eq('listing_id', listing.id);

  if (error) {
    console.warn(error);
    return [];
  }

  if (currentUserId !== listing.user_id) {
    const hasMessagedPoster = (data ?? []).some((message) => {
      const participants = [message.sender_id, message.receiver_id];
      return participants.includes(currentUserId) && participants.includes(listing.user_id);
    });

    if (!hasMessagedPoster) return [];

    const profilesById = await getProfilesByIds([listing.user_id]);

    return [{
      id: listing.user_id,
      name: profilesById.get(listing.user_id) || listing.posterName || 'PhillyGrind user',
    }];
  }

  const participantIds = [...new Set((data ?? [])
    .flatMap((message) => [message.sender_id, message.receiver_id])
    .filter((userId) => userId && userId !== currentUserId))];
  const profilesById = await getProfilesByIds(participantIds);

  return participantIds.map((userId) => ({
    id: userId,
    name: profilesById.get(userId) || 'PhillyGrind user',
  }));
}

export async function createReview({ listingId, revieweeId, rating, comment }) {
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

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      listing_id: listingId,
      reviewer_id: userData.user.id,
      reviewee_id: revieweeId,
      rating,
      comment,
    })
    .select('id,listing_id,reviewer_id,reviewee_id,rating,comment,created_at')
    .single();

  if (error) throw error;

  return data;
}

export async function getUserReviews(userId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const [profileResult, reviewsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,name,bio,skills,availability,neighborhoods,resume_path,avatar_url,created_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('reviews')
      .select('id,listing_id,reviewer_id,reviewee_id,rating,comment,created_at')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  const data = reviewsResult.data ?? [];

  const profilesById = await getProfilesByIds([
    userId,
    ...data.map((review) => review.reviewer_id),
  ]);
  const rating = summarizeRatings(data).get(userId) || { average: 0, count: 0 };

  return {
    profileName: profileResult.data?.name || profilesById.get(userId) || 'PhillyGrind user',
    profileCreatedAt: profileResult.data?.created_at,
    profile: profileResult.data,
    rating,
    reviews: data.map((review) => ({
      ...review,
      reviewerName: profilesById.get(review.reviewer_id) || 'PhillyGrind user',
    })),
  };
}
