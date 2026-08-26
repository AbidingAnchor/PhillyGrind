import { hasSupabaseConfig, supabase } from './supabase.js';

export const GROUP_CATEGORIES = ['Gaming', 'Hobby', 'Sports', 'Parenting', 'Neighborhood', 'Other'];

const SOLE_ADMIN_LEAVE_MESSAGE = 'You need to assign another admin before leaving this group.';

function escapeIlikeExact(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function requireAuthUser() {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('You must be logged in to manage groups.');
  }

  return data.user;
}

async function deleteOwnMembership(groupId, userId) {
  const { data, error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[groupsApi] deleteOwnMembership failed', error);
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("You're not a member of this group.");
  }

  return data;
}

export async function createGroup({ name, description, category, neighborhood }) {
  const user = await requireAuthUser();
  const trimmedName = String(name || '').trim();

  if (!trimmedName) {
    throw new Error('Group name is required.');
  }

  const payload = {
    name: trimmedName,
    description: String(description || '').trim() || null,
    category: String(category || '').trim() || null,
    neighborhood: String(neighborhood || '').trim() || null,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('groups')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.error('[groupsApi] createGroup failed', error);
    throw new Error(error.message);
  }

  return data;
}

export async function getGroup(groupId) {
  await requireAuthUser();

  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle();

  if (error) {
    console.error('[groupsApi] getGroup failed', error);
    throw new Error(error.message);
  }

  return data;
}

export async function listPublicGroups({ keyword, category, neighborhood } = {}) {
  await requireAuthUser();

  let query = supabase
    .from('groups')
    .select('*')
    .eq('privacy', 'public')
    .order('created_at', { ascending: false });

  const trimmedKeyword = String(keyword || '').trim();
  if (trimmedKeyword) {
    query = query.ilike('name', `%${trimmedKeyword}%`);
  }

  const trimmedCategory = String(category || '').trim();
  if (trimmedCategory && trimmedCategory !== 'All') {
    query = query.ilike('category', escapeIlikeExact(trimmedCategory));
  }

  const trimmedNeighborhood = String(neighborhood || '').trim();
  if (trimmedNeighborhood) {
    query = query.eq('neighborhood', trimmedNeighborhood);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[groupsApi] listPublicGroups failed', error);
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function joinGroup(groupId) {
  const user = await requireAuthUser();

  const { error: insertError } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: user.id,
      role: 'member',
    });

  if (insertError) {
    console.error('[groupsApi] joinGroup failed', insertError);
    if (insertError.code === '23505') {
      throw new Error("You're already a member of this group.");
    }
    throw new Error(insertError.message);
  }

  const { data, error: selectError } = await supabase
    .from('group_members')
    .select('id, group_id, user_id, role, joined_at')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (selectError) {
    console.error('[groupsApi] joinGroup select failed', selectError);
    throw new Error(selectError.message);
  }

  return data;
}

export async function leaveGroup(groupId) {
  const user = await requireAuthUser();

  const { data: membership, error: membershipError } = await supabase
    .from('group_members')
    .select('id, role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError) {
    console.error('[groupsApi] leaveGroup membership lookup failed', membershipError);
    throw new Error(membershipError.message);
  }

  if (!membership) {
    throw new Error("You're not a member of this group.");
  }

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('member_count')
    .eq('id', groupId)
    .single();

  if (groupError) {
    console.error('[groupsApi] leaveGroup group lookup failed', groupError);
    throw new Error(groupError.message);
  }

  const memberCount = group.member_count ?? 0;

  if (memberCount <= 1) {
    return deleteOwnMembership(groupId, user.id);
  }

  if (membership.role !== 'admin') {
    return deleteOwnMembership(groupId, user.id);
  }

  const { count: adminCount, error: adminCountError } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('role', 'admin');

  if (adminCountError) {
    console.error('[groupsApi] leaveGroup admin count failed', adminCountError);
    throw new Error(adminCountError.message);
  }

  if ((adminCount ?? 0) <= 1) {
    throw new Error(SOLE_ADMIN_LEAVE_MESSAGE);
  }

  return deleteOwnMembership(groupId, user.id);
}

export async function getMyGroups() {
  const user = await requireAuthUser();

  const { data, error } = await supabase
    .from('group_members')
    .select('role, joined_at, groups(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  if (error) {
    console.error('[groupsApi] getMyGroups failed', error);
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    role: row.role,
    joinedAt: row.joined_at,
    group: row.groups,
  }));
}

export async function isGroupMember(groupId) {
  const user = await requireAuthUser();

  const { data, error } = await supabase
    .from('group_members')
    .select('id, role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[groupsApi] isGroupMember failed', error);
    throw new Error(error.message);
  }

  return {
    isMember: Boolean(data),
    role: data?.role ?? null,
  };
}
