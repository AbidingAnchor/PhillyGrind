import { hasSupabaseConfig, supabase } from './supabase.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE = 10 * 1024 * 1024;

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Please log in first.');
  }
  return data.session.access_token;
}

export async function uploadDisputePhoto(orderId, file, kind) {
  if (!hasSupabaseConfig) throw new Error('Supabase credentials are missing.');
  if (!orderId || !file) throw new Error('Order and photo are required.');

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Upload a JPG, PNG, WebP, or HEIC photo.');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('Photo must be 10MB or smaller.');
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${orderId}/${kind}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('dispute-photos')
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) throw uploadError;
  return path;
}

async function apiRequest(action, { method = 'POST', body, query = {} } = {}) {
  const token = await getAccessToken();
  const params = new URLSearchParams({ action, ...query });
  const response = await fetch(`/api/marketplace-orders?${params}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }
  return payload;
}

export async function markHandoff(orderId, photoPath) {
  return apiRequest('mark-handoff', { body: { order_id: orderId, photo_path: photoPath } });
}

export async function confirmMarketplaceReceipt(orderId) {
  return apiRequest('confirm-receipt', { body: { order_id: orderId } });
}

export async function openDispute(orderId, description, photoPath) {
  return apiRequest('open-dispute', {
    body: { order_id: orderId, description, photo_path: photoPath },
  });
}

export async function submitSellerEvidence(orderId, description, photoPath) {
  return apiRequest('submit-seller-evidence', {
    body: { order_id: orderId, description, photo_path: photoPath },
  });
}

export async function getDispute(orderId) {
  return apiRequest('get-dispute', { method: 'GET', query: { order_id: orderId } });
}

export async function listDisputes(status = 'open') {
  return apiRequest('list-disputes', { method: 'GET', query: { status } });
}

export async function getDisputeDetail(disputeId) {
  return apiRequest('get-dispute-detail', { method: 'GET', query: { dispute_id: disputeId } });
}

export async function resolveDispute(disputeId, resolution) {
  return apiRequest('resolve-dispute', { body: { dispute_id: disputeId, resolution } });
}

export async function getDisputePhotoUrl(path) {
  if (!hasSupabaseConfig || !path) return null;
  const { data, error } = await supabase.storage
    .from('dispute-photos')
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export function getHandoffDeadline(handoffAt) {
  if (!handoffAt) return null;
  return new Date(new Date(handoffAt).getTime() + 2 * 60 * 60 * 1000);
}

export function formatCountdown(deadline) {
  if (!deadline) return '';
  const ms = deadline.getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return hrs > 0 ? `${hrs}h ${rem}m remaining` : `${rem}m remaining`;
}
