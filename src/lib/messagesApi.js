import { hasSupabaseConfig, supabase } from './supabase.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROFILE_CONVERSATION_LISTING_ID = '00000000-0000-0000-0000-000000000001';
const MESSAGE_COLUMNS = 'id,sender_id,receiver_id,listing_id,content,created_at,read_at';

const LOAD_MESSAGES_ERROR = 'Something went wrong loading messages, please try again';
const SEND_MESSAGE_ERROR = 'Something went wrong sending your message, please try again';
const LOAD_CONVERSATIONS_ERROR = 'Something went wrong loading conversations, please try again';

function logAndThrowUserError(error, userMessage) {
  console.error('[messagesApi]', error);
  throw new Error(userMessage);
}

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
    .select('id,name,avatar_url')
    .in('id', ids);

  if (error) logAndThrowUserError(error, LOAD_MESSAGES_ERROR);

  return new Map((data ?? []).map((profile) => [
    profile.id,
    profile.name || 'PhillyGrind user',
  ]));
}

export async function getParticipantProfiles(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];

  if (!ids.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,avatar_url')
    .in('id', ids);

  if (error) logAndThrowUserError(error, LOAD_MESSAGES_ERROR);

  return new Map((data ?? []).map((profile) => [
    profile.id,
    {
      name: profile.name || 'PhillyGrind user',
      avatar_url: profile.avatar_url || '',
    },
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
    const key = otherUserId;
    const current = grouped.get(key);

    if (!current || new Date(message.created_at) > new Date(current.lastMessage.created_at)) {
      const listing = listingsById.get(message.listing_id) || {
        id: message.listing_id,
        title: 'Listing unavailable',
        company: otherUserName,
        user_id: otherUserId,
        type: 'listing',
      };
      grouped.set(key, {
        id: key,
        listingId: message.listing_id,
        otherUserId,
        otherUserName,
        listing,
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
    .select(MESSAGE_COLUMNS)
    .order('created_at', { ascending: true });

  if (error) logAndThrowUserError(error, LOAD_MESSAGES_ERROR);

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
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) logAndThrowUserError(error, SEND_MESSAGE_ERROR);

  return data;
}

export async function getConversations(userId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: messages, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) logAndThrowUserError(error, LOAD_CONVERSATIONS_ERROR);

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
        .from('marketplace_listings')
        .select('id,user_id,title,category,neighborhood,price,description,photos,created_at')
        .in('id', listingIds),
    ]);

    if (jobsResult.error) logAndThrowUserError(jobsResult.error, LOAD_CONVERSATIONS_ERROR);
    if (gigsResult.error) logAndThrowUserError(gigsResult.error, LOAD_CONVERSATIONS_ERROR);
    if (marketplaceResult.error) logAndThrowUserError(marketplaceResult.error, LOAD_CONVERSATIONS_ERROR);

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

  // Handle profile conversations (placeholder listing_id)
  const profileMessages = namedMessages.filter((m) => m.listing_id === PROFILE_CONVERSATION_LISTING_ID);
  const profileConversations = new Map();
  
  for (const message of profileMessages) {
    const otherUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;
    const otherUserName = profilesById.get(otherUserId) || 'PhillyGrind user';
    const key = `${PROFILE_CONVERSATION_LISTING_ID}:${otherUserId}`;
    
    if (!profileConversations.has(key) || new Date(message.created_at) > new Date(profileConversations.get(key).lastMessage.created_at)) {
      profileConversations.set(key, {
        id: key,
        listingId: PROFILE_CONVERSATION_LISTING_ID,
        otherUserId,
        otherUserName,
        listing: {
          id: PROFILE_CONVERSATION_LISTING_ID,
          title: `Conversation with ${otherUserName}`,
          user_id: otherUserId,
          posterName: otherUserName,
          company: otherUserName,
          type: 'profile',
        },
        lastMessage: message,
      });
    }
  }

  const listingConversations = groupConversationMessages(
    namedMessages.filter((m) => m.listing_id !== PROFILE_CONVERSATION_LISTING_ID),
    userId,
    listingsById,
    profilesById
  );

  return [...profileConversations.values(), ...listingConversations].sort((a, b) => (
    new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at)
  ));
}

export async function getProfileConversation(userId, otherUserId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('listing_id', PROFILE_CONVERSATION_LISTING_ID)
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: true });

  if (error) logAndThrowUserError(error, LOAD_MESSAGES_ERROR);

  const profilesById = await getProfilesByIds([
    ...(data ?? []).map((message) => message.sender_id),
    ...(data ?? []).map((message) => message.receiver_id),
  ]);

  return addSenderNames(data ?? [], profilesById);
}

export async function getOrCreateProfileConversation(userId, otherUserId) {
  const existingMessages = await getProfileConversation(userId, otherUserId);
  
  if (existingMessages.length > 0) {
    return { existing: true, messages: existingMessages };
  }

  return { existing: false, messages: [] };
}

export async function markThreadMessagesRead({ otherUserId, userId }) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data, error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', otherUserId)
    .eq('receiver_id', userId)
    .is('read_at', null)
    .select('id,read_at');

  if (error) logAndThrowUserError(error, LOAD_MESSAGES_ERROR);
  return data ?? [];
}

function messageBelongsToThread(message, { listingId, receiverId, userId }) {
  if (message.listing_id !== listingId) return false;
  return (
    (message.sender_id === userId && message.receiver_id === receiverId)
    || (message.sender_id === receiverId && message.receiver_id === userId)
  );
}

export function subscribeToMessages({ listingId, receiverId, userId, onMessage, onUpdate }) {
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
        if (messageBelongsToThread(message, { listingId, receiverId, userId })) {
          onMessage?.(message);
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `listing_id=eq.${listingId}`,
      },
      (payload) => {
        const message = payload.new;
        if (messageBelongsToThread(message, { listingId, receiverId, userId })) {
          onUpdate?.(message);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
