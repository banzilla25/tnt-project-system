-- Migration: Add missing administration columns to creators table

ALTER TABLE creators ADD COLUMN IF NOT EXISTS nik text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS link_ktp text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS link_npwp text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS link_kontrak text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS nama_wa_pic text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS nomor_wa_dealing text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS alamat_ktp text;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS avatar_url text;
