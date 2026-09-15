require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Reading excel...");
  const workbook = xlsx.readFile('D:/Project-Tracking-System/Database_Listing TNT.xlsx');
  const worksheet = workbook.Sheets['QAHIRA'];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  let headerRowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].includes('Username')) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = data[headerRowIndex];
  const rows = data.slice(headerRowIndex + 1);

  const parsedData = rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      if (h) {
        obj[h.trim()] = row[i];
      }
    });
    return obj;
  }).filter(r => r.Username);

  console.log(`Found ${parsedData.length} creators to insert.`);

  for (const row of parsedData) {
    const username = row['Username'] ? row['Username'].toString().trim().replace(/^@/, '') : null;
    if (!username) continue;

    console.log(`Processing @${username}...`);

    // 1. Insert or get creator
    let creatorId;
    const { data: existingCreator, error: selErr } = await supabase
      .from('creators')
      .select('id')
      .eq('username', username)
      .single();

    if (existingCreator) {
      creatorId = existingCreator.id;
    } else {
      const { data: newCreator, error: insErr } = await supabase
        .from('creators')
        .insert({
          username,
          link_account: row['Link Account'] || null
        })
        .select()
        .single();
      
      if (insErr) {
        console.error(`Error inserting creator ${username}:`, insErr);
        continue;
      }
      creatorId = newCreator.id;
    }

    // 2. Insert creator_contacts if No Whatsapp exists
    const wa = row['No. Whatsapp'];
    if (wa) {
      const { data: existingContact } = await supabase
        .from('creator_contacts')
        .select('id')
        .eq('creator_id', creatorId)
        .eq('nomor', wa.toString())
        .single();
      
      if (!existingContact) {
        await supabase.from('creator_contacts').insert({
          creator_id: creatorId,
          nomor: wa.toString(),
          status: 'aktif',
          tanggal_mulai: new Date().toISOString().split('T')[0]
        });
      }
    }

    // 3. Insert creator_snapshots
    let followersStr = row['Followers'] || '';
    let followersInt = 0;
    if (typeof followersStr === 'number') followersInt = followersStr;
    else if (typeof followersStr === 'string') {
      const match = followersStr.match(/\d+/);
      if (match) followersInt = parseInt(match[0], 10);
    }

    let levelStr = row['Level'] || '';
    let levelInt = null;
    if (typeof levelStr === 'number') levelInt = levelStr;
    else if (typeof levelStr === 'string') {
      const match = levelStr.match(/\d+/);
      if (match) levelInt = parseInt(match[0], 10);
    }

    await supabase.from('creator_snapshots').insert({
      creator_id: creatorId,
      tanggal_update: new Date().toISOString().split('T')[0],
      followers: followersInt,
      level: levelInt,
      gmv_30d: 0
    });

    // 4. Insert into campaign_creators
    let price = 0;
    const priceRaw = row['Price'];
    if (typeof priceRaw === 'number') price = priceRaw;
    else if (typeof priceRaw === 'string') {
      const digits = priceRaw.replace(/\D/g, '');
      if (digits) price = parseInt(digits, 10);
    }

    let qtyVt = parseInt(row['Qty Video'], 10) || 1;

    // Check if already in campaign
    const { data: existingCc } = await supabase
      .from('campaign_creators')
      .select('id')
      .eq('campaign_id', 17)
      .eq('creator_id', creatorId)
      .single();

    if (!existingCc) {
      const { error: ccErr } = await supabase.from('campaign_creators').insert({
        campaign_id: 17,
        creator_id: creatorId,
        tier: row['Tier'] || 'NANO',
        price: price,
        qty_vt: qtyVt,
        approval: 'approved', // Force approved as requested
        client_approval: 'not_required',
        pic_assist: row['PIC/ Assist'] || null,
        notes_manager: row['Notes Manager'] || null,
        notes_pic: row['Notes PIC'] || null,
        sample_progress: row['Sample Progress'] || null
      });

      if (ccErr) console.error(`Error inserting campaign_creator for ${username}:`, ccErr);
    }
  }

  console.log("Done!");
}

run().catch(console.error);
