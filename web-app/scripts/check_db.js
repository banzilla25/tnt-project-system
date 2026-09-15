
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.rpc('get_constraints'); // Doesn't exist, we can just run a bad update to see if it fails.
  const { error: e } = await supabaseAdmin.from('payment_batches').update({ status: 'ready_to_pay' }).eq('id', 4);
  console.log('Update ready_to_pay:', e);
}
check();

