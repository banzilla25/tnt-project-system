ALTER TABLE public.videos ADD COLUMN sku_id int4 REFERENCES public.skus(id) ON DELETE SET NULL;
