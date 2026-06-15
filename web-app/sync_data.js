require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Map of sheets to Campaigns and Brands
const sheetMapping = {
  "OMG MAKEUP": { campaign: "OMG Makeup", brand: "OMG" },
  "OMG SKINCARE": { campaign: "OMG Skincare", brand: "OMG" },
  "SALSA COSME": { campaign: "SALSA Cosmetic", brand: "SALSA" },
  "SALSA BABY CARE": { campaign: "SALSA Mom & Baby", brand: "SALSA" },
  "WARDAH": { campaign: "WARDAH", brand: "WARDAH" },
  "PWS": { campaign: "PWS", brand: "PWS" },
  "NAISDAY": { campaign: "NAISDAY", brand: "NAISDAY" },
  "DIOLY": { campaign: "DIOLY", brand: "DIOLY" },
  "MSGLOWBEAUTY": { campaign: "MS Glow Beauty", brand: "MS Glow Beauty" },
  "MSGLOWFORMEN": { campaign: "MS Glow For Men", brand: "MS Glow For Men" },
  "SKINMOLOGY": { campaign: "SKINMOLOGY", brand: "SKINMOLOGY" },
  "KIMME": { campaign: "KIMME", brand: "KIMME" },
  "QAHIRA": { campaign: "QAHIRA", brand: "QAHIRA" },
  "SYB": { campaign: "SYB", brand: "SYB" },
  "ISWHITE": { campaign: "ISWHITE", brand: "ISWHITE" }
};

async function getOrCreateBrand(brandName) {
  let { data: brand } = await supabase.from('brands').select('*').eq('nama', brandName).maybeSingle();
  if (!brand) {
    const { data: newBrand, error } = await supabase.from('brands').insert({ nama: brandName }).select().single();
    if (error) throw new Error("Error creating brand: " + JSON.stringify(error));
    brand = newBrand;
  }
  return brand.id;
}

async function getOrCreateCampaign(campaignName, brandId) {
  let { data: campaign } = await supabase.from('campaigns').select('*').eq('nama', campaignName).maybeSingle();
  if (!campaign) {
    const { data: newCampaign, error } = await supabase.from('campaigns').insert({
      nama: campaignName,
      brand_id: brandId,
      tipe_campaign: 'awareness', // Default
      status: 'aktif',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      budget_creator_plafon: 0,
      budget_ads_plafon: 0,
      require_client_approval: false
    }).select().single();
    if (error) throw new Error("Error creating campaign: " + JSON.stringify(error));
    campaign = newCampaign;
  }
  return campaign.id;
}

function parseGMV(gmvStr) {
  if (!gmvStr) return null;
  const str = String(gmvStr).toLowerCase().replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  
  let result = num;
  if (String(gmvStr).toLowerCase().includes('jt')) {
    result = num * 1000000;
  } else if (String(gmvStr).toLowerCase().includes('k')) {
    result = num * 1000;
  } else if (String(gmvStr).toLowerCase().includes('m')) {
    result = num * 1000000000;
  }
  return Math.round(result);
}

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const str = String(priceStr).toLowerCase().replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  
  let result = num;
  if (String(priceStr).toLowerCase().includes('jt')) result = num * 1000000;
  else if (String(priceStr).toLowerCase().includes('k')) result = num * 1000;
  return Math.round(result);
}

function parseApproval(app) {
  if (!app) return 'pending';
  const str = String(app).toLowerCase();
  if (str.includes('approve')) return 'approved';
  if (str.includes('reject') || str.includes('not approved')) return 'not_approved';
  if (str.includes('alternate')) return 'alternate';
  return 'pending';
}

