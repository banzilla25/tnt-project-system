ALTER TABLE campaigns
ADD COLUMN target_creator_live INTEGER DEFAULT 0,
ADD COLUMN target_creator_live_nano INTEGER DEFAULT 0,
ADD COLUMN target_creator_live_micro INTEGER DEFAULT 0,
ADD COLUMN target_creator_live_macro INTEGER DEFAULT 0,
ADD COLUMN target_creator_live_mega INTEGER DEFAULT 0;
