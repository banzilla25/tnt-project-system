import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: raw } = await supabase
    .from('campaign_creators')
    .select('id, approval, tier, added_by, creators(username)')
    .eq('campaign_id', 41)
    .eq('approval', 'pending');
    
  console.log("Pending creators:", raw.map(r => ({
      id: r.id, 
      username: r.creators?.username, 
      tier: r.tier, 
      added_by: r.added_by
  })));
}

check();
