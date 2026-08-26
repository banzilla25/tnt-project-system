
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data: campaigns, error: campErr } = await supabase
    .from('campaigns')
    .select('id, nama, budget_creator_plafon, budget_ads_plafon, status')
    .neq('status', 'draft');
  console.log('campaigns error:', campErr);

  const { data: paidItems, error: itemsErr } = await supabase
    .from('payment_items')
    .select('campaign_id, payment_type, nominal, biaya_transfer')
    .eq('final_status', 'paid');
  console.log('paidItems error:', itemsErr);
}
test();

