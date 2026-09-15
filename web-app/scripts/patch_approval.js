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

function parseApproval(app) {
  if (!app) return 'pending';
  const str = String(app).toLowerCase().trim();
  if (str === 'approved' || str === 'approve') return 'approved';
  if (str === 'not approved' || str === 'reject') return 'not_approved';
  if (str === 'alternate') return 'alternate';
  return 'pending';
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

    // FIND THE FIRST APPROVAL COLUMN
    let approvalColIdx = -1;
    let usernameColIdx = -1;

    for (let i = 0; i < headers.length; i++) {
      if (!headers[i]) continue;
      const h = String(headers[i]).trim().toLowerCase();
      if (h === 'username') usernameColIdx = i;
      if ((h === 'approval' || h === 'approve') && approvalColIdx === -1) {
        approvalColIdx = i;
      }
    }

    if (usernameColIdx === -1 || approvalColIdx === -1) {
      console.log(`Could not find Username or Approval column in ${sheetName}.`);
      continue;
    }

    let updates = [];
    for (let i = dataStartIndex; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      let username = row[usernameColIdx];
      if (!username) continue;
      username = String(username).trim().toLowerCase().replace(/^@+/, '');

      const rawApp = row[approvalColIdx];
      const parsedApp = parseApproval(rawApp);

      if (parsedApp !== 'pending') {
        updates.push({ username, approval: parsedApp });
      }
    }

    console.log(`Found ${updates.length} creators with explicit approval status to update.`);

    // Update in DB
    let count = 0;
    for (const u of updates) {
      const { data: creator } = await supabase.from('creators').select('id').eq('username', u.username).maybeSingle();
      if (creator) {
        // Only update if current is pending (or just override it safely)
        const { error } = await supabase.from('campaign_creators')
          .update({ approval: u.approval })
          .eq('campaign_id', campaign.id)
          .eq('creator_id', creator.id);
        
        if (!error) count++;
      }
    }
    console.log(`Updated ${count} creators in ${campaignName}.`);
  }

  console.log("\nAll Done!");
}

run().catch(console.error);
