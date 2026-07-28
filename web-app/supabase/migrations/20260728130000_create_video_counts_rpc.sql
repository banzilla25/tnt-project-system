CREATE OR REPLACE FUNCTION get_campaign_video_counts_fast(p_campaign_id BIGINT)
RETURNS TABLE (
  total_approved BIGINT,
  total_pending BIGINT,
  total_livestream BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH all_videos AS (
    -- 1. Video dari tabel videos (input manual kreator)
    SELECT 
      v.content_uid,
      cc.approval as vt_approval,
      'video' as content_type
    FROM videos v
    JOIN campaign_creators cc ON cc.id = v.campaign_creator_id
    WHERE cc.campaign_id = p_campaign_id
      AND v.content_uid IS NOT NULL
      AND v.content_uid != ''

    UNION

    -- 2. Video dari hasil impor (tabel sales / awareness data)
    SELECT 
      CASE 
        WHEN s.content_uid LIKE 'video_%' THEN SUBSTRING(s.content_uid FROM 7)
        ELSE s.content_uid 
      END as content_uid,
      COALESCE(cc.approval, 'approved') as vt_approval,
      CASE 
        WHEN LOWER(s.content_type) IN ('livestream', 'live', 'live stream') THEN 'livestream'
        ELSE 'video'
      END as content_type
    FROM sales s
    LEFT JOIN creators c ON LOWER(c.username) = LOWER(s.creator_username)
    LEFT JOIN campaign_creators cc ON cc.creator_id = c.id AND cc.campaign_id = s.campaign_id
    WHERE s.campaign_id = p_campaign_id
      AND s.content_uid IS NOT NULL
      AND s.content_uid != ''
  ),
  deduped AS (
    SELECT DISTINCT ON (content_uid)
      vt_approval,
      content_type
    FROM all_videos
    ORDER BY content_uid, 
             -- Prioritaskan status 'approved' jika ada duplikat ID
             CASE vt_approval WHEN 'approved' THEN 1 ELSE 2 END
  )
  SELECT 
    (COUNT(*) FILTER (WHERE content_type = 'video' AND vt_approval = 'approved'))::BIGINT as total_approved,
    (COUNT(*) FILTER (WHERE content_type = 'video' AND vt_approval = 'pending'))::BIGINT as total_pending,
    (COUNT(*) FILTER (WHERE content_type = 'livestream'))::BIGINT as total_livestream
  FROM deduped;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
