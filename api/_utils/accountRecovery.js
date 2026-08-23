import crypto from 'crypto';
import { supabaseAdmin } from '../_utils.js';
import { sendEmail } from './email.js';
import { createAccountRecoveryApprovedEmail, createAccountRecoveryDeniedEmail } from './emailTemplate.js';

export const RECOVERY_BUSY_MESSAGE = 'Too many recovery attempts — try again tomorrow or contact support directly.';
export const RECOVERY_SUBMITTED_MESSAGE = 'Your request has been submitted for review';
export const RECOVERY_EXPIRED_MESSAGE = 'This recovery session expired. Start again from the login page.';
export const RECOVERY_RESET_INVALID = 'This link is invalid or has expired.';
export const RECOVERY_RESET_DONE = 'Your password and login email have been updated. You can sign in with the new email now.';

export const MAX_RECOVERY_PER_IDENTIFIER = 3;
export const MAX_RECOVERY_PER_IP = 10;
const CHALLENGE_TTL_MS = 30 * 60 * 1000;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCOUNT_REF_RE = /^pg-[0-9a-f]{7}$/i;

export const RECOVERY_QUESTION_DEFS = {
  created_at: {
    id: 'created_at',
    prompt: 'About when did you create this account? (month and year)',
  },
  neighborhoods: {
    id: 'neighborhoods',
    prompt: 'Which Philadelphia neighborhood(s) did you select on your profile?',
  },
  previous_names: {
    id: 'previous_names',
    prompt: 'What display name(s) has this account used before the current one?',
  },
  recent_content: {
    id: 'recent_content',
    prompt: 'Describe or paraphrase a recent Community post or comment you made.',
  },
  listing_title: {
    id: 'listing_title',
    prompt: 'What was the title of a job, gig, or marketplace listing you posted?',
  },
};

const GENERIC_QUESTION_IDS = ['created_at', 'neighborhoods', 'recent_content', 'listing_title'];

function clip(value, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function questionsFromIds(ids) {
  return ids.map((id) => ({ id, prompt: RECOVERY_QUESTION_DEFS[id].prompt }));
}

export function normalizeIdentifier(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 254);
}

export function publicSiteUrl() {
  const raw = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || 'https://www.phillygrind.work';
  return String(raw).replace(/\/$/, '');
}

export function getRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0];
  const ip = (first || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').toString().trim();
  return ip.slice(0, 64) || 'unknown';
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function tokensMatch(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function selectRecoveryQuestions(snapshot) {
  if (!snapshot) {
    return questionsFromIds(GENERIC_QUESTION_IDS);
  }

  const ids = ['created_at'];
  if ((snapshot.neighborhoods || []).length) ids.push('neighborhoods');
  if ((snapshot.name_history || []).length) ids.push('previous_names');
  if ((snapshot.posts || []).length || (snapshot.comments || []).length) ids.push('recent_content');
  if ((snapshot.listings || []).length) ids.push('listing_title');
  return questionsFromIds(ids.slice(0, 4));
}

export async function resolveClaimedUser(identifierRaw) {
  const identifier = normalizeIdentifier(identifierRaw);
  if (!identifier) return null;

  if (EMAIL_RE.test(identifier)) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', identifier)
      .limit(2);
    if (error) throw error;
    return data?.length === 1 ? data[0].id : null;
  }

  if (ACCOUNT_REF_RE.test(identifier)) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('account_reference', identifier)
      .limit(2);
    if (error) throw error;
    return data?.length === 1 ? data[0].id : null;
  }

  const safeName = identifier.replace(/[%_]/g, '');
  if (!safeName) return null;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('name', safeName)
    .limit(2);
  if (error) throw error;
  return data?.length === 1 ? data[0].id : null;
}

