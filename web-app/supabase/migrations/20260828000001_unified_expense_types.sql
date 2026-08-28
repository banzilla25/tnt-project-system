-- 20260828000001_unified_expense_types.sql
-- Update payment_type constraint to include boost_awareness and remove boost_views/boost_comment

DO $$ 
DECLARE
  constraint_name text;
BEGIN
  -- Find the constraint name for payment_type check
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'payment_items'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%payment_type%';

  -- Drop the old constraint if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE payment_items DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;

  -- Update existing rows to use the new type
  UPDATE payment_items 
  SET payment_type = 'boost_awareness' 
  WHERE payment_type IN ('boost_views', 'boost_comment');

  -- Add the new constraint
  ALTER TABLE payment_items
  ADD CONSTRAINT payment_items_payment_type_check 
  CHECK (payment_type IN (
    '100_akhir',
    '50_awal',
    '50_akhir',
    'ads',
    'crm',
    'lion',
    'reward_affiliate',
    'boost_awareness'
  ));
END $$;
