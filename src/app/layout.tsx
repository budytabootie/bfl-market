// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export const metadata: Metadata = {
  title: 'BFL-MARKET – GTA RP Dashboard',
  description: 'Dashboard management & ordering untuk server GTA RP BFL.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bfl-bg text-slate-100">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Topbar />
            <main className="flex-1 p-4 md:p-6 bg-gradient-to-br from-bfl-bg via-slate-950 to-bfl-bg">
              <div className="mx-auto max-w-6xl space-y-4">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}