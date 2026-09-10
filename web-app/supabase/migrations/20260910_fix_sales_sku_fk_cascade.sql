-- Migration: Alter foreign key constraint on sales.sku_id to ON DELETE SET NULL
-- This prevents 23503 foreign key constraint errors when deleting SKUs.

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_sku_id_fkey;
ALTER TABLE public.sales ADD CONSTRAINT sales_sku_id_fkey FOREIGN KEY (sku_id) REFERENCES public.skus(id) ON DELETE SET NULL;
