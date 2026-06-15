require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('campaign_creators')
    .select(`
      id,
      creator_id,
      creators (username)
    `)
    .eq('campaign_id', 17);
  
  if (error) throw error;
  console.log("Total creators in campaign 17:", data.length);
  console.log("First 5 creators in campaign 17:", data.slice(0, 5).map(c => c.creators.username));
}

run().catch(console.error);
