ALTER TABLE videos
ADD COLUMN concept_updated_at TIMESTAMPTZ,
ADD COLUMN concept_updated_by TEXT;
