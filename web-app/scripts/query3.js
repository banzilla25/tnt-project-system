require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('campaign_creators').select('id, gmv_organic_legacy, gmv_ads_legacy').eq('campaign_id', 15);
  console.log('Error:', error);
  if(data) {
    let org = 0; let ads = 0;
    data.forEach(d => {
      org += d.gmv_organic_legacy || 0;
      ads += d.gmv_ads_legacy || 0;
    });
    console.log(`Campaign 15 Sums -> Organic: ${org}, Ads: ${ads}, Total: ${org + ads}`);
  }
}
run();
