// src/components/layout/Sidebar.tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/orders', label: 'Orders' },
  { href: '/catalog', label: 'Catalog' },
  { href: '/players', label: 'Players' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col w-64 border-r border-slate-800/80 bg-gradient-to-b from-bfl-bg to-slate-950/80">
      <div className="px-5 pt-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-2xl bg-gradient-to-tr from-bfl-primary to-bfl-accent shadow-lg" />
          <div>
            <div className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">
              BFL-MARKET
            </div>
            <div className="text-sm text-slate-300">GTA RP Management</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = item.href === '/'
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-bfl-primary/10 text-bfl-primary border border-bfl-primary/40'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent',
              )}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}