
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabaseAdmin.from('payment_batches').update({
    status: 'ready_to_pay',
    executive_reviewed_at: new Date().toISOString()
  }).eq('id', 4); // assuming the batch is 4 from earlier
  console.log('Update Error:', error);
}
test();

