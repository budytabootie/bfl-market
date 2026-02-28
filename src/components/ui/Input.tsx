import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

const inputBase =
  'w-full rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-all duration-200 focus:border-bfl-primary/50 focus:outline-none focus:ring-2 focus:ring-bfl-primary/20';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(inputBase, className)} {...props} />;
}
