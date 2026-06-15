-- Fase 4 Schema Migration: Brand Portal & PIN

ALTER TABLE campaigns ADD COLUMN pin text DEFAULT '1234';
