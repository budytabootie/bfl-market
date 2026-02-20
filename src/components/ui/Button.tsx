// src/components/ui/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  children: ReactNode;
};

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bfl-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bfl-bg disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-bfl-primary text-slate-950 hover:bg-bfl-primarySoft',
    ghost: 'bg-transparent text-slate-100 hover:bg-slate-800/70',
  };

  return (
    <button className={clsx(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}