CREATE OR REPLACE FUNCTION get_campaign_creator_counts(p_campaign_id BIGINT)
RETURNS TABLE (
  total BIGINT,
  approved BIGINT,
  pending BIGINT,
  alternate BIGINT,
  not_approved BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH deduped AS (
    SELECT DISTINCT ON (LOWER(COALESCE(c.username, 'unknown_' || cc.creator_id)))
      cc.approval
    FROM campaign_creators cc
    LEFT JOIN creators c ON c.id = cc.creator_id
    WHERE cc.campaign_id = p_campaign_id
    ORDER BY LOWER(COALESCE(c.username, 'unknown_' || cc.creator_id)),
             CASE cc.approval
               WHEN 'approved' THEN 1
               WHEN 'pending' THEN 2
               WHEN 'alternate' THEN 3
               WHEN 'not_approved' THEN 4
               ELSE 5
             END
  )
  SELECT 
    (COUNT(*))::BIGINT AS total,
    (COUNT(*) FILTER (WHERE approval = 'approved'))::BIGINT AS approved,
    (COUNT(*) FILTER (WHERE approval = 'pending'))::BIGINT AS pending,
    (COUNT(*) FILTER (WHERE approval = 'alternate'))::BIGINT AS alternate,
    (COUNT(*) FILTER (WHERE approval = 'not_approved'))::BIGINT AS not_approved
  FROM deduped;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
