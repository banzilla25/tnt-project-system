require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const cName = 'OMG Skincare';
  const { data: campaign } = await supabase.from('campaigns').select('id').eq('nama', cName).single();
  
  // 1. Reset all
  await supabase.from('campaign_creators').update({ gmv_organic_legacy: 0, gmv_ads_legacy: 0 }).eq('campaign_id', campaign.id);

  // 2. Read correctly
  const workbook = xlsx.readFile('../TNT Project Tracking (Internal).xlsx');
  const sheet = workbook.Sheets['OMG SKINCARE'];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Find header row explicitly
  let headerRow = -1;
  for(let i=0; i<30; i++) {
    if(data[i] && data[i].some(c => typeof c === 'string' && c.includes('Sales By Ads'))) {
      headerRow = i; break;
    }
  }

  if (headerRow === -1) {
    console.log("Could not find headers!");
    return;
  }

  // Find indices based on headers
  let orgVideoIdx = -1, orgLiveIdx = -1, adsVideoIdx = -1, adsLiveIdx = -1, usernameIdx = -1;
  for(let c=0; c<data[headerRow].length; c++) {
    let val = data[headerRow][c];
    if(typeof val === 'string') {
      let v = val.toLowerCase();
      if(v.includes('username')) usernameIdx = c;
    }
    // We also check the row above for merged headers
    let valAbove = data[headerRow-1] ? data[headerRow-1][c] : null;
    let category = (typeof valAbove === 'string') ? valAbove.toLowerCase() : '';
    
    if(typeof val === 'string') {
      let v = val.toLowerCase();
      if (category.includes('organic') && v.includes('video')) orgVideoIdx = c;
      if (category.includes('organic') && v.includes('livestream')) orgLiveIdx = c;
      if (category.includes('ads') && v.includes('video')) adsVideoIdx = c;
      if (category.includes('ads') && v.includes('livestream')) adsLiveIdx = c;
    }
  }

  console.log(`Indices -> User: ${usernameIdx}, OrgVid: ${orgVideoIdx}, OrgLive: ${orgLiveIdx}, AdsVid: ${adsVideoIdx}, AdsLive: ${adsLiveIdx}`);

  for(let i=headerRow+1; i<data.length; i++) {
    let row = data[i];
    if(!row || !row[usernameIdx]) continue;
    let username = String(row[usernameIdx]).trim().replace('@', '');
    if(username.length < 2) continue;

    let orgV = parseFloat(row[orgVideoIdx]) || 0;
    let orgL = parseFloat(row[orgLiveIdx]) || 0;
    let adsV = parseFloat(row[adsVideoIdx]) || 0;
    let adsL = parseFloat(row[adsLiveIdx]) || 0;

    let orgTotal = orgV + orgL;
    let adsTotal = adsV + adsL;

    if(orgTotal > 0 || adsTotal > 0) {
      console.log(`Updating ${username} -> Org: ${orgTotal}, Ads: ${adsTotal}`);
      const { data: creator } = await supabase.from('creators').select('id').eq('username', username).single();
      if(creator) {
        await supabase.from('campaign_creators').update({
          gmv_organic_legacy: orgTotal,
          gmv_ads_legacy: adsTotal
        }).eq('campaign_id', campaign.id).eq('creator_id', creator.id);
      }
    }
  }
}
run().catch(console.error);
