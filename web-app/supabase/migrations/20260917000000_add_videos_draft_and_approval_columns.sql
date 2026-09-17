-- Migration: Add missing draft & approval columns to videos table and update vt_approval check constraint

ALTER TABLE videos ADD COLUMN IF NOT EXISTS link_draft text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS vt_approved_by text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS vt_approved_at timestamptz;

-- Drop old check constraint if exists and add updated one allowing 'revisi'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'videos' AND constraint_name = 'videos_vt_approval_check'
  ) THEN
    ALTER TABLE videos DROP CONSTRAINT videos_vt_approval_check;
  END IF;
  
  ALTER TABLE videos ADD CONSTRAINT videos_vt_approval_check CHECK (vt_approval IN ('pending', 'approved', 'reject', 'revisi'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
