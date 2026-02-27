'use client';

// src/app/global-error.tsx
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-bfl-bg text-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-slate-950/90 p-6 shadow-bfl-card">
          <h1 className="text-lg font-semibold text-red-300">
            Terjadi kesalahan yang tidak terduga
          </h1>
          <p className="mt-2 text-xs text-slate-300">
            Jika masalah berlanjut, hubungi admin dan sertakan waktu kejadian.
          </p>
          <div className="mt-4 flex gap-2 justify-end">
            <button
              type="button"
              className="rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800"
              onClick={() => reset()}
            >
              Coba lagi
            </button>
            <a
              href="/"
              className="rounded-xl bg-bfl-primary px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-bfl-primarySoft"
            >
              Kembali ke Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

