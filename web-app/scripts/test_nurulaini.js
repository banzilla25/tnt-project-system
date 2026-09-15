require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: creator, error } = await s.from('creators').select('*').eq('username', 'nurulaini280902').single();
  if (error) {
    console.error("Creator err:", error);
    return;
  }
  console.log("Creator:", creator.id);
  
  const { data: cc } = await s.from('campaign_creators').select('*').eq('creator_id', creator.id).eq('campaign_id', 17).single();
  if (!cc) {
    console.log("No campaign creator");
    return;
  }
  
  const { data: videos } = await s.from('videos').select('*').eq('campaign_creator_id', cc.id);
  console.log("Videos:", videos);
}

check();
