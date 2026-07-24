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
        -- Hanya ambil kreator yang di-approve di campaign ini
        SELECT c.username
        FROM campaign_creators cc
        JOIN creators c ON cc.creator_id = c.id
        WHERE cc.campaign_id = p_campaign_id
          AND cc.approval IN ('approved', 'alternate')
    ),
    normalized_sales AS (
        -- Normalisasi content_uid (hapus prefix 'video_') dan agregasi GMV/Orders per sesi
        -- Hanya memastikan ini bertipe Live atau Livestream
        SELECT
            CASE
                WHEN s.content_uid LIKE 'video_%' THEN split_part(s.content_uid, '_', 2)
                ELSE s.content_uid
            END AS n_uid,
            s.creator_username,
            s.tanggal::text AS post_time,
            SUM(s.gmv)      AS total_gmv,
            SUM(s.quantity) AS total_orders
        FROM sales s
        WHERE s.campaign_id = p_campaign_id
          AND lower(s.content_type) IN ('livestream', 'live')
          AND s.creator_username IN (SELECT username FROM valid_creators)
        GROUP BY 1, 2, 3
    ),
    organic_lives AS (
        -- Ambil data metrik dari organic_videos, hanya yang kreatornya valid dan dalam rentang waktu campaign
        SELECT
            CASE
                WHEN ov.content_uid LIKE 'video_%' THEN split_part(ov.content_uid, '_', 2)
                ELSE ov.content_uid
            END AS n_uid,
            ov.creator_username,
            ov.post_time::text AS post_time,
            ov.video_views,
            ov.video_likes,
            ov.duration_str
        FROM organic_videos ov
        WHERE ov.campaign_id = p_campaign_id
          AND ov.creator_username IN (SELECT username FROM valid_creators)
          AND ov.product_id IN (SELECT product_id FROM campaign_skus)
          AND COALESCE(ov.content_type, 'Livestream') = 'Livestream'
          AND (v_start_date IS NULL OR ov.post_time::date >= v_start_date)
          AND (v_end_date IS NULL OR ov.post_time::date <= v_end_date)
    ),
    matched_lives AS (
        -- Gabungkan organik + sales jika ada match content_uid
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
        -- Sales live yang tidak ada data metrik organiknya (0 views tapi ada GMV)
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
