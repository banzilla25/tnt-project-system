-- Add updated_by column to creator_snapshots to track who updated the snapshot
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS updated_by text;
