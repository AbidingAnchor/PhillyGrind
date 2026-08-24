/**
 * One-time relaunch email to existing PhillyGrind users.
 *
 * Dry run (lists recipients, sends nothing):
 *   node scripts/send-relaunch-email.js
 *
 * Actually send:
 *   node scripts/send-relaunch-email.js --send
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

const DELAY_MS = 500;
const PAGE_SIZE = 1000;
const SUBJECT = "PhillyGrind isn't a job board anymore — come see what we built";
const SITE_URL = 'https://www.phillygrind.work';

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

function displayName(profileName, authName, email) {
  const raw = String(profileName || authName || '').trim();
  if (raw) return raw;
  const local = String(email || '').split('@')[0];
  return local || 'there';
}

function buildHtml(name) {
  const safeName = escapeHtml(name);
  return createEmailTemplate({
    subject: SUBJECT,
    content: `
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Hey ${safeName},
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Remember PhillyGrind? We heard you — it was just a job board before, and honestly, that wasn't enough.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        So we rebuilt it. PhillyGrind is now a real Philly community platform — post updates, connect with your neighborhood, chat with GrindBot (our AI assistant that actually knows the platform inside and out), and browse local jobs, gigs, and marketplace listings all in one place.
      </p>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        Come take a look: <a href="${SITE_URL}" style="color: #16a34a; font-weight: 600; text-decoration: none;">${SITE_URL.replace('https://', '')}</a>
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
        <tr>
          <td align="center" style="padding: 16px;">
            <a href="${SITE_URL}" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              Come take a look
            </a>
          </td>
        </tr>
      </table>
      <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
        We'd love to hear what you think.
      </p>
      <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
        — The PhillyGrind Team
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
    fetchAllPages(() => supabase.from('profiles').select('id, name, email')),
    fetchAuthUsers(supabase),
    fetchBannedIds(supabase),
  ]);

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const recipients = [];
  const seenEmails = new Set();

  for (const user of authUsers) {
    if (bannedIds.has(user.id)) continue;
    const profile = profileById.get(user.id);
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
  console.log(`Recipients queued: ${queued.length} of ${recipients.length}`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const [index, recipient] of queued.entries()) {
    const html = buildHtml(recipient.name);

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
  console.log(JSON.stringify({ queued: queued.length, sent, failed, skipped, dryRun: !shouldSend }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
