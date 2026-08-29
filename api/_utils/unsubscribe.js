import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DEFAULT_SITE_URL = 'https://phillygrind.work';

function getUnsubscribeSecret() {
  return (
    process.env.UNSUBSCRIBE_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || ''
  );
}

export function createUnsubscribeToken(userId) {
  const secret = getUnsubscribeSecret();
  if (!secret) {
    throw new Error('Missing unsubscribe signing secret.');
  }
  const id = String(userId || '').trim();
  if (!UUID_RE.test(id)) {
    throw new Error('A valid user id is required to create an unsubscribe token.');
  }
  const hmac = createHmac('sha256', secret).update(id).digest('base64url');
  return `${id}.${hmac}`;
}

export function verifyUnsubscribeToken(token) {
  const secret = getUnsubscribeSecret();
  if (!secret || typeof token !== 'string') return null;

  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0) return null;

  const userId = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!UUID_RE.test(userId) || !signature) return null;

  const expected = createHmac('sha256', secret).update(userId).digest('base64url');
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  return userId;
}

export function createUnsubscribeUrl(userId, siteUrl = DEFAULT_SITE_URL) {
  const base = String(siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${base}/api/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(userId))}`;
}
