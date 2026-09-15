require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function alterDb() {
  const sql = `
    ALTER TABLE payment_batches ADD COLUMN IF NOT EXISTS executive_reviewed_1_by uuid REFERENCES auth.users(id);
    ALTER TABLE payment_batches ADD COLUMN IF NOT EXISTS executive_reviewed_1_at timestamptz;
    
    ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS executive_1_status varchar(50);
    ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS executive_1_note text;
    ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS executive_1_acted_by uuid REFERENCES auth.users(id);
    ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS executive_1_acted_at timestamptz;
  `;
  
  const { data, error } = await supabaseAdmin.rpc('run_sql', { sql });
  console.log('SQL Execution result:', { data, error });
}

alterDb();
