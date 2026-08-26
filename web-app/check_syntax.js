require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.from('payment_items').select('id, final_status').not('final_status', 'in', '("paid", "rejected", "cancelled")').limit(3);
  console.log('Using string:', error || data);

  const { data: d2, error: e2 } = await supabaseAdmin.from('payment_items').select('id, final_status').not('final_status', 'in', '("paid","rejected","cancelled")').limit(3);
  console.log('Using string no spaces:', e2 || d2);
}
check();
