
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.from('payment_batches').select('id, status').limit(1);
  if (data && data.length > 0) {
    const testId = data[0].id;
    const { error: err2 } = await supabaseAdmin.from('payment_batches').update({ status: 'pending_executive_1' }).eq('id', testId);
    console.log('Update Error:', err2);
    // revert
    await supabaseAdmin.from('payment_batches').update({ status: data[0].status }).eq('id', testId);
  }
}
check();

