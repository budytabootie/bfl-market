// src/components/layout/Topbar.tsx
import { Button } from '../ui/Button';

export function Topbar() {
  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-800/80 bg-gradient-to-r from-bfl-bg/80 to-slate-950/70 backdrop-blur">
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
          Dashboard
        </div>
        <div className="text-lg font-semibold text-slate-50">
          Live GTA RP Operations
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-flex text-xs text-slate-400">
          Sprint 0 · Setup Only
        </span>
        <Button variant="ghost" className="text-xs px-3 py-1.5">
          Dummy User
        </Button>
      </div>
    </header>
  );
}