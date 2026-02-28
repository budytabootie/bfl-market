import { forwardRef, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';

const fileBase =
  'block w-full cursor-pointer rounded-xl border border-dashed border-slate-600/80 bg-slate-900/30 px-4 py-3 text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-bfl-primary/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-bfl-primary file:transition-colors hover:border-slate-500/80 hover:file:bg-bfl-primary/30';

export const FileInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input type="file" ref={ref} className={clsx(fileBase, className)} {...props} />
  ),
);
FileInput.displayName = 'FileInput';
