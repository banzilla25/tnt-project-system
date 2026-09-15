
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabaseAdmin.rpc('get_table_info', { table_name: 'payment_batches' });
  // Since rpc is missing, just use SQL via postgrest if possible. Wait, we can't run raw SQL from client.
}
test();