async function processSheet(sheetName) {
  console.log(`\n=== Processing Sheet: ${sheetName} ===`);
  const mapping = sheetMapping[sheetName];
  if (!mapping) {
    console.log(`No mapping found for ${sheetName}, skipping.`);
    return;
  }

  const workbook = XLSX.readFile('../Database_Listing TNT.xlsx');
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.log(`Sheet ${sheetName} not found.`);
    return;
  }

  const brandId = await getOrCreateBrand(mapping.brand);
  const campaignId = await getOrCreateCampaign(mapping.campaign, brandId);
  console.log(`Campaign ID: ${campaignId}, Brand ID: ${brandId}`);

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return;

  const headers = rows[1] || rows[0]; // Sometimes header is on 2nd row
  const dataStartIndex = headers === rows[1] ? 2 : 1;

  const colIdx = {};
  headers.forEach((h, i) => {
    if (h) colIdx[String(h).trim().toLowerCase()] = i;
  });

  console.log(`Processing ${rows.length - dataStartIndex} rows...`);

  let count = 0;
  for (let i = dataStartIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    let username = row[colIdx['username']];
    if (!username) continue;
    username = String(username).trim().toLowerCase().replace(/^@+/, '');

    const linkAccount = row[colIdx['link account']];
    let phone = row[colIdx['no. whatsapp']];
    if (phone) {
      phone = String(phone).replace(/[^0-9]/g, '');
      if (phone.startsWith('0')) phone = '62' + phone.substring(1);
      else if (phone.startsWith('8')) phone = '628' + phone.substring(1);
    }

    const priceRaw = row[colIdx['price']];
    const priceNum = parsePrice(priceRaw);
    const qtyVideo = parseInt(row[colIdx['qty video']]) || 0;
    
    // Some sheets have Type or Video/Livestream
    let sowType = null;
    if (colIdx['type'] !== undefined) sowType = row[colIdx['type']];

    const levelRaw = row[colIdx['level']];
    let levelNum = null;
    if (levelRaw) {
      const match = String(levelRaw).match(/\d+/);
      if (match) levelNum = parseInt(match[0]);
    }

    const followers = row[colIdx['followers']]; // Audience Age
    const gmvRaw = row[colIdx['gmv']];
    const gmvNum = parseGMV(gmvRaw);
    const tier = row[colIdx['tier']];

    const approvalStr = row[colIdx['approval']] || row[colIdx['approve']];
    const approval = parseApproval(approvalStr);

    const pic = row[colIdx['pic/ assist']];
    const notesManager = row[colIdx['notes manager']];
    const notesPic = row[colIdx['notes pic']] || row[colIdx['notes']];
    const sampleProgress = row[colIdx['sample progress']];

    try {
      // 1. Get or Create Creator
      let { data: creator } = await supabase.from('creators').select('id').eq('username', username).maybeSingle();
      if (!creator) {
        const { data: newCr, error: errCr } = await supabase.from('creators').insert({
          username, link_account: linkAccount || null
        }).select('id').single();
        if (errCr) throw errCr;
        creator = newCr;
      }

      // 2. Insert Contact if present
      if (phone) {
        const { data: extPhone } = await supabase.from('creator_contacts').select('id').eq('creator_id', creator.id).eq('nomor', phone).maybeSingle();
        if (!extPhone) {
          await supabase.from('creator_contacts').insert({
            creator_id: creator.id, nomor: phone, status: 'aktif', tanggal_mulai: new Date().toISOString()
          });
        }
      }

      // 3. Creator Snapshot (Audience Age)
      const { data: extSnap } = await supabase.from('creator_snapshots').select('id').eq('creator_id', creator.id).order('tanggal_update', { ascending: false }).limit(1).maybeSingle();
      if (!extSnap) {
        await supabase.from('creator_snapshots').insert({
          creator_id: creator.id,
          tanggal_update: new Date().toISOString(),
          audience_age: followers ? String(followers) : null,
          level: levelNum,
          gmv_30d: gmvNum
        });
      }

      // 4. Campaign Creator
      const { data: extCc } = await supabase.from('campaign_creators').select('id').eq('campaign_id', campaignId).eq('creator_id', creator.id).maybeSingle();
      let ccId = null;
      if (!extCc) {
        const { data: newCc, error: errCc } = await supabase.from('campaign_creators').insert({
          campaign_id: campaignId,
          creator_id: creator.id,
          tier: tier ? String(tier) : null,
          price: priceNum,
          qty_vt: qtyVideo,
          content_type: sowType ? String(sowType) : null,
          approval: approval,
          status_bayar: 'belum',
          pic_assist: pic ? String(pic) : null,
          notes_manager: notesManager ? String(notesManager) : null,
          notes_pic: notesPic ? String(notesPic) : null
        }).select('id').single();
        if (errCc) throw errCc;
        ccId = newCc.id;
      } else {
        ccId = extCc.id;
      }

      // 5. Sample Progress
      if (sampleProgress && ccId) {
        const { data: extAddr } = await supabase.from('creator_addresses').select('id').eq('campaign_creator_id', ccId).maybeSingle();
        if (!extAddr) {
          await supabase.from('creator_addresses').insert({
            campaign_creator_id: ccId,
            proses: String(sampleProgress)
          });
        }
      }

      count++;
    } catch (e) {
      console.error(`Error processing row for user ${username}:`, e.message);
    }
  }

  console.log(`Successfully processed ${count} valid rows for ${sheetName}.`);
}

async function processAll() {
  for (const sheetName of Object.keys(sheetMapping)) {
    await processSheet(sheetName);
  }
}

const arg = process.argv[2];
if (arg === "ALL") {
  processAll().then(() => {
    console.log("ALL SHEETS PROCESSED SUCCESSFULLY!");
    process.exit(0);
  });
} else if (arg) {
  processSheet(arg).then(() => process.exit(0));
} else {
  console.log("Please provide a sheet name or ALL.");
  process.exit(1);
}
