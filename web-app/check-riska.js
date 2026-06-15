require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: creators, error: err1 } = await supabase
    .from('creators')
    .select('*')
    .ilike('username', '%riska%');
  
  console.log("Creators matching riska:", creators);

  if (creators && creators.length > 0) {
    const creatorIds = creators.map(c => c.id);
    const { data: ccs, error: err2 } = await supabase
      .from('campaign_creators')
      .select('*')
      .eq('campaign_id', 17)
      .in('creator_id', creatorIds);
      
    console.log("Campaign Creators for riska:", ccs);
  }
}
run().catch(console.error);
