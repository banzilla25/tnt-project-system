require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixLinks() {
  const fetchAll = async (table, cols) => {
    let all = [];
    let from = 0;
    let hasMore = true;
    while(hasMore) {
      const { data, error } = await supabase.from(table).select(cols).range(from, from + 999);
      if (error) break;
      if (data.length > 0) { all = [...all, ...data]; from += 1000; }
      if (data.length < 1000) hasMore = false;
    }
    return all;
  };

  const videos = await fetchAll('videos', 'id, content_uid, campaign_creator_id, link_video');
  const ccs = await fetchAll('campaign_creators', 'id, creator_id');
  const creators = await fetchAll('creators', 'id, username');
  
  // Filter videos that actually have content_uid
  const validVideos = videos.filter(v => v.content_uid);
  console.log(`Found ${validVideos.length} videos with content_uid`);
  
  let updated = 0;
  for (const v of validVideos) {
    const cc = ccs.find(c => c.id === v.campaign_creator_id);
    if (!cc) continue;
    
    const creator = creators.find(c => c.id === cc.creator_id);
    if (!creator) continue;
    
    // Ensure username starts with @
    const username = creator.username.startsWith('@') ? creator.username : `@${creator.username}`;
    
    const longLink = `https://www.tiktok.com/${username}/video/${v.content_uid}`;
    
    if (v.link_video !== longLink) {
      const { error } = await supabase.from('videos').update({ link_video: longLink }).eq('id', v.id);
      if (!error) {
        updated++;
      }
    }
  }
  
  console.log(`Updated ${updated} video links to long format.`);
}

fixLinks();
