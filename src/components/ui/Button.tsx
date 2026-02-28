// src/components/ui/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'secondary' | 'danger';
  children: ReactNode;
};

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bfl-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bfl-bg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';

  const variants = {
    primary: 'bg-bfl-primary text-slate-950 shadow-lg shadow-bfl-primary/20 hover:bg-bfl-primarySoft hover:shadow-bfl-primary/30',
    ghost: 'bg-transparent text-slate-100 hover:bg-slate-800/70',
    secondary: 'bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 border border-slate-700/80',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40',
  };

  return (
    <button className={clsx(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}