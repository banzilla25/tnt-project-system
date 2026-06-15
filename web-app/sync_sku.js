const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function mapCampaign(excelName) {
  const n = String(excelName).toLowerCase().trim();
  if (n === 'salsa cosmetics' || n === 'salsa cosmetik' || n === 'salsa cosme') return 'SALSA Cosmetic';
  if (n === 'salsa m&b' || n === 'salsa baby care' || n === 'salsa mom & baby') return 'SALSA Mom & Baby';
  if (n === 'omg makeup') return 'OMG Makeup';
  if (n === 'omg skincare') return 'OMG Skincare';
  if (n === 'wardah') return 'WARDAH';
  if (n === 'qahira') return 'QAHIRA';
  if (n === 'naisday') return 'NAISDAY';
  if (n === 'iswhite') return 'ISWHITE';
  if (n === 'pws') return 'PWS';
  if (n === 'dioly') return 'DIOLY';
  if (n === 'msglowbeauty' || n === 'ms glow beauty') return 'MS Glow Beauty';
  if (n === 'msglowformen' || n === 'ms glow for men') return 'MS Glow For Men';
  if (n === 'skinmology') return 'SKINMOLOGY';
  if (n === 'kimme') return 'KIMME';
  if (n === 'syb') return 'SYB';
  return String(excelName).trim().toUpperCase();
}

async function run() {
  console.log("Reading Excel file...");
  const workbook = XLSX.readFile('../TNT Project Tracking (Internal).xlsx');
  const sheet = workbook.Sheets['SKU'];
  if (!sheet) {
    console.error("Sheet SKU not found.");
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) {
    console.error("No data in SKU sheet");
    return;
  }

  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  
  const colIdx = {
    campaign: headers.indexOf('campaign'),
    link_gmv_max: headers.indexOf('link gmv max/ vsa'),
    nama_produk: headers.indexOf('nama produk'),
    product_id: headers.indexOf('product id'),
    satuan_bundle: headers.indexOf('satuan/ bundle'),
    link_tap: headers.indexOf('link tap'),
    commission: headers.indexOf('commision')
  };

  const { data: dbCampaigns, error: errCamps } = await supabase.from('campaigns').select('id, nama');
  if (errCamps) {
    console.error("Failed to fetch campaigns", errCamps);
    return;
  }
  const campaignMap = new Map();
  dbCampaigns.forEach(c => {
    campaignMap.set(c.nama, c.id);
  });
  console.log("DB Campaigns available:", Array.from(campaignMap.keys()));

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  console.log("Processing SKUs...");

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[colIdx.campaign] || !row[colIdx.product_id]) continue;

    const excelCampaignName = row[colIdx.campaign];
    const mappedCampaignName = mapCampaign(excelCampaignName);
    const campaignId = campaignMap.get(mappedCampaignName);

    if (!campaignId) {
      console.log(`Skipped: '${excelCampaignName}' mapped to '${mappedCampaignName}'`);
      skipCount++;
      continue;
    }

    const productIdStr = String(row[colIdx.product_id]).trim();
    let comm = row[colIdx.commission];
    if (comm !== null && comm !== undefined) {
      if (typeof comm === 'string') {
        comm = parseFloat(comm.replace(/[^0-9.]/g, ''));
        if (comm > 1) { 
            comm = comm / 100.0;
        }
      }
    } else {
      comm = null;
    }

    const newSku = {
      campaign_id: campaignId,
      nama_produk: String(row[colIdx.nama_produk] || '').trim(),
      product_id: productIdStr,
      link_gmv_max: row[colIdx.link_gmv_max] ? String(row[colIdx.link_gmv_max]).trim() : null,
      satuan_bundle: row[colIdx.satuan_bundle] ? String(row[colIdx.satuan_bundle]).trim() : null,
      link_tap: row[colIdx.link_tap] ? String(row[colIdx.link_tap]).trim() : null,
      commission: comm
    };

    const { data: existingSku, error: errExist } = await supabase
      .from('skus')
      .select('id')
      .eq('product_id', productIdStr)
      .maybeSingle();

    if (errExist) {
      console.error(`Error checking sku ${productIdStr}:`, errExist.message);
      failCount++;
      continue;
    }

    if (existingSku) {
      const { error: errUpdate } = await supabase
        .from('skus')
        .update(newSku)
        .eq('id', existingSku.id);
      
      if (errUpdate) {
        console.error(`Error updating SKU ${productIdStr}:`, errUpdate.message);
        failCount++;
      } else {
        successCount++;
      }
    } else {
      const { error: errInsert } = await supabase
        .from('skus')
        .insert(newSku);
      
      if (errInsert) {
        console.error(`Error inserting SKU ${productIdStr}:`, errInsert.message);
        failCount++;
      } else {
        successCount++;
      }
    }
  }

  console.log(`\n=== SKU IMPORT COMPLETE ===`);
  console.log(`Successfully Processed/Upserted: ${successCount}`);
  console.log(`Skipped (Campaign Not Found): ${skipCount}`);
  console.log(`Failed (DB Errors): ${failCount}`);
}

run().catch(console.error);
