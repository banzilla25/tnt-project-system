
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.from('payment_items').select('id, final_status, executive_1_status').limit(1);
  if (data && data.length > 0) {
    const testId = data[0].id;
    const { error: err2 } = await supabaseAdmin.from('payment_items').update({ final_status: 'executive_1_approved', executive_1_status: 'approved' }).eq('id', testId);
    console.log('Update Error:', err2);
    // revert
    await supabaseAdmin.from('payment_items').update({ final_status: data[0].final_status, executive_1_status: data[0].executive_1_status }).eq('id', testId);
  }
}
check();

