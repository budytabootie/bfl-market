'use client';

import { useRef, useEffect, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from 'react';
import clsx from 'clsx';

type ImageUploadInputProps = {
  value: File | null;
  onChange: (file: File | null) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  accept?: string;
  className?: string;
  disabled?: boolean;
};

function getImageFileFromClipboard(e: ClipboardEvent<HTMLElement>): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      const file = items[i].getAsFile();
      if (file) return file;
    }
  }
  return null;
}

export function ImageUploadInput({
  value,
  onChange,
  inputRef: externalRef,
  accept = 'image/*',
  className,
  disabled,
}: ImageUploadInputProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [value]);

  function handlePaste(e: ClipboardEvent<HTMLElement>) {
    if (disabled) return;
    const file = getImageFileFromClipboard(e);
    if (file) {
      e.preventDefault();
      onChange(file);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    if (disabled) return;
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onChange(file);
    }
  }

  function handleDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  }

  function handleClear() {
    onChange(null);
    const ref = externalRef?.current ?? internalRef.current;
    if (ref) ref.value = '';
  }

  return (
    <div
      tabIndex={0}
      role="button"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          (externalRef?.current ?? internalRef.current)?.click();
        }
      }}
      className={clsx(
        'flex min-h-[80px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-600/80 bg-slate-900/30 px-4 py-3 text-xs text-slate-400 transition-colors',
        'hover:border-slate-500/80 hover:bg-slate-900/50 focus:border-bfl-primary/50 focus:outline-none focus:ring-2 focus:ring-bfl-primary/20',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
      onClick={() => (externalRef?.current ?? internalRef.current)?.click()}
    >
      <input
        ref={externalRef ?? internalRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
        aria-hidden
      />
      {value && previewUrl ? (
        <div className="flex items-center gap-3">
          <img
            src={previewUrl}
            alt="Preview"
            className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-600/50"
          />
          <div>
            <p className="font-medium text-slate-200">{value.name}</p>
            <p className="text-slate-500">{(value.size / 1024).toFixed(1)} KB</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="mt-1 text-bfl-primary hover:underline"
            >
              Ganti / Hapus
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-center">Pilih file atau paste dari clipboard</p>
          <p className="mt-0.5 text-slate-500">Ctrl+V setelah copy gambar</p>
        </>
      )}
    </div>
  );
}
