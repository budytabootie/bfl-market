'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { useSidebar } from '@/components/layout/SidebarContext';

type NavItem = { href: string; label: string; permission?: string };

const NAV_ITEMS: NavItem[] = [
  { href: '/marketplace', label: 'Marketplace', permission: 'menu:marketplace' },
  { href: '/po', label: 'PO', permission: 'menu:marketplace' },
  { href: '/cart', label: 'Cart', permission: 'menu:marketplace' },
  { href: '/orders', label: 'My Orders', permission: 'menu:my-orders' },
  { href: '/settings', label: 'Settings', permission: 'menu:marketplace' },
];

type SidebarUserProps = { permissions?: string[] };

export function SidebarUser({ permissions = [] }: SidebarUserProps) {
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
            <div className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">GTA RP</div>
            <div className="text-sm text-slate-300 truncate">BFL Market</div>
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
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
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
        {permissions.includes('menu:admin') && (
          <div className="pt-4 mt-4 border-t border-slate-800/80">
            <Link
              href="/admin"
              onClick={close}
              className="flex rounded-xl px-3 py-3 text-sm font-medium text-slate-400 hover:bg-slate-800/70 hover:text-white border border-transparent transition-colors min-h-[44px] items-center touch-target"
            >
              Ke Admin Panel →
            </Link>
          </div>
        )}
      </nav>
    </>
  );

  return (
    <>
      <div
        role="presentation"
        className={clsx(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={close}
        aria-hidden
      />
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
