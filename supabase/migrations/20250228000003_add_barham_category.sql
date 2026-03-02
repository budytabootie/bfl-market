-- Add 'barham' (Katalog Barang Haram) category for items like meth, weed, cocaine
ALTER TYPE public.catalog_category ADD VALUE IF NOT EXISTS 'barham';
