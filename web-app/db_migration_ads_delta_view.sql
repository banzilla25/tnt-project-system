CREATE OR REPLACE VIEW ads_performance_delta AS
SELECT 
    ap.id,
    ap.ad_id,
    ap.ad_name,
    ap.tanggal,
    ap.campaign_id,
    ap.campaign_ads_name,
    ap.creator_id,
    ap.kurs,
    ap.created_at,
    ap.cost_usd as lifetime_cost_usd,
    ap.gross_revenue_usd as lifetime_gross_revenue_usd,
    ap.purchases as lifetime_purchases,
    ap.impressions as lifetime_impressions,
    ap.clicks as lifetime_clicks,
    ap.product_page_views as lifetime_product_page_views,
    ap.checkouts_initiated as lifetime_checkouts_initiated,
    ap.items_purchased as lifetime_items_purchased,
    ap.video_views as lifetime_video_views,
    ap.vsa_gmv as lifetime_vsa_gmv,
    
    COALESCE(ap.cost_usd - LAG(ap.cost_usd) OVER w, ap.cost_usd) as delta_cost_usd,
    COALESCE(ap.gross_revenue_usd - LAG(ap.gross_revenue_usd) OVER w, ap.gross_revenue_usd) as delta_gross_revenue_usd,
    COALESCE(ap.purchases - LAG(ap.purchases) OVER w, ap.purchases) as delta_purchases,
    COALESCE(ap.impressions - LAG(ap.impressions) OVER w, ap.impressions) as delta_impressions,
    COALESCE(ap.clicks - LAG(ap.clicks) OVER w, ap.clicks) as delta_clicks,
    COALESCE(ap.product_page_views - LAG(ap.product_page_views) OVER w, ap.product_page_views) as delta_product_page_views,
    COALESCE(ap.checkouts_initiated - LAG(ap.checkouts_initiated) OVER w, ap.checkouts_initiated) as delta_checkouts_initiated,
    COALESCE(ap.items_purchased - LAG(ap.items_purchased) OVER w, ap.items_purchased) as delta_items_purchased,
    COALESCE(ap.video_views - LAG(ap.video_views) OVER w, ap.video_views) as delta_video_views,
    COALESCE(ap.vsa_gmv - LAG(ap.vsa_gmv) OVER w, ap.vsa_gmv) as delta_vsa_gmv
FROM ads_performance ap
WINDOW w AS (PARTITION BY ap.ad_id ORDER BY ap.tanggal ASC, ap.created_at ASC);
