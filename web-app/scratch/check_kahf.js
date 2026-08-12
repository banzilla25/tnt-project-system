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
    const { data: campaigns } = await supabase.from('campaigns').select('id, nama').in('id', [48, 49]);
    console.log('Campaigns:', campaigns);

    const { data: creators, error: errC } = await supabase.from('campaign_creators').select('id, approval').eq('campaign_id', 48);
    console.log('KAHF Creators:', creators?.length, errC ? errC.message : '');

    const ccIds = creators.map(c => c.id);
    if (ccIds.length > 0) {
      const { data: vids } = await supabase.from('videos').select('id, link_video').in('campaign_creator_id', ccIds);
      console.log('KAHF Videos:', vids?.length);

      const { data: stats } = await supabase.from('video_stats').select('views, gmv').in('campaign_creator_id', ccIds);
      console.log('KAHF Video Stats:', stats?.length);
      
      const totalViews = stats?.reduce((acc, curr) => acc + (curr.views || 0), 0) || 0;
      console.log('KAHF Total Views in stats:', totalViews);
    }
  } catch (e) {
    console.error(e);
  }
}

check();
