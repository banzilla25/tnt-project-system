require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkCampaigns() {
  const { data } = await supabase.from('campaigns').select('id, nama, start_date').order('id', { ascending: false }).limit(20);
  console.log("=== CAMPAIGNS ===");
  console.log(JSON.stringify(data, null, 2));
}

checkCampaigns().catch(console.error);
