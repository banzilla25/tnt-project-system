require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const campaignsToUpdate = [
    { name: 'OMG Skincare', sheet: 'OMG SKINCARE' }
  ];

  const workbook = xlsx.readFile('../TNT Project Tracking (Internal).xlsx');

  for (const c of campaignsToUpdate) {
    const sheet = workbook.Sheets[c.sheet];
    if (!sheet) continue;

    console.log(`Patching ${c.name}...`);
    
    // Fetch campaign
    const { data: campaign } = await supabase.from('campaigns').select('id').eq('nama', c.name).single();
    if (!campaign) continue;

    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    for (let i = 10; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[1] || typeof row[1] !== 'string') continue;
      if (row[0] === 'Tier') continue; // skip header
      
      const username = row[1].trim().replace('@', '');
      if (username.length < 2) continue;
      
      const { data: creator } = await supabase.from('creators').select('id').eq('username', username).single();
      if (!creator) continue;
      
      let organic_video = 0;
      let organic_live = 0;
      let ads_video = 0;
      let ads_live = 0;
      
      let numbers = [];
      for(let j=row.length-1; j>=0; j--) {
        if(typeof row[j] === 'number') {
           numbers.push(row[j]);
        }
        if(numbers.length === 4) break;
      }
      if(numbers.length >= 4) {
        ads_live = numbers[0];
        ads_video = numbers[1];
        organic_live = numbers[2];
        organic_video = numbers[3];
      } else {
        organic_video = parseFloat(row[17]) || 0;
        organic_live = parseFloat(row[18]) || 0;
        ads_video = parseFloat(row[19]) || 0;
        ads_live = parseFloat(row[20]) || 0;
      }
      
      const organic_total = organic_video + organic_live;
      const ads_total = ads_video + ads_live;
      
      if (organic_total > 0 || ads_total > 0) {
        console.log(`Updating ${username} -> Org: ${organic_total}, Ads: ${ads_total}`);
        await supabase.from('campaign_creators')
          .update({
            gmv_organic_legacy: organic_total,
            gmv_ads_legacy: ads_total
          })
          .eq('campaign_id', campaign.id)
          .eq('creator_id', creator.id);
      }
    }
    console.log(`Finished ${c.name}`);
  }
}

run().catch(console.error);
