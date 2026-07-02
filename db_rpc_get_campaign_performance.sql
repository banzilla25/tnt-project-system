-- Migration script for get_campaign_performance RPC
CREATE OR REPLACE FUNCTION get_campaign_performance(p_campaign_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_target_creator INTEGER;
    v_target_video INTEGER;
    v_target_gmv NUMERIC;
    
    v_total_organic NUMERIC := 0;
    v_tracked_organic NUMERIC := 0;
    v_total_ads_gmv NUMERIC := 0;
    
    v_approved_creators_count INTEGER := 0;
    
    v_total_views BIGINT := 0;
    v_total_likes BIGINT := 0;
    v_total_videos BIGINT := 0;
    
    v_result JSONB;
BEGIN
    -- 1. Get Campaign Details
    SELECT start_date, end_date, target_creator, target_video, target_gmv
    INTO v_start_date, v_end_date, v_target_creator, v_target_video, v_target_gmv
    FROM campaigns
    WHERE id = p_campaign_id;

    -- 2. Count Approved Creators
    SELECT COUNT(*)
    INTO v_approved_creators_count
    FROM campaign_creators
    WHERE campaign_id = p_campaign_id AND approval = 'approved';

    -- 3. Calculate Total Organic GMV (All creators, filtered by date and valid SKU)
    SELECT COALESCE(SUM(s.gmv), 0)
    INTO v_total_organic
    FROM sales s
    WHERE s.campaign_id = p_campaign_id
      AND s.is_refund = FALSE
      AND (v_start_date IS NULL OR s.tanggal >= v_start_date)
      AND (v_end_date IS NULL OR s.tanggal <= v_end_date)
      AND s.product_id IN (
          SELECT product_id FROM skus WHERE campaign_id = p_campaign_id
      );

    -- 4. Calculate Tracked Organic GMV (Only APPROVED creators)
    SELECT COALESCE(SUM(s.gmv), 0)
    INTO v_tracked_organic
    FROM sales s
    WHERE s.campaign_id = p_campaign_id
      AND s.is_refund = FALSE
      AND (v_start_date IS NULL OR s.tanggal >= v_start_date)
      AND (v_end_date IS NULL OR s.tanggal <= v_end_date)
      AND s.product_id IN (
          SELECT product_id FROM skus WHERE campaign_id = p_campaign_id
      )
      AND s.creator_username IN (
          SELECT c.username 
          FROM campaign_creators cc
          JOIN creators c ON cc.creator_id = c.id
          WHERE cc.campaign_id = p_campaign_id AND cc.approval = 'approved'
      );

    -- 5. Calculate Total Ads GMV (Only APPROVED creators, based on existing logic)
    SELECT COALESCE(SUM(ap.gross_revenue_usd * ap.kurs), 0)
    INTO v_total_ads_gmv
    FROM ads_performance ap
    WHERE ap.campaign_id = p_campaign_id
      AND ap.creator_id IN (
          SELECT creator_id 
          FROM campaign_creators 
          WHERE campaign_id = p_campaign_id AND approval = 'approved'
      );

    -- 6. Awareness Metrics (Views, Likes)
    SELECT COALESCE(SUM(total_views), 0), COALESCE(SUM(total_likes), 0)
    INTO v_total_views, v_total_likes
    FROM campaign_awareness_summary
    WHERE campaign_id = p_campaign_id;

    -- 7. Calculate Unique Videos
    WITH unique_videos AS (
        -- From Sales
        SELECT 
            CASE 
                WHEN content_uid LIKE 'video_%' THEN split_part(content_uid, '_', 2)
                ELSE content_uid 
            END as video_id
        FROM sales
        WHERE campaign_id = p_campaign_id AND content_uid IS NOT NULL
        UNION
        -- From Videos Table
        SELECT vt_code as video_id
        FROM videos
        WHERE campaign_id = p_campaign_id AND vt_code IS NOT NULL
    )
    SELECT COUNT(*)
    INTO v_total_videos
    FROM unique_videos;

    -- If total_videos from tables is 0, fallback to campaign_total_awareness view
    IF v_total_videos = 0 THEN
        SELECT COALESCE(SUM(campaign_total_videos), 0)
        INTO v_total_videos
        FROM campaign_total_awareness
        WHERE campaign_id = p_campaign_id;
    END IF;

    -- 8. Build JSON Result
    v_result := jsonb_build_object(
        'totalOrganic', v_total_organic,
        'trackedOrganic', v_tracked_organic,
        'attributionGap', GREATEST(0, v_total_organic - v_tracked_organic),
        'totalAdsGmv', v_total_ads_gmv,
        'totalAllGmv', v_total_organic + v_total_ads_gmv,
        'approvedCreators', v_approved_creators_count,
        'targetCreator', v_target_creator,
        'totalViews', v_total_views,
        'totalLikes', v_total_likes,
        'totalVideos', v_total_videos,
        'targetVideo', v_target_video,
        'targetGmv', v_target_gmv
    );

    RETURN v_result;
END;
$$;
