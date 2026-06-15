const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  const { data: creator } = await supabase.from('creators').select('*').eq('id', 680).single();
  console.log("Creator:", creator);

  const { data: cc } = await supabase.from('campaign_creators').select('*').eq('creator_id', 680);
  console.log("Campaign Creators:", cc);

  const ccIds = cc.map(c => c.id);
  const { data: videos } = await supabase.from('videos').select('*').in('campaign_creator_id', ccIds);
  console.log("Videos:", videos);
}

inspect();
