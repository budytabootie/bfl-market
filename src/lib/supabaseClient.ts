// src/lib/supabaseClient.ts
// Backwards-compatible re-export for any legacy imports.
// Prefer importing from:
// - '@/lib/supabase/client'  (client components)
// - '@/lib/supabase/server'  (server components, route handlers, server actions)

import { createClient as createBrowserClient } from './supabase/client';
import { createClient as createServerClient } from './supabase/server';

export const supabaseBrowser = createBrowserClient;
export const supabaseServer = createServerClient;
