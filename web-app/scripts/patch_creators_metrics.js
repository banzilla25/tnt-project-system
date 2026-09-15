require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sheetMapping = {
  "OMG MAKEUP": "OMG Makeup",
  "OMG SKINCARE": "OMG Skincare",
  "SALSA COSME": "SALSA Cosmetic",
  "SALSA BABY CARE": "SALSA Mom & Baby",
  "WARDAH": "WARDAH",
  "PWS": "PWS",
  "NAISDAY": "NAISDAY",
  "DIOLY": "DIOLY",
  "MSGLOWBEAUTY": "MS Glow Beauty",
  "MSGLOWFORMEN": "MS Glow For Men",
  "SKINMOLOGY": "SKINMOLOGY",
  "KIMME": "KIMME",
  "QAHIRA": "QAHIRA",
  "SYB": "SYB",
  "ISWHITE": "ISWHITE"
};

function parsePrice(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const digits = String(val).replace(/\D/g, '');
  if (digits) return parseInt(digits, 10);
  return 0;
}

function parseGMV(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // some might have rp, dot, comma
  const digits = String(val).replace(/\D/g, '');
  if (digits) return parseInt(digits, 10);
  return 0;
}

function parseAudienceAge(val) {
  if (!val) return null;
  return String(val).trim();
}

async function run() {
  console.log("Loading Excel...");
  const workbook = XLSX.readFile('../Database_Listing TNT.xlsx');

  for (const [sheetName, campaignName] of Object.entries(sheetMapping)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    console.log(`\nProcessing ${sheetName}...`);
    const { data: campaign } = await supabase.from('campaigns').select('id').eq('nama', campaignName).single();
    if (!campaign) continue;

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) continue;

    const headers = rows[1] || rows[0];
    const dataStartIndex = headers === rows[1] ? 2 : 1;

    let usernameColIdx = -1;
    let priceColIdx = -1;
    let followersColIdx = -1; // Audiens Age
    let gmvColIdx = -1;
    let typeColIdx = -1; // Content Type

    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      const h = String(headers[i]).trim().toLowerCase();
      if (h === 'username') usernameColIdx = i;
      if (h === 'price') priceColIdx = i;
      if (h === 'followers') followersColIdx = i; // This is Audiens Age
      if (h === 'gmv') gmvColIdx = i;
      if (h === 'type') typeColIdx = i; // Content Type
    }

    if (usernameColIdx === -1) continue;

    let updates = [];
    for (let i = dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      let username = row[usernameColIdx];
      if (!username) continue;
      username = String(username).trim().toLowerCase().replace(/^@+/, '');

      updates.push({
        username,
        price: parsePrice(row[priceColIdx]),
        audience_age: parseAudienceAge(row[followersColIdx]),
        gmv_30d: parseGMV(row[gmvColIdx]),
        content_type: row[typeColIdx] ? String(row[typeColIdx]).trim() : null
      });
    }

    console.log(`Found ${updates.length} creators to update metrics.`);

    // Batch process
    for (const u of updates) {
      const { data: creator } = await supabase.from('creators').select('id').eq('username', u.username).maybeSingle();
      if (creator) {
        // update campaign_creators: price & content_type
        await supabase.from('campaign_creators')
          .update({ price: u.price, content_type: u.content_type })
          .eq('campaign_id', campaign.id)
          .eq('creator_id', creator.id);
        
        // update creator_snapshots
        const { data: snaps } = await supabase.from('creator_snapshots')
          .select('id')
          .eq('creator_id', creator.id)
          .order('tanggal_update', { ascending: false })
          .limit(1);

        if (snaps && snaps.length > 0) {
           await supabase.from('creator_snapshots')
             .update({ gmv_30d: u.gmv_30d, audience_age: u.audience_age })
             .eq('id', snaps[0].id);
        } else {
           await supabase.from('creator_snapshots')
             .insert({ 
               creator_id: creator.id, 
               tanggal_update: new Date().toISOString().split('T')[0], 
               gmv_30d: u.gmv_30d, 
               audience_age: u.audience_age 
             });
        }
      }
    }
    console.log(`Updated metrics for ${sheetName}`);
  }

  console.log("All Done!");
}

run().catch(console.error);
