const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteDups() {
  const { data: allVideos, error } = await supabase.from('videos').select('*').limit(100000);
  
  const seen = new Set();
  const toDelete = [];
  
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
  
  console.log("IDs to delete:", toDelete);
  
  for (const id of toDelete) {
    console.log(`Deleting ${id}...`);
    const { error: err } = await supabase.from('videos').delete().eq('id', id);
    if (err) console.error("Error deleting", id, ":", err.message);
    else console.log(`Deleted ${id} successfully.`);
  }

  // Update urutan for the rest
  const { data: cleanVideos } = await supabase.from('videos').select('*').limit(100000);
  const ccGroups = {};
  for (const v of cleanVideos) {
    if (!ccGroups[v.campaign_creator_id]) ccGroups[v.campaign_creator_id] = [];
    ccGroups[v.campaign_creator_id].push(v);
  }

  let count = 0;
  for (const ccId in ccGroups) {
    const vids = ccGroups[ccId];
    vids.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    let urutan = 1;
    for (const v of vids) {
      if (v.urutan !== urutan) {
        await supabase.from('videos').update({ urutan }).eq('id', v.id);
        count++;
      }
      urutan++;
    }
  }
  console.log(`Fixed urutan for ${count} videos.`);
}

deleteDups();
