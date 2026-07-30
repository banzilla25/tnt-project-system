require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = `
-- Drop old signatures to avoid overloaded function ambiguity
DROP FUNCTION IF EXISTS public.get_campaign_creator_performance(integer);
DROP FUNCTION IF EXISTS public.get_campaign_creator_performance(integer, text, text[]);
DROP FUNCTION IF EXISTS public.get_performance_summary_v2(bigint, text, text[]);

CREATE OR REPLACE FUNCTION public.get_campaign_creator_performance(p_campaign_id integer, p_filter_type text DEFAULT NULL::text, p_filter_values text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH campaign_info AS (
    SELECT start_date, end_date FROM campaigns WHERE id = p_campaign_id
  ),
  deduped_creators AS (
    SELECT DISTINCT ON (LOWER(COALESCE(c.username, 'unknown_' || cc.creator_id)))
      cc.id as cc_id,
      cc.creator_id,
      cc.approval,
      LOWER(COALESCE(c.username, 'unknown_' || cc.creator_id)) as username,
      cc.added_by
    FROM campaign_creators cc
    LEFT JOIN creators c ON c.id = cc.creator_id
    WHERE cc.campaign_id = p_campaign_id
      AND (p_filter_type IS NULL 
           OR (p_filter_type = 'exclude' AND NOT (LOWER(c.username) = ANY(p_filter_values)))
           OR (p_filter_type != 'exclude' AND LOWER(c.username) = ANY(p_filter_values)))
  ),
  sales_agg AS (
    SELECT 
        lower(creator_username) AS username,
        COALESCE(SUM(gmv), 0) AS gmv,
        COALESCE(SUM(quantity), 0) AS items_sold
    FROM sales, campaign_info
    WHERE campaign_id = p_campaign_id
      AND product_id IS NOT NULL
      AND product_id != ''
      AND tanggal >= campaign_info.start_date
      AND tanggal <= COALESCE(campaign_info.end_date, '2099-12-31'::date)
    GROUP BY lower(creator_username)
  ),
  videos_agg AS (
    SELECT 
        lower(creator_username) AS username,
        COALESCE(SUM(video_views) FILTER (WHERE lower(COALESCE(content_type, 'video')) != 'livestream'), 0) AS video_views,
        COALESCE(SUM(video_likes) FILTER (WHERE lower(COALESCE(content_type, 'video')) != 'livestream'), 0) AS video_likes,
        COUNT(*) FILTER (WHERE lower(COALESCE(content_type, 'video')) != 'livestream') AS video_count,
        COUNT(*) FILTER (WHERE lower(COALESCE(content_type, 'video')) = 'livestream') AS live_count
    FROM organic_videos, campaign_info
    WHERE campaign_id = p_campaign_id
      AND post_time::date >= campaign_info.start_date
      AND post_time::date <= COALESCE(campaign_info.end_date, '2099-12-31'::date)
    GROUP BY lower(creator_username)
  ),
  campaign_ads AS (
    SELECT DISTINCT ON (ad_id)
      ad_id,
      cost_usd as spend,
      creator_id,
      (gross_revenue_usd * GREATEST(kurs, 1000)) as gmv
    FROM ads_performance
    WHERE campaign_id = p_campaign_id
      AND (p_filter_type IS NULL 
           OR (p_filter_type = 'exclude' AND NOT (creator_id IN (SELECT cc.creator_id FROM campaign_creators cc LEFT JOIN creators c ON c.id = cc.creator_id WHERE c.username = ANY(p_filter_values))))
           OR (p_filter_type != 'exclude' AND creator_id IN (SELECT creator_id FROM deduped_creators)))
    ORDER BY ad_id, tanggal DESC
  ),
  ads_agg AS (
    SELECT 
        lower(c.username) AS username,
        COALESCE(SUM(a.spend), 0) AS ads_spend,
        COALESCE(SUM(a.gmv), 0) AS ads_gmv
    FROM campaign_ads a
    JOIN creators c ON c.id = a.creator_id
    GROUP BY lower(c.username)
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'username', dc.username,
      'creator_id', dc.creator_id,
      'cc_id', dc.cc_id,
      'approval', dc.approval,
      'added_by', dc.added_by,
      'gmv_organic', COALESCE(s.gmv, 0),
      'items_sold', COALESCE(s.items_sold, 0),
      'video_views', COALESCE(v.video_views, 0),
      'video_likes', COALESCE(v.video_likes, 0),
      'video_count', COALESCE(v.video_count, 0),
      'live_count', COALESCE(v.live_count, 0),
      'ads_spend', COALESCE(a.ads_spend, 0),
      'ads_gmv', COALESCE(a.ads_gmv, 0)
    ) ORDER BY COALESCE(s.gmv, 0) DESC NULLS LAST
  ), '[]'::jsonb)
  INTO result
  FROM deduped_creators dc
  LEFT JOIN sales_agg s ON dc.username = s.username
  LEFT JOIN videos_agg v ON dc.username = v.username
  LEFT JOIN ads_agg a ON dc.username = a.username;

  RETURN result;
END;
$function$;

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
  items_sold BIGINT,
  unattributed_gmv NUMERIC
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
        OR (p_filter_type = 'exclude' AND NOT (c.username = ANY(p_filter_values)))
      )
  ),
  deduped_creators AS (
    SELECT DISTINCT ON (username) *
    FROM filtered_creators
    ORDER BY username, 
             CASE approval WHEN 'approved' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END
  ),
  organic_stats AS (
    SELECT 
      SUM((p->>'gmv_organic')::NUMERIC) FILTER (WHERE dc.approval = 'approved') as approved_gmv,
      SUM((p->>'gmv_organic')::NUMERIC) as total_gmv,
      SUM((p->>'items_sold')::BIGINT) as items,
      SUM((p->>'video_views')::BIGINT) as views,
      SUM((p->>'video_likes')::BIGINT) as likes,
      SUM((p->>'video_count')::BIGINT) as videos
    FROM jsonb_array_elements(get_campaign_creator_performance(p_campaign_id::INT, p_filter_type, p_filter_values)::jsonb) p
    LEFT JOIN deduped_creators dc ON LOWER(p->>'username') = dc.username
    WHERE p_filter_type IS NULL 
       OR (p_filter_type = 'exclude' AND NOT (LOWER(p->>'username') = ANY(p_filter_values)))
       OR (p_filter_type != 'exclude' AND (p->>'username') IN (SELECT username FROM deduped_creators))
  ),
  latest_ads AS (
    SELECT DISTINCT ON (ad_id) *
    FROM ads_performance
    WHERE campaign_id = p_campaign_id
      AND (p_filter_type IS NULL 
           OR (p_filter_type = 'exclude' AND NOT (creator_id IN (SELECT cc.creator_id FROM campaign_creators cc LEFT JOIN creators c ON c.id = cc.creator_id WHERE c.username = ANY(p_filter_values))))
           OR (p_filter_type != 'exclude' AND creator_id IN (SELECT c_id FROM deduped_creators)))
    ORDER BY ad_id, tanggal DESC
  )
  SELECT 
    (SELECT COUNT(*) FROM deduped_creators WHERE approval = 'approved')::BIGINT,
    (SELECT COUNT(*) FROM deduped_creators WHERE approval = 'pending')::BIGINT,
    COALESCE((SELECT views FROM organic_stats), 0)::BIGINT,
    COALESCE((SELECT likes FROM organic_stats), 0)::BIGINT,
    COALESCE((SELECT videos FROM organic_stats), 0)::BIGINT,
    COALESCE((SELECT approved_gmv FROM organic_stats), 0)::NUMERIC,
    COALESCE((SELECT SUM(gross_revenue_usd * GREATEST(kurs, 1000)) FROM latest_ads), 0)::NUMERIC,
    COALESCE((SELECT SUM(cost_usd) FROM latest_ads), 0)::NUMERIC,
    COALESCE((SELECT items FROM organic_stats), 0)::BIGINT,
    (COALESCE((SELECT total_gmv FROM organic_stats), 0) - COALESCE((SELECT approved_gmv FROM organic_stats), 0))::NUMERIC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;
async function fix() {
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('Deploy:', error);
  const { data, error: runErr } = await supabase.rpc('get_performance_summary_v2', { p_campaign_id: 42 });
  console.log('Summary Run Error:', runErr);
  console.log('Summary Data:', data);
  const { data: pData, error: pErr } = await supabase.rpc('get_campaign_creator_performance', { p_campaign_id: 42 });
  console.log('Creator Run Error:', pErr);
  console.log('Creator Data Length:', pData ? pData.length : 'null');
}
fix();
