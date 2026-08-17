import { hasSupabaseConfig, supabase } from './supabase.js';

// Mute User (one-directional, per-user preference)
export async function muteUser(mutedUserId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to mute users.');
  }

  if (userData.user.id === mutedUserId) {
    throw new Error('You cannot mute yourself.');
  }

  const { error } = await supabase
    .from('user_mutes')
    .insert({
      muter_id: userData.user.id,
      muted_user_id: mutedUserId,
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already muted this user.');
    }
    throw error;
  }

  return { success: true };
}

export async function unmuteUser(mutedUserId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to unmute users.');
  }

  const { error } = await supabase
    .from('user_mutes')
    .delete()
    .eq('muter_id', userData.user.id)
    .eq('muted_user_id', mutedUserId);

  if (error) throw error;

  return { success: true };
}

export async function getMutedUsers() {
  if (!hasSupabaseConfig) return [];

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return [];

  const { data, error } = await supabase
    .from('user_mutes')
    .select('muted_user_id, created_at')
    .eq('muter_id', userData.user.id);

  if (error) throw error;

  return data || [];
}

export async function isUserMuted(mutedUserId) {
  if (!hasSupabaseConfig) return false;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return false;

  const { data, error } = await supabase
    .from('user_mutes')
    .select('id')
    .eq('muter_id', userData.user.id)
    .eq('muted_user_id', mutedUserId)
    .maybeSingle();

  if (error) throw error;

  return !!data;
}

// Block User (one-directional, restrictive)
export async function blockUser(blockedUserId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to block users.');
  }

  if (userData.user.id === blockedUserId) {
    throw new Error('You cannot block yourself.');
  }

  const { error } = await supabase
    .from('user_blocks')
    .insert({
      blocker_id: userData.user.id,
      blocked_user_id: blockedUserId,
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already blocked this user.');
    }
    throw error;
  }

  return { success: true };
}

export async function unblockUser(blockedUserId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to unblock users.');
  }

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', userData.user.id)
    .eq('blocked_user_id', blockedUserId);

  if (error) throw error;

  return { success: true };
}

export async function getBlockedUsers() {
  if (!hasSupabaseConfig) return [];

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return [];

  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_user_id, created_at')
    .eq('blocker_id', userData.user.id);

  if (error) throw error;

  return data || [];
}

export async function isUserBlocked(blockedUserId) {
  if (!hasSupabaseConfig) return false;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return false;

  const { data, error } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', userData.user.id)
    .eq('blocked_user_id', blockedUserId)
    .maybeSingle();

  if (error) throw error;

  return !!data;
}

// Get combined list of users to filter (both muted and blocked)
export async function getFilteredUsers() {
  if (!hasSupabaseConfig) return [];

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return [];

  const [mutedUsers, blockedUsers] = await Promise.all([
    getMutedUsers(),
    getBlockedUsers(),
  ]);

  const mutedIds = new Set(mutedUsers.map((m) => m.muted_user_id));
  const blockedIds = new Set(blockedUsers.map((b) => b.blocked_user_id));

  // Combine both sets
  const filteredIds = new Set([...mutedIds, ...blockedIds]);

  return Array.from(filteredIds);
}
