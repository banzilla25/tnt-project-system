-- Hapus kolom followers yang lama (tipe integer)
ALTER TABLE creator_snapshots DROP COLUMN IF EXISTS followers;

-- Tambahkan kolom baru audience_age (tipe varchar)
ALTER TABLE creator_snapshots ADD COLUMN audience_age VARCHAR(50);
