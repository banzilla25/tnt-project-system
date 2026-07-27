CREATE OR REPLACE FUNCTION get_performance_summary_v2(
  p_campaign_id BIGINT,
  p_filter_type TEXT DEFAULT NULL,
  p_filter_values TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  total_approved_creators BIGINT,
  total_pending_creators BIGINT,
  total_views BIGINT,
  total_likes BIGINT,
  total_videos BIGINT,
  organic_gmv NUMERIC,
  ads_gmv NUMERIC,
  ads_spend NUMERIC,
  items_sold BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_creators AS (
    SELECT 
      cc.creator_id,
      cc.approval,
      LOWER(COALESCE(c.username, 'unknown_' || cc.creator_id)) as username,
      c.id as c_id,
      cc.added_by
    FROM campaign_creators cc
    LEFT JOIN creators c ON c.id = cc.creator_id
    WHERE cc.campaign_id = p_campaign_id
      AND (
        p_filter_type IS NULL 
        OR (p_filter_type = 'pic' AND cc.added_by::text = ANY(p_filter_values))
        OR (p_filter_type = 'username' AND c.username = ANY(p_filter_values))
      )
  ),
  deduped_creators AS (
    SELECT DISTINCT ON (username) *
    FROM filtered_creators
    ORDER BY username, 
             CASE approval WHEN 'approved' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END
  ),
  approved_vids AS (
    SELECT v.id, v.vt_views, v.vt_likes
    FROM videos v
    WHERE v.campaign_id = p_campaign_id
      AND v.vt_approval = 'approved'
      AND (
        p_filter_type IS NULL 
        OR v.creator_id IN (SELECT c_id FROM deduped_creators)
      )
  ),
  organic_stats AS (
    SELECT 
      SUM(v.vt_views)::BIGINT as views,
      SUM(v.vt_likes)::BIGINT as likes,
      COUNT(v.id)::BIGINT as videos,
      (SELECT SUM(s.gmv) FROM sales s WHERE s.campaign_id = p_campaign_id AND s.content_uid IN (SELECT 'video_' || id FROM approved_vids))::NUMERIC as gmv,
      (SELECT SUM(s.quantity) FROM sales s WHERE s.campaign_id = p_campaign_id AND s.content_uid IN (SELECT 'video_' || id FROM approved_vids))::BIGINT as items
    FROM approved_vids v
  ),
  latest_ads AS (
    SELECT DISTINCT ON (ad_id) *
    FROM ads_performance
    WHERE campaign_id = p_campaign_id
      AND (p_filter_type IS NULL 
           OR creator_id IN (SELECT c_id FROM deduped_creators))
    ORDER BY ad_id, tanggal DESC
  )
  SELECT 
    (SELECT COUNT(*) FROM deduped_creators WHERE approval = 'approved')::BIGINT,
    (SELECT COUNT(*) FROM deduped_creators WHERE approval = 'pending')::BIGINT,
    COALESCE((SELECT views FROM organic_stats), 0)::BIGINT,
    COALESCE((SELECT likes FROM organic_stats), 0)::BIGINT,
    COALESCE((SELECT videos FROM organic_stats), 0)::BIGINT,
    COALESCE((SELECT gmv FROM organic_stats), 0)::NUMERIC,
    COALESCE((SELECT SUM(gross_revenue_usd * GREATEST(kurs, 1000)) FROM latest_ads), 0)::NUMERIC,
    COALESCE((SELECT SUM(cost_usd) FROM latest_ads), 0)::NUMERIC,
    COALESCE((SELECT items FROM organic_stats), 0)::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
