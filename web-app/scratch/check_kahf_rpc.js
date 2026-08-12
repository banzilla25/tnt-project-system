const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false }
  }
);

async function check() {
  try {
    const { data: videoStats } = await supabase.rpc('get_campaign_video_stats', { p_campaign_id: 48 });
    console.log('Video stats RPC length:', videoStats?.length);
    if (videoStats?.length > 0) {
       console.log('Sample:', videoStats[0]);
    }
    
    // Check get_performance_summary_v2 for KAHF
    const { data: perf } = await supabase.rpc('get_performance_summary_v2', { p_campaign_id: 48 });
    console.log('Perf summary:', perf);
  } catch (e) {
    console.error(e);
  }
}

check();
