const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function resolveDuplicates() {
  console.log("Fetching all campaign_creators...");
  
  let allData = [];
  let start = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('campaign_creators')
      .select(`
        *,
        creators ( username ),
        videos ( id, urutan, concept, link_video, vt_approval )
      `)
      .range(start, start + pageSize - 1);

    if (error) {
      console.error("Error:", error);
      return;
    }
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    start += pageSize;
  }

  const groupings = {};
  for (const row of allData) {
    const key = `${row.campaign_id}_${row.creator_id}`;
    if (!groupings[key]) groupings[key] = [];
    groupings[key].push(row);
  }

  let duplicateCount = 0;
  for (const [key, rows] of Object.entries(groupings)) {
    if (rows.length > 1) {
      duplicateCount++;
      const [campaignId, creatorId] = key.split('_');
      console.log(`\n================================`);
      console.log(`Duplicate: Campaign ${campaignId}, Creator ${creatorId}, Username: ${rows[0].creators?.username}`);
      
      // Calculate score for each
      rows.forEach(r => {
        let score = 0;
        if (r.approval === 'approved') score += 10;
        else if (r.approval !== 'pending') score += 5;
        if (r.price > 0) score += 2;
        if (r.qty_vt > 1) score += 1;
        if (r.sample_progress && r.sample_progress.toLowerCase() !== 'belum') score += 2;
        if (r.status_bayar && r.status_bayar.toLowerCase() !== 'belum') score += 2;
        if (r.notes_manager) score += 1;
        if (r.notes_pic) score += 1;
        if (r.videos && r.videos.length > 0) score += 20; // Videos are very important
        r._score = score;
        
        console.log(`ID: ${r.id}, Approval: ${r.approval}, Videos: ${r.videos?.length}, Score: ${score}, Price: ${r.price}, Sample: ${r.sample_progress}`);
      });
      
      rows.sort((a, b) => b._score - a._score);
      const keep = rows[0];
      const deleteRows = rows.slice(1);
      
      console.log(`-> Keep ID: ${keep.id}`);
      
      for (const d of deleteRows) {
        console.log(`-> Delete ID: ${d.id}`);
        // Wait, if the deleted row has videos, we must move them!
        if (d.videos && d.videos.length > 0) {
           console.log(`   WARNING: ID ${d.id} has ${d.videos.length} videos. Need to move them to ${keep.id}`);
           // We will reassign video.campaign_creator_id = keep.id
           for (const v of d.videos) {
             console.log(`     Move Video ${v.id}`);
             await supabase.from('videos').update({ campaign_creator_id: keep.id }).eq('id', v.id);
           }
        }
        
        // Now delete the row
        console.log(`   Deleting campaign_creator ${d.id}`);
        await supabase.from('campaign_creators').delete().eq('id', d.id);
      }
    }
  }

  console.log(`\nProcessed ${duplicateCount} duplicate groups.`);
}

resolveDuplicates();
