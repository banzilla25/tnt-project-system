
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data: batches } = await supabaseAdmin.from('payment_batches').select('*').limit(1);
  const { data: items } = await supabaseAdmin.from('payment_items').select('*').limit(1);
  console.log('batches cols:', Object.keys(batches[0] || {}));
  console.log('items cols:', Object.keys(items[0] || {}));
}
test();

