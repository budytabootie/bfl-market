import type { SelectHTMLAttributes } from 'react';
import clsx from 'clsx';

const selectBase =
  'w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 transition-all duration-200 focus:border-bfl-primary/50 focus:outline-none focus:ring-2 focus:ring-bfl-primary/20 cursor-pointer';

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(selectBase, className)} {...props}>
      {children}
    </select>
  );
}
