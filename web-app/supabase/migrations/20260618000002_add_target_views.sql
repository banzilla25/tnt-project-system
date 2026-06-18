-- Add target_views column to campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_views int8;

-- Recreate view to include target_creator and target_views
DROP VIEW IF EXISTS vw_campaign_summary;
CREATE OR REPLACE VIEW public.vw_campaign_summary AS
SELECT
  c.id AS campaign_id,
  c.nama AS campaign_name,
  b.nama AS brand_name,
  c.status AS campaign_status,
  c.tipe_campaign,
  c.start_date,
  c.end_date,
  c.target_gmv,
  c.target_video,
  c.target_creator,
  c.target_views,
  c.budget_creator_plafon,
  c.budget_ads_plafon,
  c.vsa_gmv_max,
  c.pic,
  c.assist,
  c.require_client_approval,
  
  -- Calculate tracked creators (only those who are fully approved)
  COUNT(cc.id) AS total_creators,
  
  -- GMV Tracking calculation
  COALESCE(SUM(cc.gmv_organic_legacy + cc.gmv_ads_legacy), 0) AS tracked_creator_gmv,
  
  -- Budget calculations (approximate, since view logic is limited)
  COALESCE(SUM(cc.price), 0) AS used_budget_creator,
  
  -- Total GMV Calculation for Awareness vs Sales
  (
    COALESCE(SUM(cc.gmv_organic_legacy + cc.gmv_ads_legacy), 0)
  ) AS total_gmv_achievement,
  
  -- Calculate Achievement Percentage based on campaign type
  CASE 
    WHEN c.tipe_campaign = 'sales' AND c.target_gmv > 0 THEN 
      ROUND((COALESCE(SUM(cc.gmv_organic_legacy + cc.gmv_ads_legacy), 0) / c.target_gmv::numeric) * 100, 2)
    WHEN c.tipe_campaign = 'awareness' AND c.target_video > 0 THEN 
      ROUND((COUNT(cc.id) / c.target_video::numeric) * 100, 2)
    ELSE 0
  END AS achievement_percentage

FROM campaigns c
LEFT JOIN brands b ON c.brand_id = b.id
LEFT JOIN campaign_creators cc ON c.id = cc.campaign_id AND cc.approval = 'approved' AND (c.require_client_approval = FALSE OR cc.client_approval = 'approved')
GROUP BY c.id, c.nama, b.nama, c.status, c.tipe_campaign, c.start_date, c.end_date, c.target_gmv, c.target_video, c.target_creator, c.target_views, c.budget_creator_plafon, c.budget_ads_plafon, c.vsa_gmv_max, c.pic, c.assist, c.require_client_approval;
