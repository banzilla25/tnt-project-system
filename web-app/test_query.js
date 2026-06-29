require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
        .from('campaign_creators')
        .select(`
          id, approval, approved_at, created_at, added_by, tier,
          creators (
            creator_snapshots ( tier )
          )
        `)
        .eq('campaign_id', 33)
        .limit(5);
        
  console.log(JSON.stringify(data, null, 2));
}

test();
