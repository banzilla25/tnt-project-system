DROP FUNCTION IF EXISTS public.get_campaign_creator_performance(integer);

CREATE OR REPLACE FUNCTION public.get_campaign_creator_performance(p_campaign_id integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH campaign_skus AS (
        SELECT DISTINCT product_id 
        FROM skus 
        WHERE campaign_id = p_campaign_id 
          AND product_id IS NOT NULL
    ),
    sales_agg AS (
        SELECT 
            lower(creator_username) AS username,
            COALESCE(SUM(gmv), 0) AS gmv_organic,
            COALESCE(SUM(quantity), 0) AS items_sold
        FROM sales
        WHERE campaign_id = p_campaign_id
          AND product_id IN (SELECT product_id FROM campaign_skus)
        GROUP BY lower(creator_username)
    ),
    videos_agg AS (
        SELECT 
            lower(creator_username) AS username,
            COALESCE(SUM(video_views) FILTER (WHERE lower(content_type) != 'livestream'), 0) AS video_views,
            COALESCE(SUM(video_likes) FILTER (WHERE lower(content_type) != 'livestream'), 0) AS video_likes,
            COUNT(*) FILTER (WHERE lower(content_type) != 'livestream') AS video_count,
            COUNT(*) FILTER (WHERE lower(content_type) = 'livestream') AS live_count
        FROM organic_videos
        WHERE campaign_id = p_campaign_id
        GROUP BY lower(creator_username)
    ),
    all_creators AS (
        SELECT username FROM sales_agg
        UNION
        SELECT username FROM videos_agg
    ),
    combined AS (
        SELECT 
            c.username,
            COALESCE(s.gmv_organic, 0) AS gmv_organic,
            COALESCE(s.items_sold, 0) AS items_sold,
            COALESCE(v.video_views, 0) AS video_views,
            COALESCE(v.video_likes, 0) AS video_likes,
            COALESCE(v.video_count, 0) AS video_count,
            COALESCE(v.live_count, 0) AS live_count
        FROM all_creators c
        LEFT JOIN sales_agg s ON c.username = s.username
        LEFT JOIN videos_agg v ON c.username = v.username
    )
    SELECT COALESCE(json_agg(row_to_json(combined)), '[]'::json)
    INTO v_result
    FROM combined;

    RETURN v_result;
END;
$$;
