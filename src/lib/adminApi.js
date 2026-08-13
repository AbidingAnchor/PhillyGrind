import { supabase } from './supabase.js';

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Please log in first.');
  }
  return data.session.access_token;
}

async function adminRequest(action, { method = 'GET', body, query = {} } = {}) {
  const token = await getAccessToken();
  const params = new URLSearchParams({ action, ...query });
  const response = await fetch(`/api/orders?${params}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const payload = JSON.parse(text);
      throw new Error(payload.error || 'Admin request failed.');
    } catch {
      throw new Error(text || `Admin request failed (${response.status})`);
    }
  }

  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function listingRequest(action, body) {
  const token = await getAccessToken();
  const response = await fetch(`/api/delete-listing?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Listing request failed.');
  }
  return payload;
}

export async function getAdminOverview() {
  return adminRequest('admin-overview', { method: 'GET' });
}

export async function getAdminUsers() {
  return adminRequest('admin-users', { method: 'GET' });
}

export async function getAdminListings({ type = 'all', status = 'all' } = {}) {
  return adminRequest('admin-listings', { method: 'GET', query: { type, status } });
}

export async function getAdminReports(status = 'pending') {
  return adminRequest('admin-reports', { method: 'GET', query: { status } });
}

export async function suspendUser(userId, reason, actionType = 'suspended') {
  return adminRequest('admin-suspend-user', {
    method: 'POST',
    body: { user_id: userId, reason, action_type: actionType },
  });
}

export async function liftSuspension(userId) {
  return adminRequest('admin-lift-suspension', {
    method: 'POST',
    body: { user_id: userId },
  });
}

export async function adminReportAction(reportId, action, warnMessage) {
  return adminRequest('admin-report-action', {
    method: 'POST',
    body: { report_id: reportId, action, warn_message: warnMessage },
  });
}

export async function getModerationLogs({ category = 'all', status = 'all', reviewed = 'all' } = {}) {
  const { data, error } = await supabase
    .from('moderation_logs')
    .select(`
      *,
      profiles:user_id (
        name,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  let filtered = data ?? [];

  if (category !== 'all') {
    filtered = filtered.filter(log => log.category === category);
  }

  if (status !== 'all') {
    filtered = filtered.filter(log => log.status === status);
  }

  if (reviewed !== 'all') {
    filtered = filtered.filter(log => log.reviewed === (reviewed === 'reviewed'));
  }

  return { logs: filtered };
}

export async function markModerationLogReviewed(logId) {
  const { data, error } = await supabase
    .from('moderation_logs')
    .update({ reviewed: true })
    .eq('id', logId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getUnreviewedModerationCount() {
  const { count, error } = await supabase
    .from('moderation_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'flagged_for_review')
    .eq('reviewed', false);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function adminDeleteListing(listingId, listingType) {
  return listingRequest('admin-delete-listing', {
    listing_id: listingId,
    listing_type: listingType,
  });
}

export async function getAdminHousing() {
  return adminRequest('admin-housing', { method: 'GET' });
}

export async function adminDeactivateHousing(listingId) {
  return adminRequest('admin-deactivate-housing', {
    method: 'POST',
    body: { listing_id: listingId },
  });
}

export async function adminVerifyLandlord(userId) {
  return adminRequest('admin-verify-landlord', {
    method: 'POST',
    body: { user_id: userId },
  });
}

export async function getAdminCommunityPosts() {
  return adminRequest('admin-community-posts', { method: 'GET' });
}

export async function adminDeleteCommunityPost(postId) {
  return adminRequest('admin-delete-community-post', {
    method: 'POST',
    body: { post_id: postId },
  });
}

export async function adminDismissCommunityReport(reportId) {
  return adminRequest('admin-dismiss-community-report', {
    method: 'POST',
    body: { report_id: reportId },
  });
}

export async function createListingWithModeration(listingType, listing, options = {}) {
  return listingRequest('create-listing', {
    listing_type: listingType,
    listing,
    boost_tier: options.boostTier,
  });
}

export const ADMIN_EMAIL = 'drewnegron95@gmail.com';

export function isAdminUser(user) {
  return String(user?.email || '').toLowerCase() === ADMIN_EMAIL;
}
