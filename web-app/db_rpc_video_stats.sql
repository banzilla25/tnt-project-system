DROP FUNCTION IF EXISTS public.get_campaign_video_stats(integer);

CREATE OR REPLACE FUNCTION public.get_campaign_video_stats(p_campaign_id integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $BODY
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
            CASE 
                WHEN content_uid LIKE 'video_%' THEN split_part(content_uid, '_', 2)
                ELSE content_uid 
            END AS n_uid,
            lower(creator_username) as username,
            MAX(product_id) as product_id,
            COALESCE(SUM(gmv), 0) AS gmv,
            COALESCE(SUM(quantity), 0) AS orders
        FROM sales
        WHERE campaign_id = p_campaign_id
          AND lower(content_type) = 'video'
          AND product_id IN (SELECT product_id FROM campaign_skus)
        GROUP BY 1, 2
    ),
    organic_agg AS (
        SELECT 
            CASE 
                WHEN content_uid LIKE 'video_%' THEN split_part(content_uid, '_', 2)
                ELSE content_uid 
            END AS n_uid,
            lower(creator_username) as username,
            COALESCE(MAX(video_views), 0) AS views,
            COALESCE(MAX(video_likes), 0) AS likes
        FROM organic_videos
        WHERE campaign_id = p_campaign_id
          AND lower(COALESCE(content_type, 'video')) != 'livestream'
          AND product_id IN (SELECT product_id FROM campaign_skus)
        GROUP BY 1, 2
    ),
    all_uids AS (
        SELECT n_uid, username FROM sales_agg
        UNION
        SELECT n_uid, username FROM organic_agg
    ),
    combined AS (
        SELECT 
            u.n_uid AS content_uid,
            u.username,
            s.product_id,
            COALESCE(s.gmv, 0) AS gmv,
            COALESCE(s.orders, 0) AS orders,
            COALESCE(o.views, 0) AS views,
            COALESCE(o.likes, 0) AS likes
        FROM all_uids u
        LEFT JOIN sales_agg s ON u.n_uid = s.n_uid AND u.username = s.username
        LEFT JOIN organic_agg o ON u.n_uid = o.n_uid AND u.username = o.username
    )
    SELECT COALESCE(json_agg(row_to_json(combined)), '[]'::json)
    INTO v_result
    FROM combined;

    RETURN v_result;
END;
$BODY;
