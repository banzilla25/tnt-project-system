ALTER TABLE campaigns
ADD COLUMN target_creator_nano INTEGER DEFAULT 0,
ADD COLUMN target_creator_micro INTEGER DEFAULT 0,
ADD COLUMN target_creator_macro INTEGER DEFAULT 0,
ADD COLUMN target_creator_mega INTEGER DEFAULT 0;
