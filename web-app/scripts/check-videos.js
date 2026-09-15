require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: ccs } = await supabase.from('campaign_creators').select('id').eq('campaign_id', 17);
  const ccIds = ccs.map(c => c.id);
  console.log(`Campaign 17 has ${ccIds.length} campaign_creators`);
  
  const { data: videos } = await supabase.from('videos').select('*').in('campaign_creator_id', ccIds);
  console.log(`Campaign 17 has ${videos.length} videos`);
  if (videos.length > 0) {
    console.log("First 2 videos:", videos.slice(0, 2));
  }
}

run().catch(console.error);
