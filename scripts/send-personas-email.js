/**
 * One-time announcement email introducing the Hustle, Sly, and Nettie
 * GrindBot personas to PhillyGrind users who have not unsubscribed.
 *
 * Dry run (lists recipients, sends nothing):
 *   node scripts/send-personas-email.js
 *
 * Actually send:
 *   node scripts/send-personas-email.js --send
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

const DELAY_MS = 500;
const PAGE_SIZE = 1000;
const SUBJECT = 'Meet Hustle, Sly & Nettie — PhillyGrind just got smarter 🤖';
const SITE_URL = 'https://phillygrind.work';

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

function displayName(profileName, authName, email) {
  const raw = String(profileName || authName || '').trim();
  if (raw) return raw;
  const local = String(email || '').split('@')[0];
  return local || 'there';
}

function buildHtml(_name, userId) {
  const unsubscribeUrl = userId ? createUnsubscribeUrl(userId, SITE_URL) : '';
  return createEmailTemplate({
    subject: SUBJECT,
    userId,
    unsubscribeUrl,
    content: `
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Hey neighbor,
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Big update from PhillyGrind — we just launched three new AI assistants built to make the platform easier to use, no matter what you're here for.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        🟠 <strong>Hustle</strong> — your go-to for Jobs &amp; Gigs. Ask about posting work, bidding, pay, or how to land your next gig.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        🔵 <strong>Sly</strong> — your Marketplace &amp; Deals expert. Buying, selling, negotiating — Sly's got you.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        🟢 <strong>Nettie</strong> — here for Community &amp; Safety. Reporting an issue, understanding how PhillyGrind works, or just getting a straight answer — Nettie's on it.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Just click the chat icon in the corner of any page to talk to them — they're fast, friendly, and actually know PhillyGrind inside and out.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        We built PhillyGrind to be Philly's own space — local jobs, gigs, marketplace, and community, without the noise of the big platforms. And it's growing because of neighbors like you.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        If you know someone who'd love it too — a friend looking for gig work, a family member trying to sell something, or just someone who wants a real local community feed — send them our way. The more neighbors, the stronger PhillyGrind gets for everyone.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        👉 <a href="${SITE_URL}" style="color: #16a34a; font-weight: 600; text-decoration: none;">phillygrind.work</a>
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Thanks for being part of this from early on.
      </p>
      <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
        — Drew<br />
        Founder, PhillyGrind
      </p>
    `,
  });
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

  const [profiles, authUsers, bannedIds] = await Promise.all([
    fetchAllPages(() => supabase.from('profiles').select('id, name, email, unsubscribed')),
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
    recipients.push({
      id: user.id,
      email,
      name: displayName(profile?.name, user.user_metadata?.name, email),
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
    recipients.push({
      id: profile.id,
      email,
      name: displayName(profile.name, '', email),
    });
  }

  let queued = Number.isFinite(limit) && limit > 0 ? recipients.slice(0, limit) : recipients;

  if (onlyEmail) {
    queued = recipients.filter((recipient) => recipient.email === onlyEmail);
    if (!queued.length) {
      queued = [{
        id: null,
        email: onlyEmail,
        name: displayName('', '', onlyEmail),
      }];
      console.log(`--only=${onlyEmail} was not in the user list; sending a one-off test to that address.`);
    }
  }

  console.log(`Banned/suspended skipped: ${bannedIds.size}`);
  console.log(`Unsubscribed skipped: ${unsubscribedSkipped}`);
  console.log(`Recipients queued: ${queued.length} of ${recipients.length}`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [index, recipient] of queued.entries()) {
    const html = buildHtml(recipient.name, recipient.id);
    const unsubscribeUrl = recipient.id ? createUnsubscribeUrl(recipient.id, SITE_URL) : '';

    if (!shouldSend) {
      console.log(`[dry-run] ${index + 1}/${queued.length} would send to ${recipient.email} (${recipient.name})`);
      skipped += 1;
      continue;
    }

    try {
      const result = await sendEmail({
        to: recipient.email,
        subject: SUBJECT,
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
        console.log(`[ok] ${recipient.email} id=${result?.id || 'n/a'}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`[fail] ${recipient.email} — ${error.message || error}`);
    }

    if (index < queued.length - 1) await sleep(DELAY_MS);
  }

  console.log('---');
  console.log(JSON.stringify({
    queued: queued.length,
    sent,
    failed,
    skipped,
    unsubscribedSkipped,
    dryRun: !shouldSend,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
