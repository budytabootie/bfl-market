/**
 * Seed superadmin: username superadmin, password admin123
 * Run: npx tsx scripts/seed-superadmin.ts
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL in .env.local
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

try {
  const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { /* .env.local optional */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const email = 'superadmin@bfl.local';
  const password = 'admin123';

  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);

  let uid: string;
  if (found) {
    uid = found.id;
    console.log('Superadmin user already exists:', uid);
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      console.error('Auth create error:', error);
      process.exit(1);
    }
    uid = created.user!.id;
    console.log('Created superadmin auth user:', uid);
  }

  const { data: role } = await supabase.from('roles').select('id').eq('key', 'superadmin').single();
  if (!role) {
    console.error('Role superadmin not found. Run schema.sql first.');
    process.exit(1);
  }

  const { error: upsertErr } = await supabase.from('users').upsert(
    { id: uid, name: 'Super Admin', username: 'superadmin', role_id: role.id },
    { onConflict: 'id' },
  );
  if (upsertErr) {
    console.error('Users upsert error:', upsertErr);
    process.exit(1);
  }
  console.log('Superadmin ready. Login: superadmin / admin123');
}

main();
