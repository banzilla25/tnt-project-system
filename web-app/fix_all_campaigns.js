require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: campaigns } = await supabase.from('campaigns').select('id, nama');
  if (!campaigns) return;

  const workbook = xlsx.readFile('../TNT Project Tracking (Internal).xlsx');
  const sheetNames = workbook.SheetNames;

  for (const campaign of campaigns) {
    // Find matching sheet
    let targetSheet = null;
    for (const sName of sheetNames) {
      if (sName.toLowerCase().replace(/[^a-z0-9]/g, '') === campaign.nama.toLowerCase().replace(/[^a-z0-9]/g, '')) {
        targetSheet = sName;
        break;
      }
    }

    if (!targetSheet) {
      console.log(`[SKIP] Could not find sheet for campaign: ${campaign.nama}`);
      continue;
    }

    const sheet = workbook.Sheets[targetSheet];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    let headerRow = -1;
    let userCol = -1;

    // Find header row by looking for "Username" or "Username Creator"
    for (let i = 0; i < 30; i++) {
      if (!data[i]) continue;
      for (let c = 0; c < data[i].length; c++) {
        const val = String(data[i][c]).toLowerCase().replace(/\s+/g, '');
        if (val.includes('username')) {
          headerRow = i;
          userCol = c;
          break;
        }
      }
      if (headerRow !== -1) break;
    }

    if (headerRow === -1) {
      console.log(`[FAIL] Could not find header row for campaign: ${campaign.nama}`);
      continue;
    }

    let orgVidCol = -1, orgLiveCol = -1, adsVidCol = -1, adsLiveCol = -1;

    for (let c = 0; c < data[headerRow].length; c++) {
      let topVal = (data[headerRow - 1] && data[headerRow - 1][c]) ? String(data[headerRow - 1][c]).toLowerCase() : '';
      let val = String(data[headerRow][c]).toLowerCase();

      if (val.includes('organic sales')) topVal = 'organic sales';
      if (val.includes('sales by ads')) topVal = 'sales by ads';

      if (topVal.includes('organic')) {
        if (val.includes('video') || val.includes('organic sales')) orgVidCol = c;
        if (val.includes('livestream')) orgLiveCol = c;
      }
      if (topVal.includes('ads') || topVal.includes('sales by ads')) {
        if (val.includes('video') || val.includes('sales by ads')) adsVidCol = c;
        if (val.includes('livestream')) adsLiveCol = c;
      }
    }

    // Fallback if we couldn't parse the column precisely, let's try reading backwards
    // from the end of the header row if we find "Sales" headers
    if (orgVidCol === -1 && adsVidCol === -1) {
      // Look for the last 4 columns if they resemble the template
      // Usually they are 17, 18, 19, 20
      orgVidCol = 17; orgLiveCol = 18; adsVidCol = 19; adsLiveCol = 20;
    }

    console.log(`[PROCESS] ${campaign.nama} - Header Row: ${headerRow}, Cols: U=${userCol}, OV=${orgVidCol}, OL=${orgLiveCol}, AV=${adsVidCol}, AL=${adsLiveCol}`);

    let updates = [];

    for (let i = headerRow + 1; i < data.length; i++) {
      let row = data[i];
      if (!row || !row[userCol]) continue;
      let username = String(row[userCol]).trim().replace('@', '');
      if (username.length < 2 || username.toLowerCase() === 'username') continue;

      let phoneCol = 3;
      let phoneNumber = String(row[phoneCol]);

      let orgV = row[orgVidCol];
      let orgL = orgLiveCol !== -1 ? row[orgLiveCol] : 0;
      let adsV = adsVidCol !== -1 ? row[adsVidCol] : 0;
      let adsL = adsLiveCol !== -1 ? row[adsLiveCol] : 0;

      orgV = (typeof orgV === 'number') ? orgV : (parseFloat(String(orgV).replace(/[^0-9.-]+/g, "")) || 0);
      orgL = (typeof orgL === 'number') ? orgL : (parseFloat(String(orgL).replace(/[^0-9.-]+/g, "")) || 0);
      adsV = (typeof adsV === 'number') ? adsV : (parseFloat(String(adsV).replace(/[^0-9.-]+/g, "")) || 0);
      adsL = (typeof adsL === 'number') ? adsL : (parseFloat(String(adsL).replace(/[^0-9.-]+/g, "")) || 0);

      // Filter out phone numbers
      let phoneDigits = phoneNumber.replace(/\D/g, '');
      if (orgV > 1000000000 && String(orgV).includes(phoneDigits)) orgV = 0;
      if (adsV > 1000000000 && String(adsV).includes(phoneDigits)) adsV = 0;

      if (orgV > 10000000000) orgV = 0;
      if (adsV > 10000000000) adsV = 0;

      let orgTotal = Math.round(orgV + orgL);
      let adsTotal = Math.round(adsV + adsL);

      updates.push({ username, orgTotal, adsTotal });
    }

    // Process updates
    let updatedCount = 0;
    for (let u of updates) {
      const { data: creator } = await supabase.from('creators').select('id').eq('username', u.username).single();
      if (creator) {
        const { data: existing } = await supabase.from('campaign_creators').select('id').eq('campaign_id', campaign.id).eq('creator_id', creator.id).single();
        if (existing) {
          await supabase.from('campaign_creators').update({
            gmv_organic_legacy: u.orgTotal,
            gmv_ads_legacy: u.adsTotal
          }).eq('id', existing.id);
        } else {
          await supabase.from('campaign_creators').insert({
            campaign_id: campaign.id,
            creator_id: creator.id,
            gmv_organic_legacy: u.orgTotal,
            gmv_ads_legacy: u.adsTotal,
            approval: 'approved',
            price: 0,
            qty_vt: 1,
            status_bayar: 'belum'
          });
        }
        updatedCount++;
      }
    }
    console.log(`[DONE] ${campaign.nama} - Upserted ${updatedCount} creators`);
  }
  
  console.log("All campaigns processed!");
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
