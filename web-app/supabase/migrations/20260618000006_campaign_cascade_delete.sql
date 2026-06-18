-- Fix: Add ON DELETE CASCADE to all tables referencing campaigns
-- This ensures deleting a campaign removes all related data automatically

-- First drop existing foreign key constraints that reference campaigns
ALTER TABLE campaign_creators DROP CONSTRAINT IF EXISTS campaign_creators_campaign_id_fkey;
ALTER TABLE daily_performance DROP CONSTRAINT IF EXISTS daily_performance_campaign_id_fkey;

-- Re-add with ON DELETE CASCADE
ALTER TABLE campaign_creators 
  ADD CONSTRAINT campaign_creators_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

ALTER TABLE daily_performance 
  ADD CONSTRAINT daily_performance_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- Also check and fix sales table if it references campaigns
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_campaign_id_fkey;
ALTER TABLE sales 
  ADD CONSTRAINT sales_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- ads_performance
ALTER TABLE ads_performance DROP CONSTRAINT IF EXISTS ads_performance_campaign_id_fkey;
ALTER TABLE ads_performance 
  ADD CONSTRAINT ads_performance_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- live_schedules reference campaign_creators which already cascade
-- creator_addresses reference campaign_creators which already cascade
-- videos reference campaign_creators which already cascade

-- Add unique constraint on campaign name (case-insensitive) at DB level
-- Using LOWER() function-based unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_nama_lower ON campaigns (LOWER(nama));
