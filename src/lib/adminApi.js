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
  const response = await fetch(`/api/listing-actions?action=${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
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

export async function getAdminDisputes() {
  return adminRequest('admin-disputes', { method: 'GET' });
}

export async function suspendUser(userId, reason, expiresAt = null) {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) throw new Error('Not authenticated');

  // Insert or update suspension record
  const { error: suspendError } = await supabase
    .from('suspended_users')
    .upsert({
      user_id: userId,
      suspension_type: 'suspend',
      action_type: 'suspend', // Backward compatibility with existing schema
      reason,
      expires_at: expiresAt,
      suspended_by: currentUser.user.id, // Backward compatibility with existing schema
    }, {
      onConflict: 'user_id'
    });

  if (suspendError) throw new Error(suspendError.message);

  // Log to admin_action_log
  const { error: logError } = await supabase
    .from('admin_action_log')
    .insert({
      admin_id: currentUser.user.id,
      target_user_id: userId,
      action_type: 'suspend',
      reason,
      metadata: { expires_at: expiresAt },
    });

  if (logError) throw new Error(logError.message);

  // Invalidate user's session using correct Admin API method
  try {
    await supabase.auth.admin.signOut(userId, 'global');
    console.log(`[Admin] Successfully signed out user ${userId}`);
  } catch (signOutError) {
    console.error(`[Admin] Failed to sign out user ${userId}:`, signOutError);
    // Don't throw - suspension/ban should still succeed even if session kill fails
  }

  return { success: true };
}

export async function banUser(userId, reason) {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) throw new Error('Not authenticated');

  // Insert or update ban record (permanent, no expiry)
  const { error: banError } = await supabase
    .from('suspended_users')
    .upsert({
      user_id: userId,
      suspension_type: 'ban',
      action_type: 'banned', // Backward compatibility with existing schema
      reason,
      expires_at: null,
      suspended_by: currentUser.user.id, // Backward compatibility with existing schema
    }, {
      onConflict: 'user_id'
    });

  if (banError) throw new Error(banError.message);

  // Log to admin_action_log
  const { error: logError } = await supabase
    .from('admin_action_log')
    .insert({
      admin_id: currentUser.user.id,
      target_user_id: userId,
      action_type: 'ban',
      reason,
    });

  if (logError) throw new Error(logError.message);

  // Invalidate user's session using correct Admin API method
  try {
    await supabase.auth.admin.signOut(userId, 'global');
    console.log(`[Admin] Successfully signed out user ${userId}`);
  } catch (signOutError) {
    console.error(`[Admin] Failed to sign out user ${userId}:`, signOutError);
    // Don't throw - suspension/ban should still succeed even if session kill fails
  }

  return { success: true };
}

export async function ipBanUser(userId, reason) {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) throw new Error('Not authenticated');

  // Get user's last known IP
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('last_known_ip')
    .eq('id', userId)
    .single();

  if (profileError) throw new Error(profileError.message);
  if (!profile?.last_known_ip) {
    // If no IP on record, still ban the user but skip IP ban
    console.warn('User has no IP address on record, skipping IP ban');
  } else {
    // Add IP to banned_ips table
    const { error: ipError } = await supabase
      .from('banned_ips')
      .insert({
        ip_address: profile.last_known_ip,
        reason,
        created_by: currentUser.user.id,
      });

    if (ipError) throw new Error(ipError.message);
  }

  // Insert ban record
  const { error: banError } = await supabase
    .from('suspended_users')
    .upsert({
      user_id: userId,
      suspension_type: 'ban',
      reason,
      expires_at: null,
    }, {
      onConflict: 'user_id'
    });

  if (banError) throw new Error(banError.message);

  // Log to admin_action_log
  const { error: logError } = await supabase
    .from('admin_action_log')
    .insert({
      admin_id: currentUser.user.id,
      target_user_id: userId,
      action_type: 'ip_ban',
      reason,
      metadata: { ip_address: profile?.last_known_ip },
    });

  if (logError) throw new Error(logError.message);

  // Invalidate user's session using correct Admin API method
  try {
    await supabase.auth.admin.signOut(userId, 'global');
    console.log(`[Admin] Successfully signed out user ${userId}`);
  } catch (signOutError) {
    console.error(`[Admin] Failed to sign out user ${userId}:`, signOutError);
    // Don't throw - suspension/ban should still succeed even if session kill fails
  }

  return { success: true };
}

export async function liftSuspension(userId) {
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) throw new Error('Not authenticated');

  // Delete suspension record
  const { error } = await supabase
    .from('suspended_users')
    .delete()
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  // Log to admin_action_log
  const { error: logError } = await supabase
    .from('admin_action_log')
    .insert({
      admin_id: currentUser.user.id,
      target_user_id: userId,
      action_type: 'lift_suspension',
    });

  if (logError) throw new Error(logError.message);

  return { success: true };
}

export async function getUserSuspensionStatus(userId) {
  const { data, error } = await supabase
    .from('suspended_users')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;

  // Check if suspension is active (not lifted and not expired)
  if (data) {
    const isLifted = data.lifted_at !== null;
    const isExpired = data.expires_at !== null && new Date(data.expires_at) < new Date();
    
    if (isLifted || isExpired) {
      return null; // Suspension is not active
    }
    
    return data;
  }

  return null;
}

export async function checkUserSuspension(userId) {
  const { data, error } = await supabase
    .from('suspended_users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  if (!data) return null;

  // Check if suspension has expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    // Auto-lift expired suspension
    await supabase
      .from('suspended_users')
      .delete()
      .eq('user_id', userId);
    return null;
  }

  return data;
}

export async function checkIPBan(ipAddress) {
  const { data, error } = await supabase
    .from('banned_ips')
    .select('*')
    .eq('ip_address', ipAddress)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  return data;
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
    .select('*')
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

export async function clearAgeConcern(userId, contentId, contentType) {
  // Restore the hidden content
  if (contentType === 'community_post') {
    const { error } = await supabase
      .from('community_posts')
      .update({ hidden: false, hidden_reason: null })
      .eq('id', contentId);
    if (error) throw new Error(error.message);
  } else if (contentType === 'community_comment') {
    const { error } = await supabase
      .from('community_comments')
      .update({ hidden: false, hidden_reason: null })
      .eq('id', contentId);
    if (error) throw new Error(error.message);
  }

  // Update profile age flag status
  const { data, error } = await supabase
    .from('profiles')
    .update({ 
      age_flag_status: 'reviewed_cleared',
      age_flag_content_id: null 
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function confirmMinorUser(userId, contentId, contentType) {
  // Log the action to admin_action_log
  const { data: currentUser } = await supabase.auth.getUser();
  if (!currentUser?.user) throw new Error('Not authenticated');

  const { error: logError } = await supabase
    .from('admin_action_log')
    .insert({
      admin_id: currentUser.user.id,
      target_user_id: userId,
      action_type: 'ban',
      reason: 'coppa_minor_confirmed',
      metadata: { content_id: contentId, content_type: contentType },
    });

  if (logError) throw new Error(logError.message);

  // Delete user's personal data (profile fields, photos, bio)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      bio: null,
      avatar_url: null,
      banner_url: null,
      resume_url: null,
      resume_path: null,
      skills: '{}',
      neighborhoods: '{}',
      neighborhood: null,
      availability: null,
      profile_tags: '{}',
      age_flag_status: 'reviewed_confirmed_minor',
      age_flag_content_id: null,
    })
    .eq('id', userId);

  if (profileError) throw new Error(profileError.message);

  // Suspend/deactivate the account using existing suspend logic
  await suspendUser(userId, 'COPPA minor confirmed - account deactivated', 'banned');

  return { success: true };
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
