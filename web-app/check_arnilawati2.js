require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const payload = {
    campaign_id: 15,
    creator_id: 446,
    gmv_organic_legacy: 0,
    gmv_ads_legacy: Math.round(34475344.92),
    approval: 'approved',
    price: 0,
    quantity_video: 1,
    status_video: 'belum',
    link_video: '-'
  };
  console.log('Inserting payload:', payload);
  const { data, error } = await supabase.from('campaign_creators').insert(payload);
  console.log('Insert error:', error);
  console.log('Insert data:', data);
  process.exit(0);
}
run();
