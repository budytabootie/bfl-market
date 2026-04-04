import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Uses permissions from middleware (`x-bfl-permissions`) when present to avoid
 * a duplicate `current_user_permissions` RPC on every layout render.
 */
export async function getCurrentUserPermissionsCached(
  supabase: SupabaseClient,
): Promise<string[]> {
  const h = await headers();
  const raw = h.get('x-bfl-permissions');
  if (raw) {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p) && p.every((x) => typeof x === 'string')) return p;
    } catch {
      /* fall through */
    }
  }
  const { data: perms } = await supabase.rpc('current_user_permissions');
  return (perms as string[]) ?? [];
}
