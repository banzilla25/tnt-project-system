DROP FUNCTION IF EXISTS public.get_campaign_daily_stats(integer);

CREATE OR REPLACE FUNCTION public.get_campaign_daily_stats(p_campaign_id integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $BODY
DECLARE
    v_result JSONB;
BEGIN
    WITH valid_creators AS (
        SELECT c.username
        FROM campaign_creators cc
        JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = p_campaign_id
          AND cc.approval IN ('approved', 'alternate')
    ),
    campaign_skus AS (
        SELECT DISTINCT product_id 
        FROM skus 
        WHERE campaign_id = p_campaign_id 
          AND product_id IS NOT NULL
    ),
    raw_sales AS (
        SELECT 
            TO_CHAR(tanggal, 'YYYY-MM-DD') AS date_str,
            gmv,
            quantity,
            creator_username,
            content_uid,
            content_type
        FROM sales
        WHERE campaign_id = p_campaign_id
          AND product_id IN (SELECT product_id FROM campaign_skus)
          AND creator_username IN (SELECT username FROM valid_creators)
    ),
    raw_organic AS (
        SELECT 
            TO_CHAR(post_time, 'YYYY-MM-DD') AS date_str,
            0 AS gmv,
            0 AS quantity,
            creator_username,
            content_uid,
            COALESCE(content_type, 'Video') AS content_type
        FROM organic_videos
        WHERE campaign_id = p_campaign_id
          AND product_id IN (SELECT product_id FROM campaign_skus)
          AND post_time IS NOT NULL
          AND creator_username IN (SELECT username FROM valid_creators)
    ),
    raw_daily AS (
        SELECT * FROM raw_sales
        UNION ALL
        SELECT * FROM raw_organic
    ),
    daily_agg AS (
        SELECT 
            date_str,
            SUM(gmv) AS total_gmv,
            SUM(CASE WHEN lower(content_type) = 'livestream' THEN gmv ELSE 0 END) AS gmv_live,
            SUM(CASE WHEN lower(content_type) = 'video' THEN gmv ELSE 0 END) AS gmv_vt,
            SUM(CASE WHEN lower(content_type) = 'livestream' THEN quantity ELSE 0 END) AS orders_live,
            SUM(CASE WHEN lower(content_type) = 'video' THEN quantity ELSE 0 END) AS orders_vt,
            json_agg(DISTINCT creator_username) FILTER (WHERE creator_username IS NOT NULL) AS active_creators,
            json_agg(DISTINCT content_uid) FILTER (WHERE content_uid IS NOT NULL AND lower(content_type) = 'video') AS active_videos,
            json_agg(DISTINCT content_uid) FILTER (WHERE content_uid IS NOT NULL AND lower(content_type) = 'livestream') AS active_live_sessions
        FROM raw_daily
        GROUP BY date_str
    )
    SELECT COALESCE(json_agg(row_to_json(daily_agg)), '[]'::json)
    INTO v_result
    FROM daily_agg;

    RETURN v_result;
END;
$BODY;
