import { hasSupabaseConfig, supabase } from './supabase.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeDisplayName(value, fallback = 'PhillyGrind user') {
  const trimmed = String(value || '').trim();
  if (!trimmed || emailPattern.test(trimmed)) return fallback;
  return trimmed;
}

export async function getProfilesByIds(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];

  if (!ids.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id,name')
    .in('id', ids);

  if (error) throw error;

  return new Map((data ?? []).map((profile) => [
    profile.id,
    profile.name || 'PhillyGrind user',
  ]));
}

function addSenderNames(messages, profilesById) {
  return messages.map((message) => ({
    ...message,
    senderName: profilesById.get(message.sender_id) || 'PhillyGrind user',
    receiverName: profilesById.get(message.receiver_id) || 'PhillyGrind user',
  }));
}

function groupConversationMessages(messages, userId, listingsById, profilesById) {
  const grouped = new Map();

  for (const message of messages) {
    const otherUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;
    const otherUserName = profilesById.get(otherUserId) || 'PhillyGrind user';
    const key = `${message.listing_id}:${otherUserId}`;
    const current = grouped.get(key);

    if (!current || new Date(message.created_at) > new Date(current.lastMessage.created_at)) {
      grouped.set(key, {
        id: key,
        listingId: message.listing_id,
        otherUserId,
        otherUserName,
        listing: listingsById.get(message.listing_id) || {
          id: message.listing_id,
          title: 'Listing unavailable',
          company: otherUserName,
          user_id: otherUserId,
          type: 'listing',
        },
        lastMessage: message,
      });
    }
  }

  return [...grouped.values()].sort((a, b) => (
    new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at)
  ));
}

export async function getMessages({ listingId, receiverId, userId }) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data, error } = await supabase
    .from('messages')
    .select('id,sender_id,receiver_id,listing_id,content,created_at')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const filteredMessages = (data ?? []).filter((message) => (
    (message.sender_id === userId && message.receiver_id === receiverId)
    || (message.sender_id === receiverId && message.receiver_id === userId)
  ));

  const profilesById = await getProfilesByIds([
    ...filteredMessages.map((message) => message.sender_id),
    ...filteredMessages.map((message) => message.receiver_id),
  ]);

  return addSenderNames(filteredMessages, profilesById);
}

export async function sendMessage({ listingId, receiverId, content }) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before sending a message.');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: userData.user.id,
      receiver_id: receiverId,
      listing_id: listingId,
      content,
    })
    .select('id,sender_id,receiver_id,listing_id,content,created_at')
    .single();

  if (error) throw error;

  return data;
}

export async function getConversations(userId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id,sender_id,receiver_id,listing_id,content,created_at')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const listingIds = [...new Set((messages ?? []).map((message) => message.listing_id))];
  const profilesById = await getProfilesByIds([
    ...(messages ?? []).map((message) => message.sender_id),
    ...(messages ?? []).map((message) => message.receiver_id),
  ]);
  const namedMessages = addSenderNames(messages ?? [], profilesById);
  const listingsById = new Map();

  if (listingIds.length) {
    const [jobsResult, gigsResult, marketplaceResult] = await Promise.all([
      supabase
        .from('jobs')
        .select('id,user_id,title,company,contact,category,neighborhood,pay,description,created_at')
        .in('id', listingIds),
      supabase
        .from('gigs')
        .select('id,user_id,title,company,contact,category,neighborhood,pay,description,created_at')
        .in('id', listingIds),
      supabase
        .from('marketplace_items')
        .select('id,user_id,title,category,neighborhood,price,description,photo_urls,created_at')
        .in('id', listingIds),
    ]);

    if (jobsResult.error) throw jobsResult.error;
    if (gigsResult.error) throw gigsResult.error;
    if (marketplaceResult.error) throw marketplaceResult.error;

    for (const job of jobsResult.data ?? []) {
      listingsById.set(job.id, {
        ...job,
        company: safeDisplayName(profilesById.get(job.user_id) || job.company),
        posterName: safeDisplayName(profilesById.get(job.user_id) || job.company),
        type: 'job',
      });
    }

    for (const gig of gigsResult.data ?? []) {
      listingsById.set(gig.id, {
        ...gig,
        company: safeDisplayName(profilesById.get(gig.user_id) || gig.company),
        posterName: safeDisplayName(profilesById.get(gig.user_id) || gig.company),
        type: 'gig',
      });
    }

    for (const item of marketplaceResult.data ?? []) {
      const sellerName = safeDisplayName(profilesById.get(item.user_id));
      listingsById.set(item.id, {
        ...item,
        pay: item.price,
        company: sellerName,
        posterName: sellerName,
        sellerName,
        type: 'marketplace',
      });
    }
  }

  return groupConversationMessages(namedMessages, userId, listingsById, profilesById);
}

export function subscribeToMessages({ listingId, receiverId, userId, onMessage }) {
  if (!hasSupabaseConfig) return () => {};

  const channel = supabase
    .channel(`messages:${listingId}:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `listing_id=eq.${listingId}`,
      },
      (payload) => {
        const message = payload.new;
        const belongsToThread = (
          (message.sender_id === userId && message.receiver_id === receiverId)
          || (message.sender_id === receiverId && message.receiver_id === userId)
        );

        if (belongsToThread) {
          onMessage(message);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
