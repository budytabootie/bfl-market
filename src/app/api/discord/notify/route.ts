// src/app/api/discord/notify/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DISCORD_API = 'https://discord.com/api/v10';

async function sendDiscordDM(discordId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: 'DISCORD_BOT_TOKEN not configured' };
  }

  const createChannelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient_id: discordId }),
  });

  if (!createChannelRes.ok) {
    const errData = await createChannelRes.json().catch(() => ({}));
    return { ok: false, error: `Discord: ${(errData as { message?: string }).message ?? createChannelRes.statusText}` };
  }

  const channel = (await createChannelRes.json()) as { id: string };
  const sendRes = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: message }),
  });

  if (!sendRes.ok) {
    const errData = await sendRes.json().catch(() => ({}));
    return { ok: false, error: `Discord send: ${(errData as { message?: string }).message ?? sendRes.statusText}` };
  }

  return { ok: true };
}

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

