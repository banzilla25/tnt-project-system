
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { error } = await supabaseAdmin.from('payment_batches').update({ status: 'ready_to_pay' }).eq('id', 55);
  console.log('Update to ready_to_pay:', error);
}
check();

