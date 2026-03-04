'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function getCartCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = localStorage.getItem('bfl-cart');
    const entries = stored ? (JSON.parse(stored) as { qty?: number }[]) : [];
    return entries.reduce((s, x) => s + (x.qty ?? 1), 0);
  } catch {
    return 0;
  }
}

export function CartLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getCartCount());
    const handler = () => setCount(getCartCount());
    window.addEventListener('storage', handler);
    window.addEventListener('cart-update', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('cart-update', handler);
    };
  }, []);

  return (
    <Link
      href="/cart"
      className="relative flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/40 px-4 py-2 min-h-[44px] text-sm font-medium text-slate-200 transition-colors hover:border-bfl-primary/40 hover:bg-bfl-primary/10 hover:text-bfl-primary touch-target"
      aria-label={count > 0 ? `Cart: ${count} items` : 'Cart'}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden suppressHydrationWarning>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-bfl-primary px-1.5 text-xs font-bold text-bfl-bg ring-2 ring-bfl-bg">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
