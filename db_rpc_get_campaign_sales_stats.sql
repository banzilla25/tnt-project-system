CREATE OR REPLACE FUNCTION get_campaign_sales_stats(p_campaign_id BIGINT)
RETURNS TABLE (
    date_str TEXT,
    total_gmv NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(s.tanggal, 'YYYY-MM-DD') AS date_str,
        SUM(s.gmv)::NUMERIC AS total_gmv
    FROM sales s
    WHERE s.campaign_id = p_campaign_id
      AND s.is_refund = FALSE
      AND s.product_id IN (
          SELECT product_id FROM skus WHERE campaign_id = p_campaign_id
      )
      AND s.creator_username IN (
          SELECT c.username 
          FROM campaign_creators cc
          JOIN creators c ON cc.creator_id = c.id
          WHERE cc.campaign_id = p_campaign_id AND cc.approval = 'approved'
      )
    GROUP BY TO_CHAR(s.tanggal, 'YYYY-MM-DD')
    ORDER BY date_str ASC;
END;
$$;
