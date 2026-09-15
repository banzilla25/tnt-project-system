
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  console.log('Fetching batches...');
  const { data, error } = await supabase.from('payment_batches').select('\
    *,\
    submitter:profiles!submitted_by(nama),\
    campaigns(nama),\
    payment_items(id, nominal, biaya_transfer, final_status, payment_type)\
  ').order('created_at', { ascending: false });
  console.log('Batches result:', data ? data.length : 0, error);

  console.log('Fetching summary...');
  const { data: cData, error: cErr } = await supabase.from('campaigns').select('id, nama, budget_creator_plafon, budget_ads_plafon, status').neq('status', 'draft');
  console.log('Summary result:', cData ? cData.length : 0, cErr);
}
test();

