require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const campaign_id = 15;
  
  const workbook = xlsx.readFile('../TNT Project Tracking (Internal).xlsx');
  const sheet = workbook.Sheets['OMG SKINCARE'];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  let headerRow = 15;

  let userCol = 1; // 'Username Creator'
  let orgVidCol = 17, orgLiveCol = 18, adsVidCol = 19, adsLiveCol = 20;

  let updates = [];

  for(let i=headerRow+1; i<data.length; i++) {
    let row = data[i];
    if(!row || !row[userCol]) continue;
    let username = String(row[userCol]).trim().replace('@', '');
    if(username.length < 2) continue;

    let phoneCol = 3;
    let phoneNumber = String(row[phoneCol]);

    let orgV = row[orgVidCol];
    let orgL = row[orgLiveCol];
    let adsV = row[adsVidCol];
    let adsL = row[adsLiveCol];
    
    orgV = (typeof orgV === 'number') ? orgV : (parseFloat(String(orgV).replace(/[^0-9.-]+/g,"")) || 0);
    orgL = (typeof orgL === 'number') ? orgL : (parseFloat(String(orgL).replace(/[^0-9.-]+/g,"")) || 0);
    adsV = (typeof adsV === 'number') ? adsV : (parseFloat(String(adsV).replace(/[^0-9.-]+/g,"")) || 0);
    adsL = (typeof adsL === 'number') ? adsL : (parseFloat(String(adsL).replace(/[^0-9.-]+/g,"")) || 0);

    // Filter out phone numbers
    let phoneDigits = phoneNumber.replace(/\D/g, '');
    if (orgV > 1000000000 && String(orgV).includes(phoneDigits)) orgV = 0;
    if (adsV > 1000000000 && String(adsV).includes(phoneDigits)) adsV = 0;
    
    // Safety limit (10 Billion max per row)
    if (orgV > 10000000000) orgV = 0;
    if (adsV > 10000000000) adsV = 0;

    let orgTotal = Math.round(orgV + orgL);
    let adsTotal = Math.round(adsV + adsL);

    updates.push({ username, orgTotal, adsTotal });
  }

  for(let u of updates) {
    const { data: creator } = await supabase.from('creators').select('id').eq('username', u.username).single();
    if(creator) {
      const { data: existing } = await supabase.from('campaign_creators').select('id').eq('campaign_id', campaign_id).eq('creator_id', creator.id).single();
      if (existing) {
        await supabase.from('campaign_creators').update({
          gmv_organic_legacy: u.orgTotal,
          gmv_ads_legacy: u.adsTotal
        }).eq('id', existing.id);
      } else {
        await supabase.from('campaign_creators').insert({
          campaign_id: campaign_id,
          creator_id: creator.id,
          gmv_organic_legacy: u.orgTotal,
          gmv_ads_legacy: u.adsTotal,
          approval: 'approved',
          price: 0,
          qty_vt: 1,
          status_bayar: 'belum'
        });
      }
      console.log(`Upserted ${u.username}: Org=${u.orgTotal}, Ads=${u.adsTotal}`);
    }
  }

  // Double check the sum
  const { data: ccs } = await supabase.from('campaign_creators').select('gmv_organic_legacy, gmv_ads_legacy').eq('campaign_id', campaign_id);
  let total = 0;
  ccs.forEach(c => total += (c.gmv_organic_legacy || 0) + (c.gmv_ads_legacy || 0));
  console.log(`Final Total GMV for Campaign 15: ${total}`);

  console.log("Done");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
