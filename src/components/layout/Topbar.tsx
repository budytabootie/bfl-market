// src/components/layout/Topbar.tsx
import { LogoutButton } from '@/components/auth/LogoutButton';

type TopbarProps = { permissions?: string[]; user?: { email?: string } | null; variant?: 'user' | 'admin' };

export async function Topbar({ permissions: permProp = [], user, variant }: TopbarProps) {
  const permissions = permProp.length > 0 ? permProp : [];
  const isUserContext = variant !== undefined ? variant === 'user' : (permissions.length > 0 && !permissions.includes('menu:admin'));

  const username =
    user?.email?.endsWith('@bfl.local')
      ? user.email.replace('@bfl.local', '')
      : user?.email ?? 'Guest';

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-800/80 bg-gradient-to-r from-bfl-bg/80 to-slate-950/70 backdrop-blur">
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
          {isUserContext ? 'Marketplace' : 'Dashboard'}
        </div>
        <div className="text-lg font-semibold text-slate-50">
          {isUserContext ? 'BFL Market' : 'Live GTA RP Operations'}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-flex text-xs text-slate-400">
          Signed in as <span className="ml-1 font-semibold text-slate-200">{username}</span>
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}