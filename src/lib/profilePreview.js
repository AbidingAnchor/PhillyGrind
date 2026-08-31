import { resolveHomeNeighborhood } from './communityApi.js';
import { hasSupabaseConfig, supabase } from './supabase.js';

const cache = new Map();
const inflight = new Map();

export function isProfileUserId(value) {
  return Boolean(value && value !== 'undefined' && value !== 'null');
}

export async function fetchProfilePreview(userId) {
  if (!isProfileUserId(userId)) return null;
  if (cache.has(userId)) return cache.get(userId);
  if (inflight.has(userId)) return inflight.get(userId);

  const request = (async () => {
    if (!hasSupabaseConfig) {
      cache.set(userId, null);
      return null;
    }

    let { data, error } = await supabase
      .from('profiles_public')
      .select('id,name,bio,neighborhood,neighborhoods,avatar_url,staff_title')
      .eq('id', userId)
      .maybeSingle();

    if (error && String(error.message || '').includes('staff_title')) {
      ({ data, error } = await supabase
        .from('profiles_public')
        .select('id,name,bio,neighborhood,neighborhoods,avatar_url')
        .eq('id', userId)
        .maybeSingle());
    }

    if (error) throw error;

    const preview = data
      ? {
          id: data.id,
          name: String(data.name || '').trim(),
          bio: String(data.bio || '').trim(),
          neighborhood: resolveHomeNeighborhood(data),
          avatarUrl: data.avatar_url || '',
          staffTitle: data.staff_title || null,
        }
      : null;

    cache.set(userId, preview);
    return preview;
  })().finally(() => {
    inflight.delete(userId);
  });

  inflight.set(userId, request);
  return request;
}
