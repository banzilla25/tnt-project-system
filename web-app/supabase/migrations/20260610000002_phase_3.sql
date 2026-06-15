-- Fase 3 Schema Migration: Payout & Budgeting

-- 1. Add status_bayar to campaign_creators
ALTER TABLE campaign_creators
ADD COLUMN status_bayar text NOT NULL DEFAULT 'belum' CHECK (status_bayar IN ('belum', 'sebagian', 'lunas'));

-- 2. payout_requests
CREATE TABLE payout_requests (
    id serial PRIMARY KEY,
    campaign_id int NOT NULL REFERENCES campaigns(id),
    jenis_topup text NOT NULL CHECK (jenis_topup IN ('creator', 'ads')),
    nominal bigint NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. payout_creator
CREATE TABLE payout_creator (
    id serial PRIMARY KEY,
    payout_id int NOT NULL REFERENCES payout_requests(id) ON DELETE CASCADE,
    campaign_creator_id int NOT NULL REFERENCES campaign_creators(id),
    nominal bigint NOT NULL,
    tanggal_transfer date,
    bukti_transfer_url text
);

-----------------------------------------
-- TRIGGERS (Auto-Audit for status_bayar)
-----------------------------------------

-- Trigger audit for campaign_creators.status_bayar
CREATE OR REPLACE FUNCTION log_cc_status_bayar_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status_bayar <> OLD.status_bayar THEN
        INSERT INTO audit_logs (tabel, record_id, field, nilai_lama, nilai_baru, diubah_oleh)
        VALUES ('campaign_creators', NEW.id, 'status_bayar', OLD.status_bayar, NEW.status_bayar, 'System/Finance');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cc_status_bayar
AFTER UPDATE OF status_bayar ON campaign_creators
FOR EACH ROW EXECUTE FUNCTION log_cc_status_bayar_changes();
