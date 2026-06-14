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

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Admin request failed.');
  }
  return payload;
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

export async function adminDeleteListing(listingId, listingType) {
  return listingRequest('admin-delete-listing', {
    listing_id: listingId,
    listing_type: listingType,
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
