const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data } = await supabase.from('payment_items').select('id').limit(1);
  if (!data || data.length === 0) return;
  const id = data[0].id;
  
  const { error } = await supabase.from('payment_items').update({ finance_selected: true }).eq('id', id);
  console.log('Update finance_selected:', error ? error.message : 'SUCCESS');
}

test();
