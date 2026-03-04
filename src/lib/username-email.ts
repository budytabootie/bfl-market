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
