import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_PATHS = ['/login'];
const ADMIN_PATHS = ['/admin'];
const USER_PANEL_PATHS = ['/marketplace', '/cart', '/checkout', '/orders', '/settings'];

const CHANGE_PASSWORD_PATH = '/change-password';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user, permissions, mustChangePassword } = await updateSession(request);

  if (pathname === CHANGE_PASSWORD_PATH) {
    if (!user) {
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', CHANGE_PASSWORD_PATH);
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (user && mustChangePassword) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url));
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (user && pathname === '/login') {
      if (permissions.includes('menu:admin')) {
        const res = NextResponse.redirect(new URL('/choose-panel', request.url));
        res.cookies.set('bfl-can-admin', '1', { path: '/', maxAge: 60 });
        return res;
      }
      return NextResponse.redirect(new URL('/marketplace', request.url));
    }
    return response;
  }

  if (!user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isUserPath = USER_PANEL_PATHS.some((p) => pathname.startsWith(p)) || pathname === '/';

  if (isAdminPath) {
    if (!permissions.includes('menu:admin')) {
      return NextResponse.redirect(new URL('/choose-panel', request.url));
    }
  }

  if (pathname === '/') {
    if (permissions.includes('menu:admin')) {
      const res = NextResponse.redirect(new URL('/choose-panel', request.url));
      res.cookies.set('bfl-can-admin', '1', { path: '/', maxAge: 60 });
      return res;
    }
    return NextResponse.redirect(new URL('/marketplace', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
