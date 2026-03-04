// src/components/ui/Card.tsx
import type { ReactNode } from 'react';
import clsx from 'clsx';

type CardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, children, className }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 sm:p-6 shadow-xl shadow-black/20 backdrop-blur-sm',
        'ring-1 ring-slate-700/30',
        className,
      )}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            {title}
          </h2>
        </div>
      )}
      {children}
    </div>
  );
}