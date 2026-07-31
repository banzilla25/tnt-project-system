-- ================================================================
-- MIGRATION: Perbaikan RPC untuk Manual Video Imports
-- Paste seluruh isi file ini ke Supabase SQL Editor, lalu klik RUN
-- ================================================================

-- STEP 1: Buat tabel manual_video_imports (kalau belum ada)
CREATE TABLE IF NOT EXISTS public.manual_video_imports (
  id              BIGSERIAL PRIMARY KEY,
  content_uid     TEXT NOT NULL,
  creator_username TEXT NOT NULL,
  campaign_id     INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  link_video      TEXT,
  post_time       TIMESTAMPTZ,
  video_views     INTEGER NOT NULL DEFAULT 0,
  video_likes     INTEGER NOT NULL DEFAULT 0,
  content_type    TEXT NOT NULL DEFAULT 'Video',
  imported_by     TEXT,
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manual_video_imports_uid_campaign_key UNIQUE (content_uid, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_mvi_campaign ON public.manual_video_imports(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mvi_uid ON public.manual_video_imports(content_uid);
CREATE INDEX IF NOT EXISTS idx_mvi_creator ON public.manual_video_imports(campaign_id, lower(creator_username));


-- STEP 2: Update RPC
DROP FUNCTION IF EXISTS public.get_campaign_creator_performance(integer);
DROP FUNCTION IF EXISTS public.get_campaign_creator_performance(integer, text, text[]);

CREATE OR REPLACE FUNCTION public.get_campaign_creator_performance(p_campaign_id integer)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    WITH campaign_info AS (
        SELECT start_date, end_date FROM campaigns WHERE id = p_campaign_id
    ),
    campaign_skus AS (
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
        FROM sales, campaign_info
        WHERE campaign_id = p_campaign_id
          AND product_id IN (SELECT product_id FROM campaign_skus)
          AND tanggal >= campaign_info.start_date
          AND tanggal <= COALESCE(campaign_info.end_date, '2099-12-31'::date)
        GROUP BY lower(creator_username)
    ),
    combined_videos AS (
        SELECT
            content_uid,
            lower(creator_username) AS creator_username,
            video_views,
            video_likes,
            content_type,
            post_time
        FROM organic_videos
        WHERE campaign_id = p_campaign_id

        UNION

        SELECT
            m.content_uid,
            lower(m.creator_username),
            m.video_views,
            m.video_likes,
            m.content_type,
            m.post_time
        FROM manual_video_imports m
        WHERE m.campaign_id = p_campaign_id
          AND NOT EXISTS (
            SELECT 1 FROM organic_videos ov
            WHERE ov.content_uid = m.content_uid
          )
    ),
    videos_agg AS (
        SELECT 
            cv.creator_username AS username,
            COALESCE(SUM(cv.video_views) FILTER (WHERE lower(COALESCE(cv.content_type, 'video')) != 'livestream'), 0) AS video_views,
            COALESCE(SUM(cv.video_likes) FILTER (WHERE lower(COALESCE(cv.content_type, 'video')) != 'livestream'), 0) AS video_likes,
            COUNT(*) FILTER (WHERE lower(COALESCE(cv.content_type, 'video')) != 'livestream') AS video_count,
            COUNT(*) FILTER (WHERE lower(COALESCE(cv.content_type, 'video')) = 'livestream') AS live_count
        FROM combined_videos cv, campaign_info
        WHERE cv.post_time::date >= campaign_info.start_date
          AND cv.post_time::date <= COALESCE(campaign_info.end_date, '2099-12-31'::date)
        GROUP BY cv.creator_username
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
$function$;
