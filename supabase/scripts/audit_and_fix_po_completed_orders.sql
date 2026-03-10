-- =============================================================================
-- AUDIT: Order completed tapi punya item PO (seharusnya status 'listed')
-- Jalankan query di bawah untuk melihat order yang terdampak.
-- =============================================================================

-- 1) Daftar order: status completed DAN ada minimal 1 order_items dengan is_po = true
SELECT
  o.id AS order_id,
  o.status,
  o.paid_at,
  o.completed_at,
  o.approved_by,
  (SELECT count(*) FROM public.order_items oi WHERE oi.order_id = o.id AND oi.is_po = true) AS po_item_count,
  (SELECT count(*) FROM public.order_items oi WHERE oi.order_id = o.id) AS total_items
FROM public.orders o
WHERE o.status = 'completed'
  AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.is_po = true);

-- 2) Detail item per order tersebut (opsional)
SELECT
  o.id AS order_id,
  oi.id AS order_item_id,
  oi.is_po,
  oi.status AS item_status,
  oi.catalog_id,
  oi.subtotal
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
WHERE o.status = 'completed'
  AND EXISTS (SELECT 1 FROM public.order_items x WHERE x.order_id = o.id AND x.is_po = true)
ORDER BY o.id, oi.is_po DESC, oi.id;

-- =============================================================================
-- 3) AUDIT: Order campuran (PO + reguler) — Total PO vs paid_amount
-- Untuk tracing: pastikan paid_amount hanya men track bayar bagian PO.
-- Order f562b4c0: total semua item 298900, total PO saja 170000; paid 170000 = OK.
-- =============================================================================
SELECT
  o.id AS order_id,
  o.paid_at,
  o.paid_amount,
  (SELECT coalesce(sum(oi.subtotal), 0) FROM public.order_items oi WHERE oi.order_id = o.id AND oi.is_po = true) AS total_po_only,
  (SELECT coalesce(sum(oi.subtotal), 0) FROM public.order_items oi WHERE oi.order_id = o.id) AS total_semua_item,
  (SELECT coalesce(sum(oi.subtotal), 0) FROM public.order_items oi WHERE oi.order_id = o.id AND oi.is_po = true) - coalesce(o.paid_amount, 0) AS sisa_po
FROM public.orders o
WHERE EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.is_po = true)
  AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.is_po = false)
ORDER BY o.id;

-- =============================================================================
-- PERBAIKAN DATA (jalankan HANYA setelah konfirmasi)
-- Efek: order yang "completed + punya item PO" diubah jadi listed, completed_at di-clear.
-- =============================================================================

-- UNCOMMENT dan jalankan di Supabase SQL Editor setelah setuju:

/*
BEGIN;
  UPDATE public.orders
  SET status = 'listed', completed_at = NULL
  WHERE status = 'completed'
    AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = orders.id AND oi.is_po = true);
  -- Cek berapa baris ter-update (harus sesuai jumlah dari audit query #1)
  -- GET DIAGNOSTICS atau lihat result "X rows updated"
COMMIT;
*/

-- =============================================================================
-- 4) AUDIT: Order status masih pending tapi semua item rejected
-- Order seperti ini tidak perlu muncul di Pending Orders (sudah difilter di UI).
-- Opsional: set status = 'cancelled' supaya konsisten.
-- =============================================================================
SELECT
  o.id AS order_id,
  o.status,
  o.created_at,
  (SELECT count(*) FROM public.order_items oi WHERE oi.order_id = o.id) AS total_items,
  (SELECT count(*) FROM public.order_items oi WHERE oi.order_id = o.id AND oi.status = 'rejected') AS rejected_count
FROM public.orders o
WHERE o.status = 'pending'
  AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
  AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.status = 'pending')
  AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.status = 'approved');

-- Opsional perbaikan: set order ke cancelled (jalankan setelah konfirmasi)
/*
UPDATE public.orders o
SET status = 'cancelled'
WHERE o.status = 'pending'
  AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
  AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.status = 'pending')
  AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.status = 'approved');
*/
