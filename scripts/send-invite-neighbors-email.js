/**
 * One-time re-engagement / invite email to current PhillyGrind users.
 *
 * Variant A: signed up more than 14 days ago
 * Variant B: signed up within the last 14 days
 *
 * Dry run (lists recipients, sends nothing):
 *   node scripts/send-invite-neighbors-email.js
 *
 * Actually send:
 *   node scripts/send-invite-neighbors-email.js --send
 *
 * Optional:
 *   --limit=5
 *   --only=you@email.com
 *
 * Needs RESEND_API_KEY, SUPABASE_URL (or VITE_SUPABASE_URL),
 * and SUPABASE_SERVICE_ROLE_KEY in .env / .env.local.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../api/_utils/email.js';
import { createEmailTemplate } from '../api/_utils/emailTemplate.js';
import { createUnsubscribeUrl } from '../api/_utils/unsubscribe.js';
import { DEFAULT_INVITE_ORIGIN, getInviteLink } from '../src/lib/referralLink.js';

const DELAY_MS = 500;
const PAGE_SIZE = 1000;
const SITE_URL = DEFAULT_INVITE_ORIGIN;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const SUBJECT_A = "PhillyGrind's grown — help us bring your block in too";
const SUBJECT_B = 'Welcome to PhillyGrind — help us grow your neighborhood';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!/^\s*[^#][^=]+=/.test(line)) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const args = process.argv.slice(2);
const shouldSend = args.includes('--send');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : null;
const onlyArg = args.find((arg) => arg.startsWith('--only='));
const onlyEmail = onlyArg ? onlyArg.slice('--only='.length).trim().toLowerCase() : '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inviteCta(inviteUrl) {
  const safeUrl = escapeHtml(inviteUrl);
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center" style="padding: 8px 0;">
            <a href="${safeUrl}" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Invite a Neighbor →
            </a>
          </td>
        </tr>
      </table>
  `;
}

function buildHtmlA(inviteUrl, userId, unsubscribeUrl) {
  return createEmailTemplate({
    subject: SUBJECT_A,
    userId,
    unsubscribeUrl,
    content: `
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Hey there,
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        A lot's happened on PhillyGrind since you joined — new features built right from what neighbors like you asked for:
      </p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 8px 0 24px 0;">
        <p style="margin: 0 0 12px 0; color: #111827; font-size: 15px; line-height: 1.6;">
          🏈 <strong>Live Philly Sports</strong> — Eagles, Sixers, and Phillies scores and updates, right on your homepage
        </p>
        <p style="margin: 0 0 12px 0; color: #111827; font-size: 15px; line-height: 1.6;">
          ⛈️ <strong>Weather alerts</strong> for your neighborhood
        </p>
        <p style="margin: 0 0 12px 0; color: #111827; font-size: 15px; line-height: 1.6;">
          🚨 <strong>Crime &amp; safety alerts</strong>, sourced straight from Philadelphia PD data
        </p>
        <p style="margin: 0 0 12px 0; color: #111827; font-size: 15px; line-height: 1.6;">
          🎨 <strong>New themes</strong> — including Eagles, Sixers, Phillies, and a warm Classic Philly look
        </p>
        <p style="margin: 0; color: #111827; font-size: 15px; line-height: 1.6;">
          🤖 A friendly new mascot to guide you through the app
        </p>
      </div>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        PhillyGrind works best when your actual neighbors are on it — more people means more real job leads, more gigs, a livelier Community feed, and faster help when you need it.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        If PhillyGrind's been useful to you, take 30 seconds to invite a neighbor or friend.
      </p>
      ${inviteCta(inviteUrl)}
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Thanks for being part of the early crew building this with us.
      </p>
      <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
        — The PhillyGrind Team
      </p>
    `,
  });
}

function buildHtmlB(inviteUrl, userId, unsubscribeUrl) {
  return createEmailTemplate({
    subject: SUBJECT_B,
    userId,
    unsubscribeUrl,
    content: `
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Hey there,
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Glad you're part of PhillyGrind! The platform works best when your actual neighbors are on it too — more people means more real job leads, more gigs, a livelier Community feed, and faster help when you need it.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Know a neighbor or friend who'd find this useful? Take 30 seconds to invite them.
      </p>
      ${inviteCta(inviteUrl)}
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Thanks for being here early.
      </p>
      <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
        — The PhillyGrind Team
      </p>
    `,
  });
}

function variantForSignup(createdAt, nowMs) {
  const signedUpAt = createdAt ? new Date(createdAt).getTime() : NaN;
  if (!Number.isFinite(signedUpAt)) return 'A';
  return (nowMs - signedUpAt) > FOURTEEN_DAYS_MS ? 'A' : 'B';
}

async function fetchAllPages(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchAuthUsers(supabase) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) throw error;
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return users;
}

async function fetchBannedIds(supabase) {
  const ids = new Set();
  try {
    const rows = await fetchAllPages(() =>
      supabase
        .from('suspended_users')
        .select('user_id')
        .is('lifted_at', null)
        .or('expires_at.is.null,expires_at.gt.now()'),
    );
    for (const row of rows) ids.add(row.user_id);
    return ids;
  } catch (error) {
    const message = error?.message || String(error);
    if (!/lifted_at|column/i.test(message)) throw error;
    const rows = await fetchAllPages(() =>
      supabase
        .from('suspended_users')
        .select('user_id')
        .or('expires_at.is.null,expires_at.gt.now()'),
    );
    for (const row of rows) ids.add(row.user_id);
    return ids;
  }
}

function requireEnv(name, fallback) {
  const value = process.env[name] || (fallback ? process.env[fallback] : '') || '';
  if (!value) {
    throw new Error(`Missing ${name}${fallback ? ` (or ${fallback})` : ''}.`);
  }
  return value;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (shouldSend && !process.env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY.');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(shouldSend ? 'Mode: SEND' : 'Mode: DRY RUN (pass --send to actually email people)');

  const nowMs = Date.now();
  const [profiles, authUsers, bannedIds] = await Promise.all([
    fetchAllPages(() => supabase.from('profiles').select('id, name, email, unsubscribed, created_at')),
    fetchAuthUsers(supabase),
    fetchBannedIds(supabase),
  ]);

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const recipients = [];
  const seenEmails = new Set();
  let unsubscribedSkipped = 0;

  for (const user of authUsers) {
    if (bannedIds.has(user.id)) continue;
    const profile = profileById.get(user.id);
    if (profile?.unsubscribed === true) {
      unsubscribedSkipped += 1;
      continue;
    }
    const email = String(user.email || profile?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    const createdAt = user.created_at || profile?.created_at || null;
    recipients.push({
      id: user.id,
      email,
      createdAt,
      variant: variantForSignup(createdAt, nowMs),
    });
  }

  for (const profile of profiles) {
    if (profile.unsubscribed === true) {
      if (!seenEmails.has(String(profile.email || '').trim().toLowerCase()) && !profileById.has(profile.id)) {
        unsubscribedSkipped += 1;
      }
      continue;
    }
    if (bannedIds.has(profile.id)) continue;
    const email = String(profile.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || seenEmails.has(email)) continue;
    seenEmails.add(email);
    const createdAt = profile.created_at || null;
    recipients.push({
      id: profile.id,
      email,
      createdAt,
      variant: variantForSignup(createdAt, nowMs),
    });
  }

  let queued = Number.isFinite(limit) && limit > 0 ? recipients.slice(0, limit) : recipients;

  if (onlyEmail) {
    queued = recipients.filter((recipient) => recipient.email === onlyEmail);
    if (!queued.length) {
      queued = [{
        id: null,
        email: onlyEmail,
        createdAt: null,
        variant: 'B',
      }];
      console.log(`--only=${onlyEmail} was not in the user list; sending a one-off test to that address.`);
    }
  }

  const variantA = queued.filter((recipient) => recipient.variant === 'A').length;
  const variantB = queued.filter((recipient) => recipient.variant === 'B').length;

  console.log(`Banned/suspended skipped: ${bannedIds.size}`);
  console.log(`Unsubscribed skipped: ${unsubscribedSkipped}`);
  console.log(`Recipients queued: ${queued.length} of ${recipients.length} (A=${variantA}, B=${variantB})`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let sentA = 0;
  let sentB = 0;
  let failedA = 0;
  let failedB = 0;

  for (const [index, recipient] of queued.entries()) {
    const inviteUrl = getInviteLink(recipient.id, SITE_URL);
    const subject = recipient.variant === 'B' ? SUBJECT_B : SUBJECT_A;
    const unsubscribeUrl = recipient.id ? createUnsubscribeUrl(recipient.id, SITE_URL) : '';
    const html = recipient.variant === 'B'
      ? buildHtmlB(inviteUrl, recipient.id, unsubscribeUrl)
      : buildHtmlA(inviteUrl, recipient.id, unsubscribeUrl);

    if (!shouldSend) {
      console.log(
        `[dry-run] ${index + 1}/${queued.length} variant=${recipient.variant} ${recipient.email} signup=${recipient.createdAt || 'unknown'} invite=${inviteUrl}`,
      );
      skipped += 1;
      continue;
    }

    try {
      const result = await sendEmail({
        to: recipient.email,
        subject,
        html,
        headers: unsubscribeUrl
          ? { 'List-Unsubscribe': `<${unsubscribeUrl}>` }
          : undefined,
      });
      if (result?.skipped) {
        skipped += 1;
        console.log(`[skip] ${recipient.email} — Resend skipped`);
      } else {
        sent += 1;
        if (recipient.variant === 'B') sentB += 1;
        else sentA += 1;
        console.log(`[ok] variant=${recipient.variant} ${recipient.email} id=${result?.id || 'n/a'}`);
      }
    } catch (error) {
      failed += 1;
      if (recipient.variant === 'B') failedB += 1;
      else failedA += 1;
      console.error(`[fail] variant=${recipient.variant} ${recipient.email} — ${error.message || error}`);
    }

    if (index < queued.length - 1) await sleep(DELAY_MS);
  }

  console.log('---');
  console.log(JSON.stringify({
    queued: queued.length,
    variantA,
    variantB,
    sent,
    sentA,
    sentB,
    failed,
    failedA,
    failedB,
    skipped,
    unsubscribedSkipped,
    dryRun: !shouldSend,
  }, null, 2));

  if (shouldSend && failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
