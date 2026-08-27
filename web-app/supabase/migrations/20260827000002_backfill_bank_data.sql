-- 20260827000002_backfill_bank_data.sql
-- Skrip ini akan menyalin data bank dari profil ke transaksi masa lalu yang masih kosong.
-- Ini penting agar histori mutasi masa lalu terkunci permanen dan tidak berubah jika profil kreator diupdate di masa depan.

UPDATE payment_items pi
SET 
  metode_pembayaran = cb.bank_name,
  nomor_rekening = cb.account_number,
  nama_penerima = cb.account_holder
FROM creator_bank_accounts cb
WHERE pi.bank_account_id = cb.id 
  AND (
    pi.metode_pembayaran IS NULL OR 
    pi.metode_pembayaran = '' OR 
    pi.metode_pembayaran = '-' OR
    pi.nama_penerima IS NULL OR
    pi.nama_penerima = '' OR
    pi.nama_penerima = '-'
  );
