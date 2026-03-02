import type { SupabaseClient } from '@supabase/supabase-js';

export async function logActivity(
  supabase: SupabaseClient,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Record<string, unknown>
) {
  await supabase.rpc('log_activity', {
    p_action: action,
    p_entity: entity,
    p_entity_id: entityId ?? null,
    p_details: details ? (details as object) : {},
  });
}
