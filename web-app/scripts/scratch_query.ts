import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function run() {
  const { data: camps } = await supabase.from('campaigns').select('id');
  const totalCamps = camps?.length || 0;
  
  const { data: cc } = await supabase.from('campaign_creators').select('creator_id, campaign_id');
  const creatorCounts: Record<number, Set<number>> = {};
  cc?.forEach(row => {
    if (!creatorCounts[row.creator_id]) creatorCounts[row.creator_id] = new Set();
    creatorCounts[row.creator_id].add(row.campaign_id);
  });
  
  const { data: creators } = await supabase.from('creators').select('id, username');
  const cMap: Record<number, string> = {};
  creators?.forEach(c => cMap[c.id] = c.username);
  
  const sorted = Object.entries(creatorCounts).map(([id, set]) => ({
    username: cMap[Number(id)],
    count: set.size
  })).sort((a,b) => b.count - a.count);
  
  console.log('Total Campaigns:', totalCamps);
  console.log('Top Creators:', sorted.slice(0, 10));
}
run();
