
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data, error } = await supabase.from('payment_batches').select('\
    *,\
    submitter:profiles!submitted_by(nama),\
    campaigns(nama),\
    payment_items(id, nominal, biaya_transfer, final_status, payment_type)\
  ').order('created_at', { ascending: false });
  console.log('batches:', data, 'error:', error);
}
test();

