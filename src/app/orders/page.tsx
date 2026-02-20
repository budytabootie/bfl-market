// src/app/orders/page.tsx
import { Card } from '@/components/ui/Card';

export default function OrdersPage() {
  return (
    <Card title="Orders">
      <p className="text-sm text-slate-300">
        Halaman orders masih placeholder di Sprint 0. Data nyata akan dihubungkan
        ke Supabase pada Sprint 2.
      </p>
    </Card>
  );
}