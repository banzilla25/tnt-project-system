require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('campaign_creators').update({ gmv_ads_legacy: 26643823.51 }).eq('campaign_id', 15).eq('creator_id', 12345); // just test the update
  console.log('Update Error:', error);

  const ccs = await supabase.from('campaign_creators').select('id, creator:creators(username), gmv_organic_legacy, gmv_ads_legacy').eq('campaign_id', 15);
  let total = 0;
  let log = '';
  ccs.data.forEach(c => {
    let sum = (c.gmv_organic_legacy || 0) + (c.gmv_ads_legacy || 0);
    total += sum;
    if (sum > 0) log += `${c.creator.username}: ${sum}\n`;
  });
  console.log(log);
  console.log(`Total: ${total}`);
  process.exit(0);
}
run();
