/**
 * Format tanggal/waktu ke WIB (Asia/Jakarta) untuk tampilan di seluruh website.
 * Database tetap menyimpan UTC; konversi hanya saat display.
 */
const TZ = 'Asia/Jakarta';

export function formatDateTimeWIB(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('id-ID', {
    timeZone: TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatDateWIB(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShortWIB(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('id-ID', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Label tanggal untuk grouping (mis. "9 Maret 2026") */
export function formatDateLabelWIB(date: Date | string): string {
  return formatDateWIB(date);
}

/** Part tanggal di WIB (untuk grouping by date) — returns YYYY-MM-DD */
export function getDateKeyWIB(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}
