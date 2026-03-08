-- PO system phase 1: status 'listed', paid (order), received (item)
-- See docs/PO-SYSTEM-DESIGN.md

-- 1. Add 'listed' to order_status enum (after approve, before completed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'listed'
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'listed';
  END IF;
END
$$;

-- 2. Orders: paid tracking (order-level)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) DEFAULT 0;

COMMENT ON COLUMN public.orders.paid_at IS 'When order was marked paid (admin). For PO flow.';
COMMENT ON COLUMN public.orders.paid_amount IS 'Amount paid so far. Unpaid = order total - paid_amount.';

-- 3. Order items: ready for receive + received (item-level, for PO)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS ready_for_receive_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz;

COMMENT ON COLUMN public.order_items.ready_for_receive_at IS 'When admin marked item ready/shipped. 24h after this → auto-receive if user did not confirm.';
COMMENT ON COLUMN public.order_items.received_at IS 'When item was received (user confirm or auto after 24h).';
