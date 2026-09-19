import { supabase } from './supabase.js';
import { isReferralId } from './referralLink.js';

const STORAGE_KEY = 'pg_referral';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export {
  DEFAULT_INVITE_ORIGIN,
  INVITE_SHARE_PREFIX,
  getInviteLink,
  getInviteShareText,
  isReferralId,
} from './referralLink.js';

export function persistReferral(ref) {
  const id = String(ref || '').trim();
  if (!isReferralId(id) || typeof window === 'undefined') return false;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, savedAt: Date.now() }));
  return true;
}

export function clearStoredReferral() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function readStoredReferral() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const id = String(parsed?.id || '').trim();
    const savedAt = Number(parsed?.savedAt) || 0;
    if (!isReferralId(id) || Date.now() - savedAt > TTL_MS) {
      clearStoredReferral();
      return null;
    }
    return id;
  } catch {
    clearStoredReferral();
    return null;
  }
}

export async function claimStoredReferral() {
  const referrerId = readStoredReferral();
  if (!referrerId) return { claimed: false };

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { claimed: false };

  if (userId === referrerId) {
    clearStoredReferral();
    return { claimed: false };
  }

  const { error } = await supabase.rpc('claim_own_referral', { p_referrer_id: referrerId });
  if (error) {
    console.warn('[referral] claim failed:', error.message);
    if (/invalid referrer|referrer not found/i.test(error.message || '')) {
      clearStoredReferral();
    }
    return { claimed: false };
  }

  clearStoredReferral();
  return { claimed: true };
}
