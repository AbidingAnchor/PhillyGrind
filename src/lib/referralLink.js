const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INVITE_SHARE_PREFIX = 'Hey, check out PhillyGrind — ';
export const DEFAULT_INVITE_ORIGIN = 'https://phillygrind.work';

export function isReferralId(value) {
  return UUID_RE.test(String(value || '').trim());
}

function resolveOrigin(origin) {
  if (origin) return String(origin).replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return DEFAULT_INVITE_ORIGIN;
}

export function getInviteLink(userId, origin) {
  const resolvedOrigin = resolveOrigin(origin);
  if (!isReferralId(userId)) return `${resolvedOrigin}/signup`;
  return `${resolvedOrigin}/join?ref=${encodeURIComponent(userId)}`;
}

export function getInviteShareText(userId, origin) {
  return `${INVITE_SHARE_PREFIX}${getInviteLink(userId, origin)}`;
}
