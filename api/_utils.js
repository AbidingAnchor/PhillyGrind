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

export const ADMIN_EMAIL = 'drewnegron95@gmail.com';

const MODERATION_CATEGORIES = [
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
  'hate',
  'hate/threatening',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'harassment',
  'harassment/threatening',
];

const REJECT_MESSAGE = "Your post was rejected because it violates PhillyGrind's community guidelines.";

export function isAdminUser(user) {
  return user?.email?.toLowerCase() === ADMIN_EMAIL;
}

export async function requireAdmin(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return null;
  }
  if (!isAdminUser(user)) {
    sendJson(res, 403, { error: 'Admin access required.' });
    return null;
  }
  return user;
}

export async function isUserSuspended(userId) {
  const { data, error } = await supabaseAdmin
    .from('suspended_users')
    .select('action_type')
    .eq('user_id', userId)
    .is('lifted_at', null)
    .in('action_type', ['suspended', 'banned']);

  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function moderateContent(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { decision: 'approved', scores: null, flagged: false };
  }

  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return { decision: 'approved', scores: null, flagged: false };
  }

  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: trimmed }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Content moderation failed.');
  }

  const result = payload.results?.[0];
  if (!result) {
    return { decision: 'approved', scores: null, flagged: false };
  }

  const categories = result.categories || {};
  const scores = result.category_scores || {};

  const hardFlagged = MODERATION_CATEGORIES.some((category) => categories[category]);
  if (hardFlagged || result.flagged) {
    const highScore = MODERATION_CATEGORIES.some((category) => (scores[category] || 0) >= 0.8);
    if (hardFlagged || highScore) {
      return { decision: 'rejected', scores, flagged: true, message: REJECT_MESSAGE };
    }
  }

  const borderline = Object.values(scores).some((score) => score >= 0.5 && score < 0.8);
  if (borderline) {
    return { decision: 'flagged', scores, flagged: true };
  }

  return { decision: 'approved', scores, flagged: false };
}

export function buildListingModerationText(listing) {
  return [
    listing.title,
    listing.description,
    listing.company,
    listing.category,
    listing.neighborhood,
    listing.pay,
    listing.location,
    listing.condition,
  ].filter(Boolean).join('\n');
}

export async function createModerationReport({
  reportedId,
  listingType,
  reason,
  scores,
  reporterId = null,
}) {
  const { error } = await supabaseAdmin
    .from('reports')
    .insert({
      reporter_id: reporterId,
      reported_type: 'listing',
      reported_id: reportedId,
      listing_type: listingType,
      reason,
      status: 'open',
      moderation_scores: scores,
    });

  if (error) throw error;
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
