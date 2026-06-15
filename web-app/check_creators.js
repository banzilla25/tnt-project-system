require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: c1 } = await supabase.from('creators').select('id, username').eq('username', 'nris9').single();
  console.log('nris9 creator_id:', c1?.id);
  const { data: cc1 } = await supabase.from('campaign_creators').select('*').eq('creator_id', c1?.id).eq('campaign_id', 15);
  console.log('nris9 in campaign 15:', cc1);

  const { data: c2 } = await supabase.from('creators').select('id, username').eq('username', 'arnilawati').single();
  console.log('arnilawati creator_id:', c2?.id);
  const { data: cc2 } = await supabase.from('campaign_creators').select('*').eq('creator_id', c2?.id).eq('campaign_id', 15);
  console.log('arnilawati in campaign 15:', cc2);
}
run();
