-- ==========================================
-- PHASE 2: SALES & ADS PERFORMANCE TABLES
-- ==========================================

-- 1. Tabel: sales (Data Organik dari Partner Center)
CREATE TABLE IF NOT EXISTS public.sales (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES public.campaigns(id) ON DELETE CASCADE,
    creator_username TEXT,
    content_uid TEXT,
    sku_id INT REFERENCES public.skus(id) ON DELETE SET NULL,
    product_id TEXT,
    tanggal DATE NOT NULL,
    price BIGINT NOT NULL DEFAULT 0,
    quantity INT DEFAULT 0,
    gmv BIGINT NOT NULL DEFAULT 0,
    is_refund BOOLEAN NOT NULL DEFAULT false,
    content_type TEXT,
    order_id TEXT UNIQUE, -- Deduplikasi: order_id TikTok harus unik
    order_status TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pencarian cepat untuk perhitungan GMV
CREATE INDEX IF NOT EXISTS idx_sales_campaign ON public.sales(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sales_content_uid ON public.sales(content_uid);
CREATE INDEX IF NOT EXISTS idx_sales_creator ON public.sales(creator_username);

-- RLS Sales
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.sales FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.sales FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.sales FOR DELETE USING (true);


-- 2. Tabel: ads_performance (Data Iklan dari Ads Manager)
CREATE TABLE IF NOT EXISTS public.ads_performance (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES public.campaigns(id) ON DELETE CASCADE,
    ad_name TEXT NOT NULL,
    creator_id INT REFERENCES public.creators(id) ON DELETE SET NULL,
    tanggal DATE,
    cost_usd NUMERIC NOT NULL DEFAULT 0,
    gross_revenue_usd NUMERIC NOT NULL DEFAULT 0,
    purchases INT DEFAULT 0,
    kurs NUMERIC NOT NULL DEFAULT 16000, -- Default kurs IDR
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ads_campaign ON public.ads_performance(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ads_creator ON public.ads_performance(creator_id);

-- RLS Ads Performance
ALTER TABLE public.ads_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.ads_performance FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.ads_performance FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.ads_performance FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.ads_performance FOR DELETE USING (true);


-- 3. Tabel: ad_name_mapping (Kamus Pemetaan nama iklan ke creator)
CREATE TABLE IF NOT EXISTS public.ad_name_mapping (
    ad_name TEXT PRIMARY KEY,
    creator_id INT NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Ad Mapping
ALTER TABLE public.ad_name_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.ad_name_mapping FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.ad_name_mapping FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.ad_name_mapping FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.ad_name_mapping FOR DELETE USING (true);
