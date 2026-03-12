/**
 * Kategori catalog: yang diperjualbelikan (marketplace/PO) vs hanya untuk inventory/brankas.
 */

/** Kategori yang tampil di marketplace & PO (barang bisa dibeli). */
export const MARKETPLACE_CATEGORIES = ['ammo', 'vest', 'attachment', 'weapon', 'barham'] as const;

/** Kategori hanya untuk pencatatan inventory/brankas (tidak dijual di marketplace). */
export const BRANKAS_ONLY_CATEGORIES = [
  'other',
  'alat_olah_barham',
  'bahan_baku_barham',
  'hasil_kriminal',
] as const;

/** Semua kategori (untuk admin catalog & warehouse). */
export const ALL_CATEGORIES = [...MARKETPLACE_CATEGORIES, ...BRANKAS_ONLY_CATEGORIES] as const;

export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number];
export type BrankasOnlyCategory = (typeof BRANKAS_ONLY_CATEGORIES)[number];
export type CatalogCategory = (typeof ALL_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  ammo: 'Ammo',
  vest: 'Vest',
  attachment: 'Attachment',
  weapon: 'Weapon',
  barham: 'Barham',
  other: 'Lainnya',
  alat_olah_barham: 'Alat olah barham',
  bahan_baku_barham: 'Bahan baku barham',
  hasil_kriminal: 'Hasil kriminal',
};

/** Cek apakah kategori termasuk barang yang diperjualbelikan. */
export function isSellableCategory(category: string): boolean {
  return (MARKETPLACE_CATEGORIES as readonly string[]).includes(category);
}
