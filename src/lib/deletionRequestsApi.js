import { supabase } from './supabase.js';

function uniqueViolation(error) {
  return error?.code === '23505';
}

export async function requestAccountDeletion() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (sessionError || !user) {
    throw new Error('Please log in first.');
  }

  const { error } = await supabase.from('deletion_requests').insert({
    user_id: user.id,
    requested_at: new Date().toISOString(),
    status: 'pending',
  });

  if (error && !uniqueViolation(error)) {
    throw new Error(error.message || 'Could not submit deletion request.');
  }
}

export async function cancelPendingDeletionRequest() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (sessionError || !user) return false;

  try {
    const query = supabase
      .from('deletion_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .select('id');

    const { data, error } = await Promise.race([
      query,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('Deletion-request cancel timed out')), 2500);
      }),
    ]);

    if (error) {
      console.warn('[deletionRequests] Could not cancel pending request', error);
      return false;
    }
    return Boolean(data?.length);
  } catch (error) {
    console.warn('[deletionRequests] Could not cancel pending request', error);
    return false;
  }
}

export async function getDeletionRequests(status = 'all') {
  let query = supabase
    .from('deletion_requests')
    .select('id, user_id, requested_at, status, processed_at, cancelled_at, profiles(id, name, email)')
    .order('requested_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPendingDeletionRequestCount() {
  const { count, error } = await supabase
    .from('deletion_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
  return count || 0;
}

export async function markDeletionRequestProcessed(id) {
  const { data, error } = await supabase
    .from('deletion_requests')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, user_id, requested_at, status, processed_at, cancelled_at, profiles(id, name, email)')
    .single();

  if (error) throw new Error(error.message);
  return data;
}
