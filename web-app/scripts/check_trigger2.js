
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabaseAdmin.from('payment_batches').select('*').eq('id', 55); // The user's batch in the screenshot is 'Batch - Agustus 2026', let's find it.
  console.log(data, error);
}
check();

