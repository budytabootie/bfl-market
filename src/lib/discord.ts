export type DiscordPayload = {
  type: string;
  message: string;
  userId?: string;
  discordId?: string;
  metadata?: Record<string, unknown>;
};

export async function sendDiscordDM(payload: DiscordPayload): Promise<void> {
  try {
    await fetch('/api/discord/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Placeholder: silent fail
  }
}
