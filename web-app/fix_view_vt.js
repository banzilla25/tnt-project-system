const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.eolisqycvpkzdzzaugkk:L!1687Hn87G4@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
});
async function run() {
  await client.connect();
  const sql = `
CREATE OR REPLACE VIEW public.campaign_creators_performance AS
WITH organic_metrics AS (
    SELECT 
        cc.id as campaign_creator_id,
        COALESCE(SUM(s.gmv), 0) as gmv_organic,
        COALESCE(SUM(s.quantity), 0) as items_sold
    FROM campaign_creators cc
    JOIN creators c ON cc.creator_id = c.id
    LEFT JOIN sales s ON s.creator_username = c.username AND s.campaign_id = cc.campaign_id
    GROUP BY cc.id
),
ads_metrics AS (
    SELECT 
        cc.id as campaign_creator_id,
        COALESCE(SUM(ap.gross_revenue_usd * ap.kurs), 0) as gmv_ads,
        COALESCE(SUM(ap.cost_usd * ap.kurs), 0) as cost_ads
    FROM campaign_creators cc
    LEFT JOIN ads_performance ap ON ap.creator_id = cc.creator_id AND ap.campaign_id = cc.campaign_id
    GROUP BY cc.id
),
awareness_metrics AS (
    SELECT 
        cc.id as campaign_creator_id,
        COALESCE(SUM(ov.video_views), 0) as video_views,
        COALESCE(SUM(ov.video_likes), 0) as video_likes,
        COUNT(DISTINCT CASE WHEN ov.duration_str IS NULL OR ov.duration_str NOT LIKE '%h%min%' THEN ov.content_uid END) as tracked_videos_only,
        COUNT(DISTINCT CASE WHEN ov.duration_str LIKE '%h%min%' THEN ov.content_uid END) as tracked_livestreams
    FROM campaign_creators cc
    JOIN creators c ON cc.creator_id = c.id
    JOIN campaigns cmp ON cc.campaign_id = cmp.id
    LEFT JOIN organic_videos ov ON ov.creator_username = c.username 
         AND (cmp.start_date IS NULL OR ov.post_time::date >= cmp.start_date)
         AND (cmp.end_date IS NULL OR ov.post_time::date <= cmp.end_date)
    GROUP BY cc.id
)
SELECT 
    cc.id as campaign_creator_id,
    cc.campaign_id,
    c.username as creator_username,
    COALESCE(om.gmv_organic, 0) as gmv_organic,
    COALESCE(om.items_sold, 0) as items_sold,
    COALESCE(am.gmv_ads, 0) as gmv_ads,
    COALESCE(am.cost_ads, 0) as cost_ads,
    COALESCE(aw.video_views, 0) as video_views,
    COALESCE(aw.video_likes, 0) as video_likes,
    COALESCE(aw.tracked_videos_only, 0) as tracked_videos_only,
    COALESCE(aw.tracked_livestreams, 0) as tracked_livestreams
FROM campaign_creators cc
JOIN creators c ON cc.creator_id = c.id
LEFT JOIN organic_metrics om ON om.campaign_creator_id = cc.id
LEFT JOIN ads_metrics am ON am.campaign_creator_id = cc.id
LEFT JOIN awareness_metrics aw ON aw.campaign_creator_id = cc.id;
  `;
  try {
     await client.query(sql);
     console.log('Successfully updated view');
  } catch (e) {
     console.error('Error:', e);
  } finally {
     await client.end();
  }
}
run();
