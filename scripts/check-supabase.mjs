import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  return Object.fromEntries(
    readFileSync('.env', 'utf8')
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
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const result = {};

const columnsByTable = {
  jobs: 'id,user_id,title,category,neighborhood,pay,company,contact,description,created_at',
  gigs: 'id,user_id,title,category,neighborhood,pay,company,contact,description,created_at',
  profiles: 'id,name,email,created_at',
  messages: 'id,sender_id,receiver_id,listing_id,content,created_at',
};

for (const [table, columns] of Object.entries(columnsByTable)) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .limit(3);

  result[table] = error
    ? { ok: false, code: error.code, message: error.message }
    : { ok: true, count: data.length };
}

console.log(JSON.stringify(result, null, 2));
