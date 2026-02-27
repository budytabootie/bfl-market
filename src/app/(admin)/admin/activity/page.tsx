'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';

type Log = {
  id: string;
  created_at: string;
  username: string | null;
  role_key: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
};

export default function AdminActivityPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        setLogs((data ?? []) as Log[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  if (loading) return <Card title="Activity Logs"><p className="text-slate-400">Loading…</p></Card>;

  return (
    <Card title="Activity Logs">
      <div className="overflow-x-auto text-xs">
        <table className="w-full">
          <thead>
            <tr className="text-slate-400">
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">Entity</th>
              <th className="p-2 text-left">ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-slate-800">
                <td className="p-2">{new Date(l.created_at).toLocaleString()}</td>
                <td className="p-2">{l.username ?? '-'}</td>
                <td className="p-2 font-mono">{l.action}</td>
                <td className="p-2">{l.entity ?? '-'}</td>
                <td className="p-2">{l.entity_id ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
