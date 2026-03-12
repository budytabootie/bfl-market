// src/lib/supabase/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const SESSION_MAX_AGE_SEC = 60 * 60 * 24; // 24 jam

const COOKIE_DEFAULTS: CookieOptions = {
  path: '/',
  maxAge: SESSION_MAX_AGE_SEC,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
};

export async function updateSession(request: NextRequest) {
  const cookieStore = new Map<string, CookieOptions>();
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
        cookieStore.set(name, { ...COOKIE_DEFAULTS, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...COOKIE_DEFAULTS, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set(name, { ...COOKIE_DEFAULTS, ...options, maxAge: 0 });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: '', ...COOKIE_DEFAULTS, ...options, maxAge: 0 });
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
    const opts = cookieStore.get(c.name) ?? COOKIE_DEFAULTS;
    finalResponse.cookies.set(c.name, c.value, opts);
  });

  return { response: finalResponse, user, permissions, mustChangePassword };
}

