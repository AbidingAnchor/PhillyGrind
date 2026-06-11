import { hasSupabaseConfig, supabase } from './supabase.js';

const ORDER_SELECT = 'id,listing_id,hirer_id,worker_id,amount,status,stripe_payment_intent_id,created_at,completed_at,worker_marked_complete_at,released_at,before_photo_url,after_photo_url';
const photoKinds = new Set(['before', 'after']);

export function parsePayToCents(pay) {
  const match = String(pay || '').replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) return 0;

  return Math.round(Number(match[1]) * 100);
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Please log in first.');
  }

  return data.session.access_token;
}

function tokenPreview(token) {
  if (!token) return null;
  return `${token.slice(0, 12)}...${token.slice(-8)}`;
}

export async function getOrdersForListing(listingId) {
  if (!hasSupabaseConfig || !listingId) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function createPaymentIntent({ listingId, amount, acceptedBidId }) {
  const token = await getAccessToken();
  const response = await fetch('/api/stripe?action=create-payment-intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      listing_id: listingId,
      amount,
      accepted_bid_id: acceptedBidId,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Could not start payment.');
  }

  return payload;
}

export async function releasePayment(orderId) {
  const token = await getAccessToken();
  const response = await fetch('/api/orders?action=release-payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ order_id: orderId }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Could not release payment.');
  }

  return payload.order;
}

export async function markOrderComplete(orderId) {
  if (!hasSupabaseConfig) throw new Error('Supabase credentials are missing.');

  const { data, error } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      worker_marked_complete_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select(ORDER_SELECT)
    .single();

  if (error) throw error;

  return data;
}

export async function uploadOrderPhoto(orderId, kind, file) {
  if (!hasSupabaseConfig) throw new Error('Supabase credentials are missing.');
  if (!photoKinds.has(kind)) throw new Error('Choose a valid photo type.');
  if (!file) throw new Error('Choose a photo to upload.');

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before uploading photos.');
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Upload a JPG, PNG, or WebP photo.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Photo must be 10MB or smaller.');
  }

  const path = `orders/${orderId}/${kind}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('job-photos')
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const column = kind === 'before' ? 'before_photo_url' : 'after_photo_url';
  const { data, error } = await supabase
    .from('orders')
    .update({ [column]: path })
    .eq('id', orderId)
    .eq('worker_id', userData.user.id)
    .select(ORDER_SELECT)
    .single();

  if (error) throw error;

  return data;
}

export async function getOrderPhotoUrls(order) {
  if (!hasSupabaseConfig || !order) {
    return { before: '', after: '' };
  }

  const entries = [
    ['before', order.before_photo_url],
    ['after', order.after_photo_url],
  ].filter(([, path]) => Boolean(path));

  const signedEntries = await Promise.all(entries.map(async ([kind, path]) => {
    const { data, error } = await supabase.storage
      .from('job-photos')
      .createSignedUrl(path, 60 * 10);

    if (error) throw error;

    return [kind, data.signedUrl];
  }));

  return {
    before: '',
    after: '',
    ...Object.fromEntries(signedEntries),
  };
}

export async function createConnectAccount(accessToken) {
  const token = accessToken || await getAccessToken();
  const authorization = `Bearer ${token}`;

  console.log('createConnectAccount request debug', {
    endpoint: '/api/stripe?action=create-connect-account',
    hasToken: Boolean(token),
    tokenLength: token?.length || 0,
    tokenPreview: tokenPreview(token),
    authorizationPrefix: authorization.slice(0, 18),
    hasBearerPrefix: authorization.startsWith('Bearer '),
  });

  const response = await fetch('/api/stripe?action=create-connect-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Could not create Stripe Connect account.');
  }

  return payload;
}
