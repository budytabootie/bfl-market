import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    },
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: ok } = await supabaseAuth.rpc('is_superadmin_or_treasurer');
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const { name, username, role_id, discord_id } = body ?? {};

  if (!name || !username || !role_id) {
    return NextResponse.json({ error: 'name, username, role_id required' }, { status: 400 });
  }

  const password = String(Math.floor(100000 + Math.random() * 900000));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  );

  const email = `${String(username).trim().toLowerCase()}@bfl.local`;
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  const uid = authData?.user?.id;
  if (!uid) {
    return NextResponse.json({ error: 'User not created' }, { status: 500 });
  }

  const { error: dbErr } = await supabase.from('users').insert({
    id: uid,
    name: String(name).trim(),
    username: String(username).trim().toLowerCase(),
    role_id,
    discord_id: discord_id || null,
    must_change_password: true,
  });

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const loginUrl = `${siteUrl}/login`;
  const dmMessage = [
    `Akun BFL Market Anda telah dibuat.`,
    ``,
    `**Username:** ${String(username).trim().toLowerCase()}`,
    `**Password:** ${password}`,
    `**Link:** ${loginUrl}`,
  ].join('\n');

  try {
    await fetch(`${siteUrl}/api/discord/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'user_created',
        message: dmMessage,
        discordId: discord_id || undefined,
      }),
    });
  } catch {
    // Silent fail for DM
  }

  return NextResponse.json({ ok: true, id: uid });
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    },
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), userId: null as string | null };
  const { data: ok } = await supabaseAuth.rpc('is_superadmin_or_treasurer');
  if (!ok) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), userId: null as string | null };
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { error: NextResponse.json({ error: 'Service role not configured' }, { status: 500 }), userId: null as string | null };
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  );
  return { supabase, userId: user.id };
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const { id, name, username, role_id, discord_id } = body ?? {};

  if (!id || !name || !username || !role_id) {
    return NextResponse.json({ error: 'id, name, username, role_id required' }, { status: 400 });
  }

  const email = `${String(username).trim().toLowerCase()}@bfl.local`;
  const { error: authErr } = await supabase.auth.admin.updateUserById(id, { email });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

  const { error: dbErr } = await supabase.from('users').update({
    name: String(name).trim(),
    username: String(username).trim().toLowerCase(),
    role_id,
    discord_id: discord_id || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { supabase, userId } = auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (id === userId) return NextResponse.json({ error: 'Tidak dapat menghapus akun sendiri' }, { status: 400 });

  const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('user_id', id);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'User memiliki order, tidak dapat dihapus' }, { status: 400 });
  }

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
