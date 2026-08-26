
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.from('payment_batches').select('executive1:profiles!payment_batches_executive_reviewed_1_by_fkey(nama)').limit(1);
  console.log('Using exact fk name:', error);

  const { data: d2, error: e2 } = await supabaseAdmin.from('payment_batches').select('executive1:profiles!executive_reviewed_1_by(nama)').limit(1);
  console.log('Using column name:', e2);
}
check();

