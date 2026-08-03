CREATE OR REPLACE FUNCTION get_campaign_top_skus(p_campaign_id integer)
RETURNS TABLE (
  product_id text,
  nama_produk text,
  gmv numeric,
  items_sold bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.product_id,
    COALESCE(MAX(sk.nama_produk), s.product_id) as nama_produk,
    SUM(COALESCE(s.gmv, 0)) as gmv,
    SUM(COALESCE(s.quantity, 0)) as items_sold
  FROM sales s
  LEFT JOIN skus sk ON s.product_id = sk.product_id AND sk.campaign_id = p_campaign_id
  WHERE s.campaign_id = p_campaign_id
    AND s.product_id IS NOT NULL
    AND s.product_id != ''
  GROUP BY s.product_id
  ORDER BY gmv DESC;
END;
$$;
