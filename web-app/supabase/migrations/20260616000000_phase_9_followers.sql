-- Add followers column to creator_snapshots
ALTER TABLE creator_snapshots ADD COLUMN IF NOT EXISTS followers BIGINT;

-- Note: We previously dropped followers because we thought it was completely replaced by audience_age.
-- Now we re-add it to live alongside audience_age, enabling auto-computation of Tiers.
