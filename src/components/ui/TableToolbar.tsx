'use client';

import { Input } from './Input';

type FilterOption = { value: string; label: string };

type FilterConfig = {
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
};

type TableToolbarProps = {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  /** @deprecated Use filters instead */
  filterLabel?: string;
  /** @deprecated Use filters instead */
  filterOptions?: FilterOption[];
  /** @deprecated Use filters instead */
  filterValue?: string;
  /** @deprecated Use filters instead */
  onFilterChange?: (v: string) => void;
  filters?: FilterConfig[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
};

export function TableToolbar({
  searchPlaceholder = 'Cari…',
  searchValue,
  onSearchChange,
  filterLabel,
  filterOptions,
  filterValue = '',
  onFilterChange,
  filters,
  totalCount,
  page,
  pageSize,
  onPageChange,
}: TableToolbarProps) {
  const filterList = filters ?? (filterOptions && onFilterChange
    ? [{ label: filterLabel, options: filterOptions, value: filterValue, onChange: onFilterChange }]
    : []);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = (page - 1) * pageSize;
  const to = Math.min(from + pageSize, totalCount);

  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
      <div className="w-full sm:min-w-[180px] sm:max-w-xs">
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="py-2.5 sm:py-2 text-sm min-h-[44px] sm:min-h-0"
        />
      </div>
      {filterList.map((f, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
          {f.label && <span className="text-xs text-slate-500">{f.label}</span>}
          <select
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2.5 sm:py-2 text-sm text-slate-200 min-h-[44px] sm:min-h-0 touch-target"
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      ))}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:ml-auto gap-2 text-xs text-slate-500">
        <span>
          {totalCount === 0 ? '0' : `${from + 1}-${to}`} dari {totalCount}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="touch-target min-h-[44px] rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 sm:px-2 sm:py-1 text-slate-300 hover:bg-slate-700/80 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Prev
          </button>
          <span className="flex items-center px-2 py-2 sm:py-1 text-slate-400">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="touch-target min-h-[44px] rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 sm:px-2 sm:py-1 text-slate-300 hover:bg-slate-700/80 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
