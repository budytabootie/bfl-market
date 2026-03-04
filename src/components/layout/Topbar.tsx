'use client';

import { LogoutButton } from '@/components/auth/LogoutButton';
import { CartLink } from '@/components/layout/CartLink';
import { useSidebar } from '@/components/layout/SidebarContext';

type TopbarProps = { permissions?: string[]; user?: { email?: string; name?: string } | null; variant?: 'user' | 'admin' };

export function Topbar({ permissions: permProp = [], user, variant }: TopbarProps) {
  const permissions = permProp.length > 0 ? permProp : [];
  const { toggle } = useSidebar();
  const isUserContext = variant !== undefined ? variant === 'user' : (permissions.length > 0 && !permissions.includes('menu:admin'));

  const displayName =
    user?.name ??
    (user?.email?.endsWith('@bfl.local') ? user.email.replace('@bfl.local', '') : user?.email) ??
    'Guest';

  return (
    <header className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-slate-800/80 bg-linear-to-r from-bfl-bg/80 to-slate-950/70 backdrop-blur shrink-0 pl-[max(0.75rem,env(safe-area-inset-left))]">
      <button
        type="button"
        onClick={toggle}
        className="lg:hidden touch-target flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-800/70 hover:text-white transition-colors -ml-1"
        aria-label="Buka menu navigasi"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} suppressHydrationWarning>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.28em] text-slate-500 truncate">
          {isUserContext ? 'Marketplace' : 'Dashboard'}
        </div>
        <div className="text-base sm:text-lg font-semibold text-slate-50 truncate">
          {isUserContext ? 'BFL Market' : 'Management Data Operations'}
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {isUserContext && <CartLink />}
        <span className="hidden sm:inline-flex text-xs text-slate-400">
          Signed in as <span className="ml-1 font-semibold text-slate-200 truncate max-w-[120px] md:max-w-none">{displayName}</span>
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}