const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Fetching campaign_video_dedup (awareness videos)...");
  let allVideos = [];
  let from = 0;
  let hasMore = true;
  while(hasMore) {
    const {data, error} = await supabase.from('campaign_video_dedup').select('*').range(from, from+999);
    if(error) { console.error(error); return; }
    if(data && data.length > 0) {
      allVideos = [...allVideos, ...data];
      if(data.length < 1000) hasMore = false;
      else from += 1000;
    } else hasMore = false;
  }
  
  console.log(`Found ${allVideos.length} unique videos from daily performance.`);
  
  console.log("Fetching all campaign_creators with creators...");
  let allCC = [];
  from = 0;
  hasMore = true;
  while(hasMore) {
    const {data, error} = await supabase.from('campaign_creators').select('id, campaign_id, creators(username)').range(from, from+999);
    if(error) { console.error(error); return; }
    if(data && data.length > 0) {
      allCC = [...allCC, ...data];
      if(data.length < 1000) hasMore = false;
      else from += 1000;
    } else hasMore = false;
  }
  
  // Mapping
  const ccMap = new Map();
  allCC.forEach(cc => {
    if(cc.creators && cc.creators.username) {
      const key = `${cc.campaign_id}_${cc.creators.username.toLowerCase()}`;
      ccMap.set(key, cc.id);
    }
  });

  console.log("Fetching existing videos to prevent duplicates...");
  let existingVideos = [];
  from = 0;
  hasMore = true;
  while(hasMore) {
    const {data, error} = await supabase.from('videos').select('campaign_creator_id, content_uid, urutan').range(from, from+999);
    if(error) { console.error(error); return; }
    if(data && data.length > 0) {
      existingVideos = [...existingVideos, ...data];
      if(data.length < 1000) hasMore = false;
      else from += 1000;
    } else hasMore = false;
  }
  
  const existingSet = new Set();
  const maxUrutanMap = new Map();
  existingVideos.forEach(v => {
    if(v.content_uid) existingSet.add(`${v.campaign_creator_id}_${v.content_uid}`);
    const currentMax = maxUrutanMap.get(v.campaign_creator_id) || 0;
    if(v.urutan > currentMax) maxUrutanMap.set(v.campaign_creator_id, v.urutan);
  });
  
  const toInsert = [];
  
  for(const v of allVideos) {
    const ccId = ccMap.get(`${v.campaign_id}_${v.creator_username.toLowerCase()}`);
    if(ccId) {
      const key = `${ccId}_${v.content_uid}`;
      if(!existingSet.has(key)) {
        let urutan = (maxUrutanMap.get(ccId) || 0) + 1;
        maxUrutanMap.set(ccId, urutan);
        
        toInsert.push({
          campaign_creator_id: ccId,
          urutan: urutan,
          concept: 'Imported Daily Performance',
          link_video: `https://www.tiktok.com/@${v.creator_username}/video/${v.content_uid}`,
          content_uid: v.content_uid,
          vt_approval: 'approved' // Automatically approved since it has views
        });
        existingSet.add(key); // prevent dup within loop
      }
    }
  }
  
  console.log(`Ready to insert ${toInsert.length} missing videos...`);
  
  // Insert in chunks
  const chunkSize = 500;
  for(let i=0; i<toInsert.length; i+=chunkSize) {
    const chunk = toInsert.slice(i, i+chunkSize);
    const {error} = await supabase.from('videos').insert(chunk);
    if(error) {
      console.error(`Error inserting chunk ${i}:`, error.message);
    } else {
      console.log(`Inserted chunk ${i} to ${i+chunk.length}`);
    }
  }
  
  console.log("Done!");
}

run();
