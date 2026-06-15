require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: ccs, error } = await supabase
    .from('campaign_creators')
    .select('*')
    .eq('campaign_id', 17);
  
  if (error) throw error;

  const creatorMap = {};
  for (const cc of ccs) {
    if (!creatorMap[cc.creator_id]) {
      creatorMap[cc.creator_id] = [];
    }
    creatorMap[cc.creator_id].push(cc);
  }

  let deletedCount = 0;
  for (const [creatorId, records] of Object.entries(creatorMap)) {
    if (records.length > 1) {
      // Sort by id descending
      records.sort((a, b) => b.id - a.id);
      
      const newest = records[0]; // The one from Excel
      const oldest = records[records.length - 1]; // The one that is likely referenced by videos

      console.log(`Creator ${creatorId} has duplicates. Keeping ID: ${oldest.id}, but updating with data from ${newest.id}`);
      
      // Update the oldest with data from newest
      await supabase.from('campaign_creators').update({
        tier: newest.tier,
        price: newest.price,
        qty_vt: newest.qty_vt,
        approval: newest.approval,
        pic_assist: newest.pic_assist,
        notes_manager: newest.notes_manager,
        notes_pic: newest.notes_pic,
        sample_progress: newest.sample_progress
      }).eq('id', oldest.id);

      // Keep the oldest one, delete the rest
      const toDelete = records.filter(r => r.id !== oldest.id).map(r => r.id);
      console.log(`Deleting IDs: ${toDelete.join(', ')}`);
      
      const { error: delErr } = await supabase
        .from('campaign_creators')
        .delete()
        .in('id', toDelete);
        
      if (delErr) {
        console.error(`Failed to delete for creator ${creatorId}:`, delErr);
      } else {
        deletedCount += toDelete.length;
      }
    }
  }

  console.log(`Cleanup complete. Deleted ${deletedCount} duplicate records.`);
}

run().catch(console.error);
