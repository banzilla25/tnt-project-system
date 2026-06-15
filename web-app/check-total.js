require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: ccs, error, count } = await supabase
    .from('campaign_creators')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', 17);
  
  if (error) throw error;
  console.log("Total creators in campaign 17:", count);
}

run().catch(console.error);
