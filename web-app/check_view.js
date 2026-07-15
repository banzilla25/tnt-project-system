require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_view_definition', { view_name: 'campaign_creators_performance' });
  console.log("RPC Data:", data);
  console.log("RPC Error:", error);
}

check();
