// src/app/page.tsx
import { Card } from '@/components/ui/Card';

export default function OverviewPage() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Online Players">
          <p className="text-3xl font-semibold text-slate-50">0</p>
          <p className="text-xs text-slate-400 mt-1">
            Integrasi status live akan dibuat di sprint selanjutnya.
          </p>
        </Card>
        <Card title="Active Orders">
          <p className="text-3xl font-semibold text-slate-50">0</p>
          <p className="text-xs text-slate-400 mt-1">
            Pipeline order real akan dihubungkan ke Supabase.
          </p>
        </Card>
        <Card title="Revenue (Today)">
          <p className="text-3xl font-semibold text-emerald-400">$0</p>
          <p className="text-xs text-slate-400 mt-1">
            Dummy metrics, nanti diisi dari tabel orders.
          </p>
        </Card>
      </div>

      <Card title="Operations Timeline" className="mt-4">
        <ul className="space-y-2 text-sm text-slate-300">
          <li>• Sprint 0: Setup project & UI shell (saat ini).</li>
          <li>• Sprint 1: Supabase schema & auth.</li>
          <li>• Sprint 2: Ordering flow (catalog & orders).</li>
          <li>• Sprint 3: Advanced dashboard & GTA RP hooks.</li>
        </ul>
      </Card>
    </div>
  );
}