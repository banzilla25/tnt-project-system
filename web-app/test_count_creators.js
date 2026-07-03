import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const campaignId = 44;
  
  const { count: approvedCount } = await supabase
    .from('campaign_creators')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('approval', 'approved');
    
  console.log('Approved Creators Count:', approvedCount);
  
  // Find how many unique creators have videos
  // For videos table
  const { data: ccData } = await supabase
    .from('campaign_creators')
    .select('id, creators(username)')
    .eq('campaign_id', campaignId)
    .eq('approval', 'approved');
    
  const ccIds = ccData.map(c => c.id);
  
  let videoCcIds = new Set();
  
  let from = 0;
  while(true) {
      const { data: vData } = await supabase
        .from('videos')
        .select('campaign_creator_id')
        .in('campaign_creator_id', ccIds.slice(from, from+500));
      
      if (vData) {
          vData.forEach(v => videoCcIds.add(v.campaign_creator_id));
      }
      from += 500;
      if (from >= ccIds.length) break;
  }
  
  console.log('Creators with entries in videos table:', videoCcIds.size);
  
  // For organic_videos (VT) table, matched by username
  let organicVtUsernames = new Set();
  let from2 = 0;
  const usernames = ccData.map(c => c.creators?.username).filter(Boolean);
  
  while(true) {
      const { data: oData } = await supabase
        .from('organic_videos')
        .select('creator_username')
        .in('creator_username', usernames.slice(from2, from2+500));
      
      if (oData) {
          oData.forEach(v => organicVtUsernames.add(v.creator_username));
      }
      from2 += 500;
      if (from2 >= usernames.length) break;
  }
  
  console.log('Creators with entries in organic_videos table:', organicVtUsernames.size);
  
  const totalCcWithVideo = new Set([...Array.from(videoCcIds).map(id => ccData.find(c => c.id === id).creators.username), ...Array.from(organicVtUsernames)]);
  console.log('Total unique creators with AT LEAST ONE video/VT:', totalCcWithVideo.size);
}

check();
