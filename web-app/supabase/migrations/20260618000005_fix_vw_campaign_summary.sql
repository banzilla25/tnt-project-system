CREATE OR REPLACE VIEW vw_campaign_summary AS
WITH organic_sales AS (
    SELECT campaign_id, SUM(gmv) as total_organic_gmv FROM sales WHERE is_refund = false GROUP BY campaign_id
),
ads_sales AS (
    SELECT campaign_id, SUM(gross_revenue_usd * kurs) as total_ads_gmv_idr, SUM(cost_usd * kurs) as total_ads_cost_idr FROM ads_performance GROUP BY campaign_id
),
videos_count AS (
    SELECT cc.campaign_id, COUNT(v.id) as total_video_tayang FROM videos v JOIN campaign_creators cc ON v.campaign_creator_id = cc.id WHERE v.link_video IS NOT NULL GROUP BY cc.campaign_id
),
creators_count AS (
    SELECT campaign_id, COUNT(id) as total_creator_approved FROM campaign_creators WHERE approval = 'approved' GROUP BY campaign_id
),
legacy_gmv AS (
    SELECT campaign_id, SUM(COALESCE(gmv_organic_legacy, 0) + COALESCE(gmv_ads_legacy, 0)) as total_legacy_gmv FROM campaign_creators GROUP BY campaign_id
),
payment_stats AS (
  SELECT campaign_id, COALESCE(SUM(nominal_pelunasan), 0) AS total_pembayaran_kreator FROM campaign_creators GROUP BY campaign_id
),
daily_stats AS (
  SELECT campaign_id, COALESCE(SUM(organic_sales), 0) as total_daily_organic, COALESCE(SUM(vsa_sales), 0) as total_daily_vsa FROM daily_performance GROUP BY campaign_id
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
    
    -- Phase 2 stats
    COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) + COALESCE(l.total_legacy_gmv, 0) as total_gmv_achievement,
    COALESCE(vc.total_video_tayang, 0) as achievement_video,
    COALESCE(cr.total_creator_approved, 0) as achievement_creator,
    COALESCE(a.total_ads_cost_idr, 0) as budget_ads_terpakai,
    c.budget_ads_plafon - COALESCE(a.total_ads_cost_idr, 0) as sisa_budget_ads,
    
    -- Phase 5 stats
    (COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) + COALESCE(l.total_legacy_gmv, 0)) AS tracked_creator_gmv,
    COALESCE(ds.total_daily_organic, 0) AS total_daily_organic,
    COALESCE(ds.total_daily_vsa, 0) AS total_daily_vsa,
    (COALESCE(ds.total_daily_organic, 0) + COALESCE(ds.total_daily_vsa, 0)) AS official_daily_gmv,
    GREATEST(
        (COALESCE(ds.total_daily_organic, 0) + COALESCE(ds.total_daily_vsa, 0)), 
        (COALESCE(o.total_organic_gmv, 0) + COALESCE(a.total_ads_gmv_idr, 0) + COALESCE(l.total_legacy_gmv, 0))
    ) AS total_gmv,
    COALESCE(ps.total_pembayaran_kreator, 0) AS total_pembayaran_kreator,
    COALESCE(a.total_ads_cost_idr, 0) AS total_ads_spend
FROM campaigns c
LEFT JOIN organic_sales o ON c.id = o.campaign_id
LEFT JOIN ads_sales a ON c.id = a.campaign_id
LEFT JOIN videos_count vc ON c.id = vc.campaign_id
LEFT JOIN creators_count cr ON c.id = cr.campaign_id
LEFT JOIN legacy_gmv l ON c.id = l.campaign_id
LEFT JOIN payment_stats ps ON c.id = ps.campaign_id
LEFT JOIN daily_stats ds ON c.id = ds.campaign_id;
