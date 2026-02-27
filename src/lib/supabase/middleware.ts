// src/lib/supabase/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local',
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const { data: { user } } = await supabase.auth.getUser();
  let permissions: string[] = [];
  let mustChangePassword = false;
  if (user) {
    try {
      const r = await supabase.rpc('current_user_permissions');
      permissions = (r.data ?? []) as string[];
      const { data: profile } = await supabase.from('users').select('must_change_password').eq('id', user.id).single();
      mustChangePassword = Boolean(profile?.must_change_password);
    } catch {
      permissions = [];
    }
  }

  const outgoingHeaders = new Headers(request.headers);
  if (user?.email) outgoingHeaders.set('x-bfl-user-email', user.email);
  if (permissions.length > 0) outgoingHeaders.set('x-bfl-permissions', JSON.stringify(permissions));
  const finalResponse = NextResponse.next({
    request: { headers: outgoingHeaders },
  });
  response.cookies.getAll().forEach((c) => {
    finalResponse.cookies.set(c.name, c.value, { path: '/' });
  });

  return { response: finalResponse, user, permissions, mustChangePassword };
}

