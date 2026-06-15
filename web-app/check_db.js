const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: creator1 } = await supabase.from('creators').select('id, username').eq('username', 'riskadiana22').single();
  const { data: cc1 } = await supabase.from('campaign_creators').select('id').eq('creator_id', creator1.id);
  const { data: vids1 } = await supabase.from('videos').select('*').in('campaign_creator_id', cc1.map(c => c.id));
  console.log('riskadiana22 videos:', vids1);

  const { data: creator2 } = await supabase.from('creators').select('id, username').eq('username', 'nurulaini280902').single();
  const { data: cc2 } = await supabase.from('campaign_creators').select('id').eq('creator_id', creator2.id);
  const { data: vids2 } = await supabase.from('videos').select('*').in('campaign_creator_id', cc2.map(c => c.id));
  console.log('nurulaini280902 videos:', vids2);
}

check();
