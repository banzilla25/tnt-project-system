
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data: paidItems, error: itemsErr } = await supabase
    .from('payment_items')
    .select('payment_type, nominal, biaya_transfer, payment_batches!inner(campaign_id)')
    .eq('final_status', 'paid');
  console.log('paidItems:', JSON.stringify(paidItems, null, 2));
  console.log('error:', itemsErr);
}
test();

