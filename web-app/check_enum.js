
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { error } = await supabaseAdmin.from('payment_batches').update({ status: 'pending_executive_1' }).eq('id', 0);
  console.log(error);
}
check();

