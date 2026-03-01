// src/app/api/discord/notify/route.ts
import { NextResponse } from 'next/server';
import { sendDiscordDM } from '@/lib/discord-dm';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.type !== 'string' || typeof body.message !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Invalid payload. Need type and message.' },
      { status: 400 },
    );
  }

  const discordId = body.discordId ? String(body.discordId).trim() : null;
  if (!discordId) {
    return NextResponse.json({ ok: true }); // No Discord ID = skip DM, not an error
  }

  const result = await sendDiscordDM(discordId, body.message);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

