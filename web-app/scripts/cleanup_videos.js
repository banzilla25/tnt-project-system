const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupVideos() {
  const { data: allVideos, error } = await supabase.from('videos').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  // Find duplicates
  const seen = new Set();
  const toDelete = [];
  
  // Sort by created_at asc, so we keep the first one
  allVideos.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  
  for (const v of allVideos) {
    if (!v.content_uid) continue;
    const key = `${v.campaign_creator_id}_${v.content_uid}`;
    if (seen.has(key)) {
      toDelete.push(v.id);
    } else {
      seen.add(key);
    }
  }
  
  console.log(`Found ${toDelete.length} duplicate videos to delete.`);
  
  if (toDelete.length > 0) {
    // Delete in chunks of 1000
    for (let i = 0; i < toDelete.length; i+=1000) {
      const chunk = toDelete.slice(i, i+1000);
      const { error: delErr } = await supabase.from('videos').delete().in('id', chunk);
      if (delErr) {
        console.error("Error deleting:", delErr);
      } else {
        console.log(`Deleted chunk ${i} to ${i+chunk.length}`);
      }
    }
  }

  // Next, we need to fix the 'urutan' for the remaining videos
  const { data: cleanVideos } = await supabase.from('videos').select('*');
  const ccGroups = {};
  for (const v of cleanVideos) {
    if (!ccGroups[v.campaign_creator_id]) ccGroups[v.campaign_creator_id] = [];
    ccGroups[v.campaign_creator_id].push(v);
  }

  const toUpdate = [];
  for (const ccId in ccGroups) {
    const vids = ccGroups[ccId];
    // Sort by created_at asc to assign urutan 1, 2, 3...
    vids.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    let urutan = 1;
    for (const v of vids) {
      if (v.urutan !== urutan) {
        toUpdate.push({ id: v.id, urutan });
      }
      urutan++;
    }
  }

  console.log(`Found ${toUpdate.length} videos needing urutan fix.`);

  if (toUpdate.length > 0) {
    for (const v of toUpdate) {
      await supabase.from('videos').update({ urutan: v.urutan }).eq('id', v.id);
    }
    console.log("Urutan fixed.");
  }
}

cleanupVideos();
