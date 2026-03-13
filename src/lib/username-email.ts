/**
 * Normalizes string for login: trim, remove control and zero-width chars (dari copy-paste/autocomplete).
 * Tidak mengubah spasi di tengah (penting untuk password). Reduces "kadang berhasil kadang 400".
 */
export function normalizeLoginInput(value: string): string {
  return String(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
    .replace(/[\x00-\x1F\x7F]/g, '') // control characters (termasuk newline \n, \r)
    .replace(/\s+$/g, '')
    .replace(/^\s+/g, '');
}

/** Untuk username saja: setelah normalizeLoginInput, collapse unicode spaces jadi satu spasi lalu lowercase. */
export function normalizeUsernameForLogin(value: string): string {
  return normalizeLoginInput(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Converts a username to a valid Supabase Auth email for BFL local users.
 * Sanitizes so the local part only contains [a-z0-9._-] to avoid "invalid format" errors.
 */
export function usernameToBflEmail(username: string): string {
  const local = String(username)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'user';
  return `${local}@bfl.local`;
}
