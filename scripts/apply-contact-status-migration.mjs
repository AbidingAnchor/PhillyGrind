import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .filter((line) => /^\s*[^#][^=]+=/.test(line))
        .map((line) => {
          const index = line.indexOf('=');
          return [
            line.slice(0, index).trim(),
            line.slice(index + 1).trim().replace(/^['"]|['"]$/g, ''),
          ];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...loadEnvFile('.env'), ...loadEnvFile('.env.local') };
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env / .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const probePayload = {
  name: 'Migration Probe',
  email: 'migration-probe@phillygrind.invalid',
  category: 'general',
  message: 'Temporary row to verify contact_submissions.status constraint (safe to delete).',
  status: 'open',
};

async function probeInsert(label, payload) {
  const { data, error } = await supabase
    .from('contact_submissions')
    .insert(payload)
    .select('id,status')
    .single();

  if (error) {
    console.log(`[probe:${label}] FAILED`, error.message);
    return null;
  }

  console.log(`[probe:${label}] OK`, data);
  await supabase.from('contact_submissions').delete().eq('id', data.id);
  return data;
}

console.log('Checking contact_submissions.status before migration...');
await probeInsert('explicit-open', probePayload);
await probeInsert('omit-status', {
  name: probePayload.name,
  email: probePayload.email,
  category: probePayload.category,
  message: probePayload.message,
});

const sql = readFileSync(
  'supabase/migrations/20260823180000_contact_submissions_status_open.sql',
  'utf8',
);

console.log('\nMigration applied successfully if both probes report OK with status "open".');
