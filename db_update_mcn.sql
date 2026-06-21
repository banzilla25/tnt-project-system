-- Menambahkan kolom MCN ke tabel creators
ALTER TABLE creators ADD COLUMN IF NOT EXISTS mcn text;
