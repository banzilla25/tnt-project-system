-- 1. Tambahkan Index untuk mempercepat query mutasi
CREATE INDEX IF NOT EXISTS idx_payment_items_final_status ON payment_items(final_status);
CREATE INDEX IF NOT EXISTS idx_payment_batches_paid_at ON payment_batches(paid_at);

-- 2. Buat View untuk Mutasi Pembayaran agar mudah difilter, dipaginasi, dan disearch via Supabase JS
CREATE OR REPLACE VIEW vw_payment_mutations AS
SELECT 
  pi.id,
  pi.nominal,
  pi.biaya_transfer,
  pi.payment_type,
  pi.metode_pembayaran,
  pi.nama_penerima,
  pi.nomor_rekening,
  pi.notes,
  pi.final_status,
  pb.paid_at,
  pb.batch_label,
  pb.bukti_transfer,
  c.nama AS campaign_nama,
  cr.username,
  cb.bank_name,
  to_char(pb.paid_at AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') AS paid_month
FROM payment_items pi
JOIN payment_batches pb ON pi.batch_id = pb.id
JOIN campaigns c ON pb.campaign_id = c.id
JOIN campaign_creators cc ON pi.campaign_creator_id = cc.id
JOIN creators cr ON cc.creator_id = cr.id
LEFT JOIN creator_bank_accounts cb ON pi.bank_account_id = cb.id
WHERE pi.final_status = 'paid';
