const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_creators_constraints');
  if (error) console.log('RPC failed, trying raw data check.');
  
  const { data: d2 } = await supabase.from('creators').select('username').limit(10000);
  const map = {};
  let dups = 0;
  for (const c of d2) {
     if (map[c.username]) dups++;
     map[c.username] = true;
  }
  console.log(`Creator Pool Duplicates found: ${dups}`);
}
check();
