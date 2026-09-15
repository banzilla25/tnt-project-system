-- ============================================================
-- Migration: Optimize get_campaign_live_stats RPC
-- 1. Anti-duplication: Group sales strictly by (n_uid, creator_username)
-- 2. Performance: Efficient date filters using timestamps without truncation
-- 3. Case-insensitive matching for creator usernames
-- ============================================================

DROP FUNCTION IF EXISTS public.get_campaign_live_stats(integer);

CREATE OR REPLACE FUNCTION public.get_campaign_live_stats(p_campaign_id integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    SELECT start_date, end_date
    INTO v_start_date, v_end_date
    FROM campaigns WHERE id = p_campaign_id;

    WITH valid_creators AS (
        SELECT lower(c.username) AS username
        FROM campaign_creators cc
        JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = p_campaign_id
          AND cc.approval IN ('approved', 'alternate')
    ),
    normalized_sales AS (
        -- Grouping strictly per session (n_uid + creator_username) to avoid multi-date Cartesian duplicates
        SELECT
            CASE
                WHEN s.content_uid LIKE 'video_%' THEN split_part(s.content_uid, '_', 2)
                ELSE s.content_uid
            END AS n_uid,
            lower(s.creator_username) AS creator_username,
            MIN(s.tanggal::text) AS post_time,
            SUM(s.gmv)      AS total_gmv,
            SUM(s.quantity) AS total_orders
        FROM sales s
        WHERE s.campaign_id = p_campaign_id
          AND (s.content_type ILIKE 'livestream' OR s.content_type ILIKE 'live')
          AND lower(s.creator_username) IN (SELECT username FROM valid_creators)
        GROUP BY 1, 2
    ),
    organic_lives AS (
        SELECT
            CASE
                WHEN ov.content_uid LIKE 'video_%' THEN split_part(ov.content_uid, '_', 2)
                ELSE ov.content_uid
            END AS n_uid,
            lower(ov.creator_username) AS creator_username,
            ov.post_time::text AS post_time,
            ov.video_views,
            ov.video_likes,
            ov.duration_str
        FROM organic_videos ov
        WHERE ov.campaign_id = p_campaign_id
          AND (ov.content_type ILIKE 'livestream' OR ov.content_type ILIKE 'live')
          AND lower(ov.creator_username) IN (SELECT username FROM valid_creators)
          AND (v_start_date IS NULL OR ov.post_time >= v_start_date::timestamp)
          AND (v_end_date IS NULL OR ov.post_time < (v_end_date + interval '1 day')::timestamp)
    ),
    matched_lives AS (
        SELECT
            o.n_uid        AS content_uid,
            o.creator_username,
            o.post_time    AS start_time,
            o.video_views,
            o.video_likes,
            o.duration_str,
            COALESCE(s.total_gmv, 0)    AS gmv,
            COALESCE(s.total_orders, 0) AS orders
        FROM organic_lives o
        LEFT JOIN normalized_sales s ON o.n_uid = s.n_uid AND o.creator_username = s.creator_username
    ),
    unmatched_sales AS (
        SELECT
            s.n_uid        AS content_uid,
            s.creator_username,
            s.post_time    AS start_time,
            0              AS video_views,
            0              AS video_likes,
            ''             AS duration_str,
            s.total_gmv    AS gmv,
            s.total_orders AS orders
        FROM normalized_sales s
        LEFT JOIN organic_lives o ON s.n_uid = o.n_uid AND s.creator_username = o.creator_username
        WHERE o.n_uid IS NULL
    ),
    all_lives AS (
        SELECT * FROM matched_lives
        UNION ALL
        SELECT * FROM unmatched_sales
    )
    SELECT COALESCE(json_agg(row_to_json(all_lives)), '[]'::json)
    INTO v_result
    FROM all_lives;

    RETURN v_result;
END;
$$;
