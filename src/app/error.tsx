'use client';

// src/app/error.tsx

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-slate-950/90 p-6 shadow-bfl-card">
        <h1 className="text-lg font-semibold text-red-300">
          Oops, halaman ini error
        </h1>
        <p className="mt-2 text-xs text-slate-300">
          {error.message || 'Terjadi kesalahan tak terduga pada halaman ini.'}
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
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

