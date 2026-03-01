import { NextResponse } from 'next/server';
import { verifyKey, InteractionType, InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { sendDiscordDM } from '@/lib/discord-dm';

export const runtime = 'nodejs';

const DM_WELCOME = `**DM berhasil diaktifkan!**

Kamu akan menerima notifikasi reset password BFL Market melalui DM ini.`;

export async function POST(request: Request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json({ error: 'DISCORD_PUBLIC_KEY not configured' }, { status: 500 });
  }

  const signature = request.headers.get('X-Signature-Ed25519') ?? '';
  const timestamp = request.headers.get('X-Signature-Timestamp') ?? '';
  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const rawBody = await request.text();
  const isValid = await verifyKey(rawBody, signature, timestamp, publicKey);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as {
    type: number;
    data?: { custom_id?: string };
    member?: { user?: { id: string } };
    user?: { id: string };
  };

  if (body.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  if (body.type === InteractionType.MESSAGE_COMPONENT && body.data?.custom_id === 'aktivasi_dm') {
    const userId = body.member?.user?.id ?? body.user?.id;
    if (!userId) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Gagal: user ID tidak ditemukan.', flags: InteractionResponseFlags.EPHEMERAL },
      });
    }

    const result = await sendDiscordDM(userId, DM_WELCOME);
    if (result.ok) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '✅ DM berhasil diaktifkan! Cek DM kamu—password reset akan dikirim lewat sana.',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }

    const botId = process.env.DISCORD_APPLICATION_ID;
    const fallbackLink = botId ? `https://discord.com/users/${botId}` : null;
    const hint = fallbackLink
      ? `\n\nAlternatif: buka ${fallbackLink} dan kirim pesan apapun ke bot untuk membuka DM.`
      : '';

    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Gagal mengaktifkan DM: ${result.error}\n\nPastikan **Allow direct messages from server members** aktif (User Settings > Privacy & Safety, dan juga klik kanan server ini > Privacy).${hint}`,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    });
  }

  return NextResponse.json({ error: 'Unknown interaction' }, { status: 400 });
}
