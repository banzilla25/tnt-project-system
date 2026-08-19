const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: campaign } = await supabase.from('campaigns').select('start_date, end_date').eq('id', 33).single();
  console.log("Campaign 33 dates:", campaign);
  
  const { data: stats33 } = await supabase.rpc('get_campaign_daily_stats', { p_campaign_id: 33 });
  let dbTotal = 0;
  if(stats33) {
    stats33.forEach(s => {
      if (s.date_str >= campaign.start_date && s.date_str <= campaign.end_date) {
        dbTotal += Number(s.total_gmv || 0);
      }
    });
  }
  console.log("Total DB Daily Stats GMV for 33 (Filtered by date):", dbTotal.toLocaleString('id-ID'));
}

run();
