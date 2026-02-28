'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';

type NavItem = { href: string; label: string; permission?: string };

const NAV_ITEMS: NavItem[] = [
  { href: '/marketplace', label: 'Marketplace', permission: 'menu:marketplace' },
  { href: '/cart', label: 'Cart', permission: 'menu:marketplace' },
  { href: '/orders', label: 'My Orders', permission: 'menu:my-orders' },
  { href: '/settings', label: 'Settings', permission: 'menu:marketplace' },
];

type SidebarUserProps = { permissions?: string[] };

export function SidebarUser({ permissions = [] }: SidebarUserProps) {
  const pathname = usePathname();
  const visible = NAV_ITEMS.filter((i) => !i.permission || permissions.includes(i.permission));

  return (
    <aside className="flex flex-col w-64 shrink-0 border-r border-slate-800/80 bg-linear-to-b from-bfl-bg to-slate-950/80 max-md:w-56">
      <div className="px-5 pt-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-2xl bg-linear-to-tr from-bfl-primary to-bfl-accent shadow-lg" />
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">GTA RP</div>
            <div className="text-sm text-slate-300">BFL Market</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-bfl-primary/10 text-bfl-primary border border-bfl-primary/40' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent',
              )}
            >
              {item.label}
            </Link>
          );
        })}
        {permissions.includes('menu:admin') && (
          <div className="pt-4 mt-4 border-t border-slate-800/80">
            <Link
              href="/admin"
              className="flex rounded-xl px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/70 hover:text-white border border-transparent transition-colors"
            >
              Ke Admin Panel →
            </Link>
          </div>
        )}
      </nav>
    </aside>
  );
}
