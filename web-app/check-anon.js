require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Fetching with ANON KEY...");
  const { data, error } = await supabaseAnon
    .from('campaign_creators')
    .select('id')
    .eq('campaign_id', 17);
    
  if (error) console.error(error);
  else console.log(`Anon key fetched ${data.length} rows for campaign 17`);
}

run().catch(console.error);
