-- ====================================================================
-- PHASE 2 EXTENSION: MENGUBAH DAILY_PERFORMANCE MENJADI VIEW OTOMATIS
-- ====================================================================

-- 1. Drop view yang bergantung pada daily_performance
DROP VIEW IF EXISTS public.vw_campaign_summary;

-- 2. Drop tabel daily_performance (karena sekarang akan diganti menjadi VIEW yang membaca data Excel)
DROP TABLE IF EXISTS public.daily_performance;

-- 3. Buat VIEW daily_performance yang otomatis menjumlahkan sales dan ads_performance
CREATE OR REPLACE VIEW public.daily_performance AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY COALESCE(s.tanggal, a.tanggal) DESC) AS id,
  COALESCE(s.campaign_id, a.campaign_id) AS campaign_id,
  COALESCE(s.tanggal, a.tanggal) AS date,
  COALESCE(s.organic_sales, 0) AS organic_sales,
  COALESCE(a.vsa_sales, 0) AS vsa_sales,
  NOW() AS created_at
FROM (
  SELECT campaign_id, tanggal, SUM(gmv) as organic_sales
  FROM public.sales
  WHERE is_refund = false
  GROUP BY campaign_id, tanggal
) s
FULL OUTER JOIN (
  SELECT campaign_id, tanggal, SUM(gross_revenue_usd * kurs) as vsa_sales
  FROM public.ads_performance
  GROUP BY campaign_id, tanggal
) a ON s.campaign_id = a.campaign_id AND s.tanggal = a.tanggal;

-- 4. Recreate vw_campaign_summary (Sama persis dengan sebelumnya, agar Dashboard tetap berjalan)
CREATE OR REPLACE VIEW public.vw_campaign_summary AS
WITH video_stats AS (
  SELECT 
    cc.campaign_id,
    COUNT(v.id) as total_video_tayang
  FROM public.campaign_creators cc
  LEFT JOIN public.videos v ON cc.id = v.campaign_creator_id
  WHERE v.link_video IS NOT NULL
  GROUP BY cc.campaign_id
),
creator_gmv_stats AS (
  SELECT
    campaign_id,
    COALESCE(SUM(gmv_organic_legacy + gmv_ads_legacy), 0) AS tracked_creator_gmv,
    COALESCE(SUM(gmv_ads_legacy), 0) AS tracked_ads_sales
  FROM public.campaign_creators
  GROUP BY campaign_id
),
payment_stats AS (
  SELECT 
    cc.campaign_id,
    COALESCE(SUM(p.pelunasan), 0) AS total_pembayaran_kreator
  FROM public.campaign_creators cc
  LEFT JOIN public.creator_payments p ON cc.id = p.campaign_creator_id
  GROUP BY cc.campaign_id
),
daily_stats AS (
  SELECT
    campaign_id,
    COALESCE(SUM(organic_sales), 0) as total_daily_organic,
    COALESCE(SUM(vsa_sales), 0) as total_daily_vsa
  FROM public.daily_performance
  GROUP BY campaign_id
),
creators_count AS (
  SELECT 
    campaign_id,
    COUNT(id) as total_creator_approved
  FROM public.campaign_creators
  WHERE approval IN ('approved', 'alternate')
  GROUP BY campaign_id
)
SELECT 
  c.id AS campaign_id,
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
  COALESCE(cgs.tracked_creator_gmv, 0) AS tracked_creator_gmv,
  COALESCE(ds.total_daily_organic, 0) AS total_daily_organic,
  COALESCE(ds.total_daily_vsa, 0) AS total_daily_vsa,
  (COALESCE(ds.total_daily_organic, 0) + COALESCE(ds.total_daily_vsa, 0)) AS official_daily_gmv,
  GREATEST((COALESCE(ds.total_daily_organic, 0) + COALESCE(ds.total_daily_vsa, 0)), COALESCE(cgs.tracked_creator_gmv, 0)) AS total_gmv_achievement,
  COALESCE(vs.total_video_tayang, 0) AS achievement_video,
  COALESCE(cc_count.total_creator_approved, 0) AS achievement_creator,
  COALESCE(cgs.tracked_ads_sales, 0) AS budget_ads_terpakai,
  c.budget_ads_plafon - COALESCE(cgs.tracked_ads_sales, 0) AS sisa_budget_ads,
  COALESCE(ps.total_pembayaran_kreator, 0) AS total_pembayaran_kreator
FROM public.campaigns c
LEFT JOIN creator_gmv_stats cgs ON c.id = cgs.campaign_id
LEFT JOIN video_stats vs ON c.id = vs.campaign_id
LEFT JOIN payment_stats ps ON c.id = ps.campaign_id
LEFT JOIN daily_stats ds ON c.id = ds.campaign_id
LEFT JOIN creators_count cc_count ON c.id = cc_count.campaign_id;
