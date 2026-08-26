
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.rpc('run_sql', { sql: 'SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = \'payment_batches_status_check\'' });
  console.log(data, error);
}
check();

