CREATE TABLE daily_performance (
  id SERIAL PRIMARY KEY,
  campaign_id BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  organic_sales NUMERIC(15,2) DEFAULT 0,
  vsa_sales NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(campaign_id, date)
);

CREATE OR REPLACE VIEW vw_campaign_summary AS
WITH video_stats AS (
  SELECT 
    cc.campaign_id,
    COALESCE(SUM(v.organic_sales_video + v.organic_sales_livestream + v.ads_sales_video + v.ads_sales_livestream), 0) AS tracked_creator_gmv,
    COALESCE(SUM(v.ads_sales_video + v.ads_sales_livestream), 0) AS tracked_ads_sales
  FROM campaign_creators cc
  LEFT JOIN videos v ON cc.id = v.campaign_creator_id
  GROUP BY cc.campaign_id
),
payment_stats AS (
  SELECT 
    cc.campaign_id,
    COALESCE(SUM(p.nominal), 0) AS total_pembayaran_kreator
  FROM campaign_creators cc
  LEFT JOIN pembayaran p ON cc.id = p.campaign_creator_id
  GROUP BY cc.campaign_id
),
daily_stats AS (
  SELECT
    campaign_id,
    COALESCE(SUM(organic_sales), 0) as total_daily_organic,
    COALESCE(SUM(vsa_sales), 0) as total_daily_vsa
  FROM daily_performance
  GROUP BY campaign_id
)
SELECT 
  c.id AS campaign_id,
  c.nama AS campaign_name,
  COALESCE(vs.tracked_creator_gmv, 0) AS tracked_creator_gmv,
  COALESCE(ds.total_daily_organic, 0) AS total_daily_organic,
  COALESCE(ds.total_daily_vsa, 0) AS total_daily_vsa,
  (COALESCE(ds.total_daily_organic, 0) + COALESCE(ds.total_daily_vsa, 0)) AS official_daily_gmv,
  GREATEST((COALESCE(ds.total_daily_organic, 0) + COALESCE(ds.total_daily_vsa, 0)), COALESCE(vs.tracked_creator_gmv, 0)) AS total_gmv,
  COALESCE(ps.total_pembayaran_kreator, 0) AS total_pembayaran_kreator,
  COALESCE(vs.tracked_ads_sales, 0) AS total_ads_spend
FROM campaigns c
LEFT JOIN video_stats vs ON c.id = vs.campaign_id
LEFT JOIN payment_stats ps ON c.id = ps.campaign_id
LEFT JOIN daily_stats ds ON c.id = ds.campaign_id;
