'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';

type NavItem = { href: string; label: string; permission?: string };

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Admin', permission: 'menu:admin' },
  { href: '/admin/catalog', label: 'Katalog', permission: 'menu:catalog' },
  { href: '/admin/warehouse', label: 'Warehouse', permission: 'menu:warehouse' },
  { href: '/admin/weapons', label: 'Weapons', permission: 'menu:weapons' },
  { href: '/admin/weapon-relations', label: 'Weapon Relations', permission: 'menu:weapons' },
  { href: '/admin/orders', label: 'Pending Orders', permission: 'menu:orders' },
  { href: '/admin/users', label: 'Users', permission: 'menu:users' },
  { href: '/admin/permissions', label: 'Permissions', permission: 'menu:permissions' },
  { href: '/admin/activity', label: 'Activity Logs', permission: 'menu:activity' },
];

type SidebarAdminProps = { permissions?: string[] };

export function SidebarAdmin({ permissions = [] }: SidebarAdminProps) {
  const pathname = usePathname();
  const visible = NAV_ITEMS.filter((i) => !i.permission || permissions.includes(i.permission));

  return (
    <aside className="flex flex-col w-64 shrink-0 border-r border-slate-800/80 bg-gradient-to-b from-bfl-bg to-slate-950/80 max-md:w-56">
      <div className="px-5 pt-6 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-2xl bg-gradient-to-tr from-bfl-primary to-bfl-accent shadow-lg" />
          <div>
            <div className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">GTA RP</div>
            <div className="text-sm text-slate-300">Admin Panel</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visible.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
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
        <div className="pt-4 mt-4 border-t border-slate-800/80">
          <Link
            href="/marketplace"
            className="flex rounded-xl px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/70 hover:text-white border border-transparent transition-colors"
          >
            ← Ke Marketplace
          </Link>
        </div>
      </nav>
    </aside>
  );
}
