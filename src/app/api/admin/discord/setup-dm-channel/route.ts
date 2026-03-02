import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

const DISCORD_API = 'https://discord.com/api/v10';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => {
          c.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: ok } = await supabaseAuth.rpc('is_superadmin');
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'DISCORD_BOT_TOKEN not configured' }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { channelId?: string } | null;
  const channelId = body?.channelId;
  if (!channelId || typeof channelId !== 'string') {
    return NextResponse.json({ error: 'channelId required' }, { status: 400 });
  }

  const message = {
    content:
      '**Aktifkan notifikasi DM**\n\nKlik tombol di bawah agar bot bisa mengirim notifikasi reset password ke DM kamu.',
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: 'Aktifkan DM',
            custom_id: 'aktivasi_dm',
          },
        ],
      },
    ],
  };

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    return NextResponse.json(
      { error: err.message ?? res.statusText },
      { status: res.status >= 400 ? res.status : 500 },
    );
  }

  const data = (await res.json()) as { id: string };
  return NextResponse.json({
    ok: true,
    messageId: data.id,
  });
}
