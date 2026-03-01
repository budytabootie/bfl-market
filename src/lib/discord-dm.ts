const DISCORD_API = 'https://discord.com/api/v10';

const DISCORD_ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid request (cek format Discord ID harus angka panjang)',
  401: 'Discord token invalid/expired',
  403: 'Tidak bisa DM: user menutup DM dari anggota server atau memblokir bot',
  404: 'User Discord tidak ditemukan',
  50007: 'Cannot send messages to this user (DM ditutup / user blokir bot)',
};

export async function sendDiscordDM(discordId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: 'DISCORD_BOT_TOKEN tidak dikonfigurasi di Vercel' };
  }

  const trimmed = discordId.trim();
  if (!/^\d{17,19}$/.test(trimmed)) {
    return { ok: false, error: 'Discord ID harus angka 17–19 digit (bukan username)' };
  }

  const createChannelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient_id: trimmed }),
  });

  if (!createChannelRes.ok) {
    const createErrData = (await createChannelRes.json().catch(() => ({}))) as { message?: string; code?: number };
    const code = createErrData.code ?? createChannelRes.status;
    const hint =
      DISCORD_ERROR_MESSAGES[code as keyof typeof DISCORD_ERROR_MESSAGES] ??
      createErrData.message ??
      createChannelRes.statusText;
    return { ok: false, error: `${hint} (${createChannelRes.status})` };
  }

  const channel = (await createChannelRes.json()) as { id: string };
  const sendRes = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: message }),
  });

  const sendErrData = (await sendRes.json().catch(() => ({}))) as { message?: string; code?: number };
  if (!sendRes.ok) {
    const code = sendErrData.code ?? sendRes.status;
    const hint =
      DISCORD_ERROR_MESSAGES[code as keyof typeof DISCORD_ERROR_MESSAGES] ??
      sendErrData.message ??
      sendRes.statusText;
    return { ok: false, error: `Kirim: ${hint} (${sendRes.status})` };
  }

  return { ok: true };
}
