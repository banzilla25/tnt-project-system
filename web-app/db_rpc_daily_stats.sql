DROP FUNCTION IF EXISTS public.get_campaign_daily_stats(integer);

CREATE OR REPLACE FUNCTION public.get_campaign_daily_stats(p_campaign_id integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $BODY
DECLARE
    v_result JSONB;
BEGIN
    WITH raw_daily AS (
        SELECT 
            TO_CHAR(tanggal, 'YYYY-MM-DD') AS date_str,
            gmv,
            quantity,
            creator_username,
            content_uid,
            content_type
        FROM sales
        WHERE campaign_id = p_campaign_id
          AND is_refund = false
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
