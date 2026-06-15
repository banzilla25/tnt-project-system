require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('vw_campaign_summary').select('*').eq('nama', 'OMG Skincare');
  console.log('Campaign Summary:', JSON.stringify(data, null, 2));
}
run();
