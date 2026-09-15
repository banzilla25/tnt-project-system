require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const sql = `CREATE OR REPLACE FUNCTION public.get_campaign_creator_performance(p_campaign_id integer, p_filter_type text DEFAULT NULL::text, p_filter_values text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
AS $$
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
      spend,
      creator_id,
      gmv
    FROM ads_import
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
$$;`;
async function fix() {
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('Deploy:', error);
  const { data, error: runErr } = await supabase.rpc('get_performance_summary_v2', { p_campaign_id: 42 });
  console.log('Run Error:', runErr);
  console.log('Run Data GMV:', data ? data.total_gmv : 'null');
}
fix();
