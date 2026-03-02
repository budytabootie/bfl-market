import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BFL Market',
  description: 'Tempat Anak BFL beli Prepare an',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-bfl-bg text-slate-100 antialiased">{children}</body>
    </html>
  );
}
