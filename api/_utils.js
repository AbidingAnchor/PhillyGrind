import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function isValidSupabaseUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

export const serverSupabaseUrl = process.env.SUPABASE_URL;
export const hasValidServerSupabaseUrl = isValidSupabaseUrl(serverSupabaseUrl);
export const hasServerSupabaseConfig = Boolean(hasValidServerSupabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export const supabaseAdmin = createClient(
  hasValidServerSupabaseUrl ? serverSupabaseUrl : 'https://example.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'missing-service-role-key',
  {
    auth: {
      persistSession: false,
    },
  },
);

export function sendJson(res, status, body) {
  res.status(status).json(body);
}

export function requireMethod(req, res, method = 'POST') {
  if (req.method !== method) {
    sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
    return false;
  }

  return true;
}

export async function getUserFromRequest(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;

  return data.user;
}

export async function findListing(listingId) {
  const [jobsResult, gigsResult, marketplaceResult] = await Promise.all([
    supabaseAdmin
      .from('jobs')
      .select('id,user_id,title,pay')
      .eq('id', listingId)
      .maybeSingle(),
    supabaseAdmin
      .from('gigs')
      .select('id,user_id,post_type,title,pay')
      .eq('id', listingId)
      .maybeSingle(),
    supabaseAdmin
      .from('marketplace_listings')
      .select('id,user_id,title,price,payment_type,status')
      .eq('id', listingId)
      .maybeSingle(),
  ]);

  if (jobsResult.error) throw jobsResult.error;
  if (gigsResult.error) throw gigsResult.error;
  if (marketplaceResult.error) throw marketplaceResult.error;

  if (jobsResult.data) return { ...jobsResult.data, listing_type: 'job' };
  if (gigsResult.data) return { ...gigsResult.data, listing_type: 'gig' };
  if (marketplaceResult.data) {
    return {
      ...marketplaceResult.data,
      pay: marketplaceResult.data.price,
      listing_type: 'marketplace',
    };
  }

  return null;
}

export function normalizeAmount(amount) {
  const numberAmount = Number(amount);
  if (!Number.isFinite(numberAmount) || numberAmount <= 0) {
    throw new Error('A valid payment amount is required.');
  }

  return Math.round(numberAmount);
}

export async function handleProfileStatsRequest(req, res) {
  if (!hasServerSupabaseConfig) {
    sendJson(res, 500, { error: 'Server Supabase configuration is missing.' });
    return;
  }

  const viewer = await getUserFromRequest(req);
  if (!viewer) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return;
  }

  const userId = req.query.user_id;
  if (!userId) {
    sendJson(res, 400, { error: 'user_id is required.' });
    return;
  }

  const { count, error } = await supabaseAdmin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .or(`worker_id.eq.${userId},hirer_id.eq.${userId}`);

  if (error) throw error;

  sendJson(res, 200, { completedCount: count ?? 0 });
}
