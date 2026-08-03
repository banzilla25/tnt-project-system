import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // 1. Check RPC
  const { data: rpcData } = await supabase.rpc('get_campaign_creator_counts', { p_campaign_id: 41 });
  console.log("RPC:", rpcData);

  // 2. Fetch raw creators
  const { data: raw } = await supabase
    .from('campaign_creators')
    .select('id, approval, creators(username)')
    .eq('campaign_id', 41);
    
  let approved = 0, pending = 0, alternate = 0, not_approved = 0;
  raw.forEach(r => {
      if (r.approval === 'approved') approved++;
      if (r.approval === 'pending') pending++;
      if (r.approval === 'alternate') alternate++;
      if (r.approval === 'not_approved') not_approved++;
  });
  console.log("Raw count:", { total: raw.length, approved, pending, alternate, not_approved });
}

check();
