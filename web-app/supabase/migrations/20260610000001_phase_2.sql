-- Fase 2 Schema Migration: Sales Import & Dashboard

-- skus
CREATE TABLE skus (
    id serial PRIMARY KEY,
    campaign_id int NOT NULL REFERENCES campaigns(id),
    link_gmv_max text,
    nama_produk text NOT NULL,
    product_id text NOT NULL,
    satuan_bundle text,
    link_tap text,
    commission numeric,
    UNIQUE(campaign_id, product_id)
);

CREATE INDEX idx_skus_product ON skus(product_id);

-- sales (Organic)
CREATE TABLE sales (
    id serial PRIMARY KEY,
    campaign_id int NOT NULL REFERENCES campaigns(id),
    creator_username text,
    content_uid text,
    sku_id int REFERENCES skus(id),
    product_id text,
    tanggal date NOT NULL,
    price bigint NOT NULL,
    quantity int,
    gmv bigint NOT NULL,
    is_refund boolean NOT NULL,
    content_type text,
    order_id text UNIQUE,
    order_status text,
    raw_data jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_campaign ON sales(campaign_id);
CREATE INDEX idx_sales_creator ON sales(creator_username);
CREATE INDEX idx_sales_content ON sales(content_uid);
CREATE INDEX idx_sales_sku ON sales(sku_id);
CREATE INDEX idx_sales_tanggal ON sales(tanggal);
CREATE INDEX idx_sales_type ON sales(content_type);

-- ads_performance (Ads)
CREATE TABLE ads_performance (
    id serial PRIMARY KEY,
    campaign_id int NOT NULL REFERENCES campaigns(id),
    ad_name text NOT NULL,
    creator_id int REFERENCES creators(id),
    tanggal date,
    cost_usd numeric NOT NULL,
    gross_revenue_usd numeric NOT NULL,
    purchases int,
    kurs numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ads_campaign ON ads_performance(campaign_id);
CREATE INDEX idx_ads_creator ON ads_performance(creator_id);

-- ads_name_mappings (Pemetaan nama ad ke creator agar diingat app)
CREATE TABLE ads_name_mappings (
    ad_name text PRIMARY KEY,
    creator_id int NOT NULL REFERENCES creators(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-----------------------------------------
-- VIEWS (Dashboard & GMV)
-----------------------------------------

-- View for Campaign Summary (Achievement)
CREATE OR REPLACE VIEW vw_campaign_summary AS
WITH organic_sales AS (
    SELECT 
        campaign_id,
        SUM(gmv) as total_organic_gmv
    FROM sales
    WHERE is_refund = false
    GROUP BY campaign_id
),
ads_sales AS (
    SELECT 
        campaign_id,
        SUM(gross_revenue_usd * kurs) as total_ads_gmv_idr,
        SUM(cost_usd * kurs) as total_ads_cost_idr
    FROM ads_performance
    GROUP BY campaign_id
),
videos_count AS (
    SELECT 
        cc.campaign_id,
        COUNT(v.id) as total_video_tayang
    FROM videos v
    JOIN campaign_creators cc ON v.campaign_creator_id = cc.id
    WHERE v.link_video IS NOT NULL
    GROUP BY cc.campaign_id
),
creators_count AS (
    SELECT 
        campaign_id,
        COUNT(id) as total_creator_approved
    FROM campaign_creators
    WHERE approval = 'approved'
    GROUP BY campaign_id
),
legacy_gmv AS (
    SELECT 
        campaign_id,
        SUM(COALESCE(gmv_organic_legacy, 0) + COALESCE(gmv_ads_legacy, 0)) as total_legacy_gmv
    FROM campaign_creators
    GROUP BY campaign_id
)
SELECT 
    c.id as campaign_id,
    c.nama,
    c.tipe_campaign,
    c.status,
    c.start_date,
    c.end_date,
    c.target_gmv,
    c.target_video,
    c.target_creator,
    c.budget_creator_plafon,
    c.budget_ads_plafon,
    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) + COALESCE(l.total_legacy_gmv, 0) as total_gmv_achievement,
    COALESCE(v.total_video_tayang, 0) as achievement_video,
    COALESCE(cr.total_creator_approved, 0) as achievement_creator,
    COALESCE(a.total_ads_cost_idr, 0) as budget_ads_terpakai,
    -- Formula Sisa Budget Ads: plafon - (topup_ads_spends + ads_cost). Untuk Fase 2, kita asumsikan ads_cost langsung mengurangi plafon karena topup_ads_spends ada di Fase 3.
    c.budget_ads_plafon - COALESCE(a.total_ads_cost_idr, 0) as sisa_budget_ads
FROM campaigns c
LEFT JOIN organic_sales o ON c.id = o.campaign_id
LEFT JOIN ads_sales a ON c.id = a.campaign_id
LEFT JOIN videos_count v ON c.id = v.campaign_id
LEFT JOIN creators_count cr ON c.id = cr.campaign_id
LEFT JOIN legacy_gmv l ON c.id = l.campaign_id;
