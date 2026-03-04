'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { useSidebar } from '@/components/layout/SidebarContext';

type NavItem = { href: string; label: string; permission?: string };

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Admin', permission: 'menu:admin' },
  { href: '/admin/catalog', label: 'Katalog', permission: 'menu:catalog' },
  { href: '/admin/warehouse', label: 'Warehouse', permission: 'menu:warehouse' },
  { href: '/admin/treasury', label: 'Treasury', permission: 'menu:treasury' },
  { href: '/admin/weapons', label: 'Weapons', permission: 'menu:weapons' },
  { href: '/admin/weapon-relations', label: 'Weapon Relations', permission: 'menu:weapons' },
  { href: '/admin/po-products', label: 'Pre Order', permission: 'menu:po' },
  { href: '/admin/orders', label: 'Pending Orders', permission: 'menu:orders' },
  { href: '/admin/orders-history', label: 'Orders History', permission: 'menu:orders-history' },
  { href: '/admin/users', label: 'Users', permission: 'menu:users' },
  { href: '/admin/permissions', label: 'Permissions', permission: 'menu:permissions' },
  { href: '/admin/activity', label: 'Activity Logs', permission: 'menu:activity' },
];

type SidebarAdminProps = { permissions?: string[] };

export function SidebarAdmin({ permissions = [] }: SidebarAdminProps) {
  const pathname = usePathname();
  const { open, setOpen } = useSidebar();
  const visible = NAV_ITEMS.filter((i) => !i.permission || permissions.includes(i.permission));

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const close = () => setOpen(false);

  const navContent = (
    <>
      <div className="px-4 sm:px-5 pt-5 sm:pt-6 pb-4 border-b border-slate-800/80 flex items-center justify-between lg:block">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-2xl bg-linear-to-tr from-bfl-primary to-bfl-accent shadow-lg shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">BFL MARKET</div>
            <div className="text-sm text-slate-300 truncate">Admin Panel</div>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="lg:hidden touch-target flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-800/70 hover:text-white transition-colors -mr-2"
          aria-label="Tutup menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} suppressHydrationWarning>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1">
        {visible.map((item) => {
          const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              className={clsx(
                'flex rounded-xl px-3 py-3 text-sm font-medium transition-colors touch-target min-h-[44px] items-center',
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
            onClick={close}
            className="flex rounded-xl px-3 py-3 text-sm font-medium text-slate-400 hover:bg-slate-800/70 hover:text-white border border-transparent transition-colors min-h-[44px] items-center touch-target"
          >
            ← Ke Marketplace
          </Link>
        </div>
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile: overlay backdrop */}
      <div
        role="presentation"
        className={clsx(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={close}
        aria-hidden
      />
      {/* Sidebar: drawer on mobile, static on desktop */}
      <aside
        className={clsx(
          'flex flex-col w-64 shrink-0 border-r border-slate-800/80 bg-linear-to-b from-bfl-bg to-slate-950/80',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[min(280px,85vw)] max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-200 max-lg:ease-out',
          'max-lg:pt-[env(safe-area-inset-top)] max-lg:pb-[env(safe-area-inset-bottom)] max-lg:pl-[env(safe-area-inset-left)]',
          open ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
