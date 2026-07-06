require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Fetching creators...");
  const { data, error } = await supabase.from('creators').select('*');
  if (error) {
    console.error("Error fetching creators:", error);
    return;
  }

  const map = new Map();
  const duplicates = [];

  for (const c of data) {
    if (!c.username) continue;
    const lower = c.username.toLowerCase();
    if (map.has(lower)) {
      duplicates.push({ lower, original_1: map.get(lower), original_2: c });
    } else {
      map.set(lower, c);
    }
  }

  console.log(`Found ${duplicates.length} duplicate pairs.`);

  for (const dup of duplicates) {
    // Keep the one with more data, or simply the smaller ID if equal
    let keep = dup.original_1;
    let del = dup.original_2;

    const countFields = (obj) => Object.values(obj).filter(v => v !== null && v !== '').length;
    if (countFields(del) > countFields(keep)) {
      keep = dup.original_2;
      del = dup.original_1;
    } else if (countFields(del) === countFields(keep) && del.id < keep.id) {
      keep = dup.original_2;
      del = dup.original_1;
    }

    console.log(`\nMerging [${del.username}] (ID: ${del.id}) -> [${keep.username}] (ID: ${keep.id})`);

    // 1. Merge basic fields in creators table
    const mergedFields = {};
    for (const key of Object.keys(keep)) {
      if ((keep[key] === null || keep[key] === '') && del[key] !== null && del[key] !== '') {
        mergedFields[key] = del[key];
      }
    }
    
    // Always lowercase the kept username
    mergedFields.username = keep.username.toLowerCase();

    if (Object.keys(mergedFields).length > 0) {
      console.log(`Updating keep creator (${keep.id}) with:`, mergedFields);
      await supabase.from('creators').update(mergedFields).eq('id', keep.id);
    }

    // 2. Relink simple child tables
    const tables = ['creator_contacts', 'creator_snapshots', 'creator_address_book', 'creator_niches', 'creator_notes'];
    for (const table of tables) {
      const { data: childData } = await supabase.from(table).select('id').eq('creator_id', del.id);
      if (childData && childData.length > 0) {
        console.log(`Re-linking ${childData.length} records in ${table}`);
        await supabase.from(table).update({ creator_id: keep.id }).eq('creator_id', del.id);
      }
    }

    // 3. Handle campaign_creators (Conflict resolution)
    const { data: keepCcs } = await supabase.from('campaign_creators').select('*').eq('creator_id', keep.id);
    const { data: delCcs } = await supabase.from('campaign_creators').select('*').eq('creator_id', del.id);
    
    const keepCampaignIds = keepCcs ? keepCcs.map(cc => cc.campaign_id) : [];

    for (const delCc of (delCcs || [])) {
      if (keepCampaignIds.includes(delCc.campaign_id)) {
        // CONFLICT! Both are in the same campaign
        const keepCc = keepCcs.find(c => c.campaign_id === delCc.campaign_id);
        console.log(`Conflict in campaign ${delCc.campaign_id}. Merging CC ${delCc.id} into ${keepCc.id}`);
        
        // Merge CC fields
        const ccMerged = {};
        for (const key of Object.keys(keepCc)) {
          if (['id', 'campaign_id', 'creator_id', 'created_at'].includes(key)) continue;
          if ((keepCc[key] === null || keepCc[key] === '') && delCc[key] !== null && delCc[key] !== '') {
            ccMerged[key] = delCc[key];
          }
        }
        
        // Take the highest approval if applicable (approved > alternate > rejected > pending)
        const getScore = (app) => app === 'approved' ? 4 : app === 'alternate' ? 3 : app === 'pending' ? 2 : app === 'rejected' ? 1 : 0;
        if (getScore(delCc.approval) > getScore(keepCc.approval)) {
          ccMerged.approval = delCc.approval;
        }

        if (Object.keys(ccMerged).length > 0) {
          await supabase.from('campaign_creators').update(ccMerged).eq('id', keepCc.id);
        }

        // Relink campaign_creator_id dependencies
        const ccTables = ['creator_addresses']; 
        for (const ccTable of ccTables) {
          const { data: refs, error: errRef } = await supabase.from(ccTable).select('id').eq('campaign_creator_id', delCc.id);
          if (refs && refs.length > 0) {
            console.log(`Re-linking ${refs.length} records in ${ccTable}`);
            await supabase.from(ccTable).update({ campaign_creator_id: keepCc.id }).eq('campaign_creator_id', delCc.id);
          }
        }

        // Delete duplicate CC
        await supabase.from('campaign_creators').delete().eq('id', delCc.id);

      } else {
        // No conflict, just re-link
        console.log(`No conflict in campaign ${delCc.campaign_id}. Relinking CC ${delCc.id} to creator ${keep.id}`);
        await supabase.from('campaign_creators').update({ creator_id: keep.id }).eq('id', delCc.id);
      }
    }

    // 4. Delete the duplicate creator
    console.log(`Deleting duplicate creator ${del.id}`);
    const { error: delErr } = await supabase.from('creators').delete().eq('id', del.id);
    if (delErr) console.error("Error deleting:", delErr);
  }

  // Final step: convert all usernames to lowercase
  console.log("\nConverting all remaining usernames to lowercase...");
  const { data: allCreators } = await supabase.from('creators').select('id, username');
  let lowerCount = 0;
  for (const c of allCreators) {
    if (c.username && c.username !== c.username.toLowerCase()) {
      await supabase.from('creators').update({ username: c.username.toLowerCase() }).eq('id', c.id);
      lowerCount++;
    }
  }
  console.log(`Converted ${lowerCount} usernames to lowercase.`);
  
  console.log("\nMerge process completed!");
}

run();
