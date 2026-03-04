import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BFL Market',
  description: 'Tempat Anak BFL beli Prepare an',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className="scroll-smooth">
      <body className="min-h-dvh bg-bfl-bg text-slate-100 antialiased safe-area-inset">{children}</body>
    </html>
  );
}
