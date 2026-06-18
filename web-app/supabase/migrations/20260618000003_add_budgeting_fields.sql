-- Migration for Campaign Creator Budgeting fields
ALTER TABLE public.campaign_creators ADD COLUMN IF NOT EXISTS nominal_pelunasan int8 DEFAULT 0;
ALTER TABLE public.campaign_creators ADD COLUMN IF NOT EXISTS tgl_pembayaran text;

-- Replace view if needed? The view vw_campaign_summary currently uses SUM(cc.price) as used_budget_creator.
-- If the user wants `Sisa Budget Campaign = Budget - Total Ratecard`, `used_budget_creator` is exactly `SUM(cc.price)`.
-- If the user wants it based on nominal_pelunasan, we can add it later. But currently, Total Ratecard (price) reduces the budget.
