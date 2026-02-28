import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
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
  const { id } = body ?? {};
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  );

  const { data: userRow, error: fetchErr } = await supabase
    .from('users')
    .select('id, username, discord_id')
    .eq('id', id)
    .single();

  if (fetchErr || !userRow) {
    return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
  }

  const newPassword = String(Math.floor(100000 + Math.random() * 900000));

  const { error: authErr } = await supabase.auth.admin.updateUserById(id, { password: newPassword });
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  await supabase.from('users').update({ must_change_password: true, updated_at: new Date().toISOString() }).eq('id', id);

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const loginUrl = `${siteUrl}/login`;
  const dmMessage = [
    `Password BFL Market Anda telah direset.`,
    ``,
    `**Username:** ${(userRow.username as string) ?? ''}`,
    `**Password baru:** ${newPassword}`,
    `**Link:** ${loginUrl}`,
  ].join('\n');

  let dmSent = false;
  let dmError: string | undefined;
  const discordId = (userRow.discord_id as string) || undefined;
  if (discordId) {
    try {
      const notifyRes = await fetch(`${siteUrl}/api/discord/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'password_reset',
          message: dmMessage,
          discordId,
        }),
      });
      const notifyData = (await notifyRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      dmSent = notifyRes.ok && notifyData.ok === true;
      if (!dmSent) dmError = notifyData.error ?? 'Discord DM gagal';
    } catch (err) {
      dmError = err instanceof Error ? err.message : 'Gagal mengirim DM';
    }
  }

  return NextResponse.json({ ok: true, dmSent, dmError });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
