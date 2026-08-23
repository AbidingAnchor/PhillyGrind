import { hasSupabaseConfig, supabase } from './supabase.js';

async function getListingPaths(listingIds) {
  const ids = [...new Set((listingIds ?? []).filter(Boolean))];
  const pathsById = new Map();

  if (!ids.length) return pathsById;

  const [jobsResult, gigsResult] = await Promise.all([
    supabase.from('jobs_public').select('id').in('id', ids),
    supabase.from('gigs_public').select('id').in('id', ids),
  ]);

  if (jobsResult.error) throw jobsResult.error;
  if (gigsResult.error) throw gigsResult.error;

  for (const job of jobsResult.data ?? []) {
    pathsById.set(job.id, `/jobs/${job.id}`);
  }

  for (const gig of gigsResult.data ?? []) {
    pathsById.set(gig.id, `/gigs/${gig.id}`);
  }

  return pathsById;
}

export async function getNotifications(userId) {
  if (!hasSupabaseConfig || !userId) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('id,user_id,type,message,listing_id,listing_type,sender_id,alert_id,read,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  const pathsById = await getListingPaths((data ?? []).map((notification) => notification.listing_id));

  return (data ?? []).map((notification) => ({
    ...notification,
    listingPath: notification.type === 'neighborhood_alert'
      ? (notification.alert_id ? `/alerts?id=${encodeURIComponent(notification.alert_id)}` : '/alerts')
      : notification.listing_type && notification.listing_id
      ? `/${notification.listing_type === 'gig' ? 'gigs' : 'jobs'}/${notification.listing_id}${
          notification.type === 'message' && notification.sender_id
            ? `?openChat=true&senderId=${notification.sender_id}`
            : ''
        }`
      : pathsById.get(notification.listing_id) || '/messages',
  }));
}

export async function markNotificationsRead(userId) {
  if (!hasSupabaseConfig || !userId) return;

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
}

export async function deleteAllNotifications() {
  if (!hasSupabaseConfig) return;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before clearing notifications.');
  }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userData.user.id);

  if (error) throw error;
}

export function subscribeToNotifications({ userId, onNotification }) {
  if (!hasSupabaseConfig || !userId) return () => {};

  const channelName = `notifications:${userId}`;
  
  try {
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onNotification(payload.new),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIPTION_ERROR') {
          console.error('Notification subscription error:', status);
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        console.error('Error removing notification channel:', error);
      }
    };
  } catch (error) {
    console.error('Error subscribing to notifications:', error);
    return () => {};
  }
}