export async function buildAccountSnapshot(userId) {
  const [
    profileResult,
    historyResult,
    postsResult,
    commentsResult,
    jobsResult,
    gigsResult,
    marketResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id,name,email,account_reference,neighborhood,neighborhoods,created_at,two_factor_enabled')
      .eq('id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('name_history')
      .select('old_name,new_name,changed_at')
      .eq('user_id', userId)
      .order('changed_at', { ascending: false })
      .limit(12),
    supabaseAdmin
      .from('community_posts')
      .select('id,content,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('community_comments')
      .select('id,content,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('jobs')
      .select('id,title,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('gigs')
      .select('id,title,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('marketplace_listings')
      .select('id,title,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) return null;

  const neighborhoods = [
    profileResult.data.neighborhood,
    ...(Array.isArray(profileResult.data.neighborhoods) ? profileResult.data.neighborhoods : []),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index);

  const listings = [
    ...(jobsResult.data || []).map((row) => ({ type: 'job', id: row.id, title: row.title, created_at: row.created_at })),
    ...(gigsResult.data || []).map((row) => ({ type: 'gig', id: row.id, title: row.title, created_at: row.created_at })),
    ...(marketResult.data || []).map((row) => ({ type: 'marketplace', id: row.id, title: row.title, created_at: row.created_at })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8);

  return {
    profile: {
      id: profileResult.data.id,
      name: profileResult.data.name,
      email: profileResult.data.email,
      account_reference: profileResult.data.account_reference,
      created_at: profileResult.data.created_at,
      two_factor_enabled: profileResult.data.two_factor_enabled,
    },
    neighborhoods,
    name_history: historyResult.data || [],
    posts: (postsResult.data || []).map((row) => ({
      id: row.id,
      content: clip(row.content),
      created_at: row.created_at,
    })),
    comments: (commentsResult.data || []).map((row) => ({
      id: row.id,
      content: clip(row.content),
      created_at: row.created_at,
    })),
    listings,
  };
}

async function countRecent(table, column, value) {
  if (!value) return 0;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
    .gte('created_at', since);
  if (error) throw error;
  return count ?? 0;
}

export async function isRecoveryRateLimited({ identifierNormalized, ip }) {
  const ipKey = ip && ip !== 'unknown' ? ip : '';
  const [requestsById, requestsByIp, challengesById, challengesByIp] = await Promise.all([
    countRecent('account_recovery_requests', 'identifier_normalized', identifierNormalized),
    countRecent('account_recovery_requests', 'requester_ip', ipKey),
    countRecent('account_recovery_challenges', 'identifier_normalized', identifierNormalized),
    countRecent('account_recovery_challenges', 'requester_ip', ipKey),
  ]);
  return (
    requestsById >= MAX_RECOVERY_PER_IDENTIFIER
    || requestsByIp >= MAX_RECOVERY_PER_IP
    || challengesById >= 8
    || challengesByIp >= 20
  );
}

function sanitizeAnswers(questions, rawAnswers) {
  const source = rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {};
  const answers = {};
  for (const question of questions) {
    const value = source[question.id];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      answers[question.id] = {
        month: String(value.month || '').trim().slice(0, 20),
        year: String(value.year || '').trim().slice(0, 6),
      };
    } else if (Array.isArray(value)) {
      answers[question.id] = value.map((item) => String(item || '').trim().slice(0, 80)).filter(Boolean).slice(0, 12);
    } else {
      answers[question.id] = String(value || '').trim().slice(0, 800);
    }
  }
  return answers;
}

export async function startRecoveryChallenge({ identifier, ip }) {
  const identifierRaw = normalizeIdentifier(identifier);
  const identifierNormalized = identifierRaw.toLowerCase();
  if (!identifierNormalized) {
    return { error: 'Enter the email, display name, or account reference for the account.', status: 400 };
  }

  if (await isRecoveryRateLimited({ identifierNormalized, ip })) {
    return { error: RECOVERY_BUSY_MESSAGE, status: 429 };
  }

  const claimedUserId = await resolveClaimedUser(identifierRaw);
  const snapshot = claimedUserId ? await buildAccountSnapshot(claimedUserId) : null;
  const questions = selectRecoveryQuestions(snapshot);

  const { data, error } = await supabaseAdmin
    .from('account_recovery_challenges')
    .insert({
      claimed_user_id: snapshot?.profile?.id || claimedUserId || null,
      identifier_normalized: identifierNormalized,
      questions,
      snapshot,
      requester_ip: ip,
      expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;

  return {
    challengeId: data.id,
    questions,
  };
}

export async function submitRecoveryRequest({ challengeId, answers, newEmail, identifierRaw, ip }) {
  const email = normalizeEmail(newEmail);
  if (!EMAIL_RE.test(email)) {
    return { error: 'Enter a valid email address for where we should contact you.', status: 400 };
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('account_recovery_challenges')
    .select('id,identifier_normalized')
    .eq('id', challengeId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) {
    return { error: RECOVERY_EXPIRED_MESSAGE, status: 400 };
  }

  if (await isRecoveryRateLimited({ identifierNormalized: existing.identifier_normalized, ip })) {
    return { error: RECOVERY_BUSY_MESSAGE, status: 429 };
  }

  const nowIso = new Date().toISOString();
  const { data: challenge, error: claimError } = await supabaseAdmin
    .from('account_recovery_challenges')
    .update({ consumed_at: nowIso })
    .eq('id', challengeId)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .select('*')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!challenge) {
    return { error: RECOVERY_EXPIRED_MESSAGE, status: 400 };
  }

  const questions = Array.isArray(challenge.questions) ? challenge.questions : [];
  const sanitized = sanitizeAnswers(questions, answers);

  const { error: insertError } = await supabaseAdmin.from('account_recovery_requests').insert({
    challenge_id: challenge.id,
    claimed_user_id: challenge.claimed_user_id || null,
    identifier_raw: normalizeIdentifier(identifierRaw) || challenge.identifier_normalized,
    identifier_normalized: challenge.identifier_normalized,
    new_email: email,
    questions_asked: questions,
    answers: sanitized,
    snapshot: challenge.snapshot,
    requester_ip: ip,
    status: 'pending',
  });
  if (insertError) {
    if (insertError.code === '23505') {
      return { error: RECOVERY_EXPIRED_MESSAGE, status: 400 };
    }
    throw insertError;
  }

  return { message: RECOVERY_SUBMITTED_MESSAGE };
}

export async function listPendingRecoveryRequests() {
  const { data: requests, error } = await supabaseAdmin
    .from('account_recovery_requests')
    .select('*')
    .eq('status', 'pending')
    .not('claimed_user_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;
  return requests || [];
}

export async function countPendingRecoveryRequests() {
  const { count, error } = await supabaseAdmin
    .from('account_recovery_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .not('claimed_user_id', 'is', null);
  if (error) throw error;
  return count ?? 0;
}

async function loadPendingClaim(requestId) {
  const { data, error } = await supabaseAdmin
    .from('account_recovery_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'pending' || !data.claimed_user_id) {
    return null;
  }
  return data;
}

async function logRecoveryAction(adminId, userId, actionType, metadata) {
  const { error } = await supabaseAdmin.from('admin_action_log').insert({
    admin_id: adminId,
    target_user_id: userId,
    action_type: actionType,
    metadata,
  });
  if (error) console.warn('[account-recovery] action log skipped', error.message);
}

export async function approveRecoveryRequest({ requestId, adminId }) {
  const request = await loadPendingClaim(requestId);
  if (!request) {
    return { error: 'That request is no longer pending.', status: 400 };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await supabaseAdmin
    .from('account_recovery_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', request.claimed_user_id)
    .is('used_at', null);

  const { error: tokenError } = await supabaseAdmin.from('account_recovery_tokens').insert({
    request_id: request.id,
    user_id: request.claimed_user_id,
    new_email: request.new_email,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
  if (tokenError) throw tokenError;

  const resetUrl = `${publicSiteUrl()}/account-recovery/reset?token=${rawToken}`;
  try {
    await sendEmail({
      to: request.new_email,
      subject: 'Set a new PhillyGrind password',
      html: createAccountRecoveryApprovedEmail({ resetUrl }),
    });
  } catch (error) {
    await supabaseAdmin.from('account_recovery_tokens').delete().eq('request_id', request.id);
    throw error;
  }

  const { error: updateError } = await supabaseAdmin
    .from('account_recovery_requests')
    .update({
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', request.id)
    .eq('status', 'pending');
  if (updateError) throw updateError;

  await logRecoveryAction(adminId, request.claimed_user_id, 'recovery_approved', { request_id: request.id });
  return { ok: true };
}

export async function denyRecoveryRequest({ requestId, adminId }) {
  const request = await loadPendingClaim(requestId);
  if (!request) {
    return { error: 'That request is no longer pending.', status: 400 };
  }

  try {
    await sendEmail({
      to: request.new_email,
      subject: 'PhillyGrind account recovery update',
      html: createAccountRecoveryDeniedEmail(),
    });
  } catch (error) {
    throw error;
  }

  const { error: updateError } = await supabaseAdmin
    .from('account_recovery_requests')
    .update({
      status: 'denied',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', request.id)
    .eq('status', 'pending');
  if (updateError) throw updateError;

  await logRecoveryAction(adminId, request.claimed_user_id, 'recovery_denied', { request_id: request.id });
  return { ok: true };
}

export async function completeRecoveryReset({ token, password }) {
  const rawToken = String(token || '').trim();
  const nextPassword = String(password || '');
  if (!rawToken || nextPassword.length < 6) {
    return { error: 'Enter a new password of at least 6 characters.', status: 400 };
  }

  const tokenHash = hashToken(rawToken);
  const { data: rows, error } = await supabaseAdmin
    .from('account_recovery_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .limit(1);

  if (error) throw error;
  const record = rows?.[0];
  if (!record || !tokensMatch(record.token_hash, tokenHash) || new Date(record.expires_at).getTime() < Date.now()) {
    return { error: RECOVERY_RESET_INVALID, status: 400 };
  }

  const { data: emailOwner, error: emailLookupError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .ilike('email', record.new_email)
    .neq('id', record.user_id)
    .limit(1);
  if (emailLookupError) throw emailLookupError;
  if (emailOwner?.length) {
    return { error: 'Could not finish recovery. Contact support directly.', status: 409 };
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(record.user_id, {
    password: nextPassword,
    email: record.new_email,
    email_confirm: true,
  });
  if (authError) {
    console.error('[account-recovery] updateUserById failed', {
      tag: 'ACCOUNT_RECOVERY_AUTH_UPDATE_FAILED',
      userId: record.user_id,
      requestId: record.request_id,
      tokenId: record.id,
      newEmail: record.new_email,
      message: authError.message,
    });
    return { error: 'Could not finish recovery. Contact support directly.', status: 500 };
  }

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      email: record.new_email,
      two_factor_enabled: false,
    })
    .eq('id', record.user_id);
  if (profileError) {
    console.error('[account-recovery] ACCOUNT_RECOVERY_PROFILE_SYNC_FAILED', {
      tag: 'ACCOUNT_RECOVERY_PROFILE_SYNC_FAILED',
      userId: record.user_id,
      requestId: record.request_id,
      tokenId: record.id,
      newEmail: record.new_email,
      authUpdated: true,
      profileStillNeedsEmailAndTwoFactorOff: true,
      message: profileError.message,
      code: profileError.code,
      hint: 'Auth login email/password already updated. Manually set profiles.email to newEmail and profiles.two_factor_enabled=false, then mark the recovery token used_at.',
    });
    return { error: 'Could not finish recovery. Contact support directly.', status: 500 };
  }

  await supabaseAdmin.from('two_factor_codes').delete().eq('user_id', record.user_id);

  try {
    await supabaseAdmin.auth.admin.signOut(record.user_id, 'global');
  } catch (signOutError) {
    console.warn('[account-recovery] global signOut failed', signOutError.message);
  }

  await supabaseAdmin
    .from('account_recovery_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', record.id);

  return { message: RECOVERY_RESET_DONE };
}
