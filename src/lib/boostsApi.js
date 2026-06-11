import { hasSupabaseConfig, supabase } from './supabase.js';

async function getAccessToken() {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Please log in first.');
  }

  return data.session.access_token;
}

export async function createBoostCheckout({ listingId, listingType, tier }) {
  const token = await getAccessToken();
  const response = await fetch('/api/stripe?action=create-boost-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      listing_id: listingId,
      listing_type: listingType,
      tier,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Could not start boost checkout.');
  }

  return payload;
}
