-- 1. Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_payment_items_perf ON payment_items (batch_id, final_status, payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_batches_perf ON payment_batches (status, campaign_id, submitted_at);

-- 2. Create Aggregated View for Budget Summary
CREATE OR REPLACE VIEW vw_campaign_budget_summary AS
SELECT 
  c.id AS campaign_id,
  c.nama AS campaign_nama,
  c.status,
  COALESCE(c.budget_creator_plafon, 0) AS budget_creator,
  COALESCE(c.budget_ads_plafon, 0) AS budget_ads,
  COALESCE(SUM(CASE WHEN pi.payment_type != 'ads' AND pi.final_status = 'paid' THEN (COALESCE(pi.actual_transfer, pi.nominal) + COALESCE(pi.biaya_transfer, 0)) ELSE 0 END), 0) AS terpakai_creator,
  COALESCE(SUM(CASE WHEN pi.payment_type = 'ads' AND pi.final_status = 'paid' THEN (COALESCE(pi.actual_transfer, pi.nominal) + COALESCE(pi.biaya_transfer, 0)) ELSE 0 END), 0) AS terpakai_ads,
  (COALESCE(c.budget_creator_plafon, 0) - COALESCE(SUM(CASE WHEN pi.payment_type != 'ads' AND pi.final_status = 'paid' THEN (COALESCE(pi.actual_transfer, pi.nominal) + COALESCE(pi.biaya_transfer, 0)) ELSE 0 END), 0)) AS sisa_creator,
  (COALESCE(c.budget_ads_plafon, 0) - COALESCE(SUM(CASE WHEN pi.payment_type = 'ads' AND pi.final_status = 'paid' THEN (COALESCE(pi.actual_transfer, pi.nominal) + COALESCE(pi.biaya_transfer, 0)) ELSE 0 END), 0)) AS sisa_ads
FROM campaigns c
LEFT JOIN payment_batches pb ON pb.campaign_id = c.id
LEFT JOIN payment_items pi ON pi.batch_id = pb.id
WHERE c.status != 'draft'
GROUP BY c.id, c.nama, c.status, c.budget_creator_plafon, c.budget_ads_plafon;
