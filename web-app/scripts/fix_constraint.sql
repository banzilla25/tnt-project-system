-- Script untuk memperbaiki CHECK constraint yang rusak di tabel payment_items

DO $$ 
DECLARE
  constraint_name text;
BEGIN
  -- 1. Cari nama constraint yang mengecek final_status
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'payment_items'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%final_status%';

  -- 2. Drop constraint yang lama (jika ada)
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE payment_items DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;

  -- 3. Tambahkan kembali constraint dengan SEMUA status yang valid
  ALTER TABLE payment_items
  ADD CONSTRAINT payment_items_final_status_check 
  CHECK (final_status IN (
    'pending',
    'manager_approved',
    'executive_1_approved',
    'pending_finance_outstanding',
    'finance_selected',
    'executive_approved',
    'ready_to_pay',
    'paid',
    'rejected'
  ));
END $$;
