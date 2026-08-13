import { supabase } from './supabase.js';

export async function sendTwoFactorCode(email) {
  const token = await getAccessToken();
  const response = await fetch('/api/two-factor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'send-code', email }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to send verification code.');
  }
  return payload;
}

export async function verifyTwoFactorCode(code) {
  const token = await getAccessToken();
  const response = await fetch('/api/two-factor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'verify-code', code }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to verify code.');
  }
  return payload;
}

export async function toggleTwoFactorAuth(enabled, verifyCode = null) {
  const token = await getAccessToken();
  const response = await fetch('/api/two-factor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'toggle-2fa', enabled, verifyCode }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Failed to update 2FA settings.');
  }
  return payload;
}

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}
