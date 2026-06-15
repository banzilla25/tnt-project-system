require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('campaign_creators')
    .select('id, price, creator_id')
    .eq('campaign_id', 17)
    .is('price', null);
  
  if (error) throw error;
  console.log("Campaign creators with null price:", data);
}

run().catch(console.error);
