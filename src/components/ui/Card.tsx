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
        'rounded-3xl bg-bfl-card/90 border border-slate-800/80 shadow-bfl-card p-5',
        className,
      )}
    >
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            {title}
          </h2>
        </div>
      )}
      {children}
    </div>
  );
}