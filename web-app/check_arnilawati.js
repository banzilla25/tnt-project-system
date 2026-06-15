require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: creator } = await supabase.from('creators').select('id').eq('username', 'arnilawati').single();
  const payload = { gmv_organic_legacy: 0, gmv_ads_legacy: Math.round(34475344.92) };
  
  const { error } = await supabase.from('campaign_creators').insert({
    campaign_id: 15,
    creator_id: creator.id,
    ...payload,
    approval: 'approved'
  });
  console.log('Insert error:', error);
  process.exit(0);
}
run();
