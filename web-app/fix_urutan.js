const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixUrutan() {
  console.log("Fetching all videos...");
  const { data: videos, error } = await supabase.from('videos').select('*').order('created_at', { ascending: true });
  
  if (error) {
    console.error("Error fetching videos:", error);
    return;
  }

  const grouped = {};
  for (const v of videos) {
    const cid = v.campaign_creator_id;
    if (!grouped[cid]) grouped[cid] = [];
    grouped[cid].push(v);
  }

  let updatedCount = 0;
  
  for (const cid in grouped) {
    const vids = grouped[cid];
    for (let i = 0; i < vids.length; i++) {
      const correctUrutan = i + 1;
      if (vids[i].urutan !== correctUrutan) {
        console.log(`Fixing video ID ${vids[i].id} for CC_ID ${cid}: urutan ${vids[i].urutan} -> ${correctUrutan}`);
        const { error: updateErr } = await supabase.from('videos').update({ urutan: correctUrutan }).eq('id', vids[i].id);
        if (updateErr) {
          console.error(`Failed to update video ID ${vids[i].id}:`, updateErr);
        } else {
          updatedCount++;
        }
      }
    }
  }

  console.log(`Finished fixing urutan. Total rows updated: ${updatedCount}`);
}

fixUrutan();
