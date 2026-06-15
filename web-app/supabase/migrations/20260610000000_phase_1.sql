-- Fase 1 Schema Migration

-- brands
CREATE TABLE brands (
    id serial PRIMARY KEY,
    nama text NOT NULL,
    status text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'arsip')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- campaigns
CREATE TABLE campaigns (
    id serial PRIMARY KEY,
    brand_id int NOT NULL REFERENCES brands(id),
    nama text NOT NULL,
    tipe_campaign text NOT NULL CHECK (tipe_campaign IN ('sales', 'awareness')),
    persiapan_14hari text,
    start_date date NOT NULL,
    end_date date NOT NULL,
    target_gmv bigint,
    target_video int,
    target_creator int,
    budget_creator_plafon bigint NOT NULL,
    budget_ads_plafon bigint NOT NULL,
    vsa_gmv_max bigint,
    pic text,
    assist text,
    file_concept_url text,
    status text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'selesai')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- creators
CREATE TABLE creators (
    id serial PRIMARY KEY,
    username text NOT NULL UNIQUE,
    nama_asli text,
    link_account text,
    rekening text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- creator_snapshots
CREATE TABLE creator_snapshots (
    id serial PRIMARY KEY,
    creator_id int NOT NULL REFERENCES creators(id),
    tanggal_update date NOT NULL,
    followers int,
    level int,
    gmv_30d bigint,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- creator_contacts
CREATE TABLE creator_contacts (
    id serial PRIMARY KEY,
    creator_id int NOT NULL REFERENCES creators(id),
    nomor text NOT NULL,
    status text NOT NULL CHECK (status IN ('aktif', 'arsip')),
    tanggal_mulai date NOT NULL,
    tanggal_diganti date
);

-- niches
CREATE TABLE niches (
    id serial PRIMARY KEY,
    nama text NOT NULL UNIQUE
);

-- creator_niches
CREATE TABLE creator_niches (
    creator_id int NOT NULL REFERENCES creators(id),
    niche_id int NOT NULL REFERENCES niches(id),
    peringkat int NOT NULL,
    PRIMARY KEY (creator_id, niche_id)
);

-- creator_notes
CREATE TABLE creator_notes (
    id serial PRIMARY KEY,
    creator_id int NOT NULL REFERENCES creators(id),
    isi text NOT NULL,
    penulis text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- campaign_creators
CREATE TABLE campaign_creators (
    id serial PRIMARY KEY,
    campaign_id int NOT NULL REFERENCES campaigns(id),
    creator_id int NOT NULL REFERENCES creators(id),
    tier text,
    price bigint NOT NULL,
    qty_vt int NOT NULL,
    approval text NOT NULL DEFAULT 'pending' CHECK (approval IN ('pending', 'approved', 'alternate', 'not_approved')),
    pic_assist text,
    notes_manager text,
    notes_pic text,
    sample_progress text,
    gmv_organic_legacy bigint,
    gmv_ads_legacy bigint,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cc_campaign ON campaign_creators(campaign_id);
CREATE INDEX idx_cc_creator ON campaign_creators(creator_id);

-- videos
CREATE TABLE videos (
    id serial PRIMARY KEY,
    campaign_creator_id int NOT NULL REFERENCES campaign_creators(id),
    urutan int NOT NULL,
    concept text,
    link_video text,
    content_uid text,
    vt_approval text NOT NULL DEFAULT 'pending' CHECK (vt_approval IN ('pending', 'approved', 'reject')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- audit_logs
CREATE TABLE audit_logs (
    id serial PRIMARY KEY,
    tabel text NOT NULL,
    record_id int NOT NULL,
    field text NOT NULL,
    nilai_lama text,
    nilai_baru text,
    diubah_oleh text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-----------------------------------------
-- VIEWS (Computed Columns per Spec)
-----------------------------------------

-- View for latest snapshot per creator
CREATE OR REPLACE VIEW vw_creator_latest_snapshot AS
SELECT DISTINCT ON (creator_id) *
FROM creator_snapshots
ORDER BY creator_id, tanggal_update DESC;

-- View combining creator with computed type and latest snapshot
CREATE OR REPLACE VIEW vw_creators_with_computed AS
SELECT 
    c.*,
    s.followers,
    s.level,
    s.gmv_30d,
    CASE 
        WHEN s.followers >= 1000000 THEN 'Mega'
        WHEN s.followers >= 100000 THEN 'Macro'
        WHEN s.followers >= 10000 THEN 'Micro'
        WHEN s.followers >= 1000 THEN 'Nano'
        ELSE 'Unknown'
    END as type
FROM creators c
LEFT JOIN vw_creator_latest_snapshot s ON c.id = s.creator_id;


-----------------------------------------
-- TRIGGERS (Auto-Audit and extraction)
-----------------------------------------

-- 1. Trigger audit for campaign_creators.price
CREATE OR REPLACE FUNCTION log_cc_price_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.price <> OLD.price THEN
        INSERT INTO audit_logs (tabel, record_id, field, nilai_lama, nilai_baru, diubah_oleh)
        VALUES ('campaign_creators', NEW.id, 'price', OLD.price::text, NEW.price::text, 'System'); 
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cc_price
AFTER UPDATE OF price ON campaign_creators
FOR EACH ROW EXECUTE FUNCTION log_cc_price_changes();

-- 2. Trigger audit for campaign_creators.approval
CREATE OR REPLACE FUNCTION log_cc_approval_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.approval <> OLD.approval THEN
        INSERT INTO audit_logs (tabel, record_id, field, nilai_lama, nilai_baru, diubah_oleh)
        VALUES ('campaign_creators', NEW.id, 'approval', OLD.approval, NEW.approval, 'System');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cc_approval
AFTER UPDATE OF approval ON campaign_creators
FOR EACH ROW EXECUTE FUNCTION log_cc_approval_changes();

-- 3. Trigger audit for videos.vt_approval
CREATE OR REPLACE FUNCTION log_video_approval_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.vt_approval <> OLD.vt_approval THEN
        INSERT INTO audit_logs (tabel, record_id, field, nilai_lama, nilai_baru, diubah_oleh)
        VALUES ('videos', NEW.id, 'vt_approval', OLD.vt_approval, NEW.vt_approval, 'System');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_video_approval
AFTER UPDATE OF vt_approval ON videos
FOR EACH ROW EXECUTE FUNCTION log_video_approval_changes();

-- 4. Auto extract content_uid from link_video
CREATE OR REPLACE FUNCTION extract_content_uid()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.link_video IS NOT NULL THEN
        NEW.content_uid := substring(NEW.link_video from '/video/([0-9]+)');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_extract_video_uid
BEFORE INSERT OR UPDATE OF link_video ON videos
FOR EACH ROW EXECUTE FUNCTION extract_content_uid();

-----------------------------------------
-- SEED DATA
-----------------------------------------
INSERT INTO niches (nama) VALUES ('makeup'), ('skincare'), ('home living'), ('lifestyle');

INSERT INTO brands (nama, status) VALUES 
('OMG Skincare', 'aktif'), 
('Wardah', 'aktif');

INSERT INTO campaigns (brand_id, nama, tipe_campaign, persiapan_14hari, start_date, end_date, target_gmv, target_video, target_creator, budget_creator_plafon, budget_ads_plafon, pic, status) 
VALUES 
(1, 'OMG Skincare - Ramadhan Sales', 'sales', '01 - 14 Mar', '2026-03-15', '2026-04-15', 500000000, null, null, 50000000, 20000000, 'Andi', 'aktif');
