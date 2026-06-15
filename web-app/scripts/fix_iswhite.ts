import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const dataPath = path.join(process.cwd(), '../');
const fileListing = path.join(dataPath, 'Database_Listing TNT.xlsx');

function normalizeStr(str: string) {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fixIswhite() {
  console.log("Fixing ISWHITE...");
  
  const listingWb = XLSX.readFile(fileListing);
  const sheet = listingWb.Sheets['ISWHITE'];
  if (!sheet) {
    console.log("ISWHITE sheet not found");
    return;
  }
  
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
  
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const rowStr = row.map((c:any) => String(c).toLowerCase()).join(' ');
    if (rowStr.includes('username')) {
      headerIdx = i;
      break;
    }
  }
  
  if (headerIdx === -1) {
    console.log("Header not found");
    return;
  }
  
  const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
  const userIdx = headers.findIndex((h:any) => h?.includes('username'));
  const brandApprovalIdx = headers.findIndex((h:any) => h?.includes('approved by brand') || h?.includes('brand approval'));
  
  // If we can't find 'approved by brand' in header, we'll assume it's column AC which is index 28. (A=0, Z=25, AA=26, AB=27, AC=28)
  const finalBrandApprvIdx = brandApprovalIdx !== -1 ? brandApprovalIdx : 28;
  
  console.log(`UserIdx: ${userIdx}, BrandApprovalIdx: ${finalBrandApprvIdx}`);

  // Fetch campaign for ISWHITE
  const { data: camps } = await supabase.from('campaigns').select('id, nama').ilike('nama', '%iswhite%');
  if (!camps || camps.length === 0) {
    console.log("ISWHITE campaign not found in DB");
    return;
  }
  const iswhiteCampaignId = camps[0].id;
  console.log(`Found ISWHITE Campaign ID: ${iswhiteCampaignId}`);
  
  // Make sure require_client_approval is true
  await supabase.from('campaigns').update({ require_client_approval: true }).eq('id', iswhiteCampaignId);

  let updatedCount = 0;
  let newCreatorsCount = 0;

  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[userIdx]) continue;
    
    const rawUser = String(row[userIdx]).trim();
    const normUser = normalizeStr(rawUser);
    if (!normUser || normUser === 'username' || normUser.length < 3) continue;

    // We check column AC (index 28) for 'approved'
    const brandStatus = String(row[finalBrandApprvIdx] || '').toLowerCase().trim();
    if (brandStatus !== 'approved' && brandStatus !== 'yes' && brandStatus !== 'ya' && brandStatus !== 'done' && brandStatus !== '1') continue;

    const username = rawUser.replace('@', '');

    // Get creator
    let { data: cData } = await supabase.from('creators').select('id').eq('username', username).single();
    let creatorId = cData?.id;
    
    if (!creatorId) {
      const { data: insertedCreator } = await supabase.from('creators').insert({
        username,
        nama_asli: username
      }).select('id').single();
      creatorId = insertedCreator?.id;
      if (!creatorId) continue;
    }

    // Check if campaign_creator exists
    const { data: existingCc } = await supabase.from('campaign_creators').select('id').eq('campaign_id', iswhiteCampaignId).eq('creator_id', creatorId).single();

    if (existingCc) {
      // Update existing to have client_approval = 'approved' and approval = 'approved'
      await supabase.from('campaign_creators').update({
        approval: 'approved',
        client_approval: 'approved'
      }).eq('id', existingCc.id);
      updatedCount++;
    } else {
      // Find price, qty from row if possible
      const priceIdx = headers.findIndex((h:any) => h?.includes('price') || h?.includes('rate'));
      const qtyIdx = headers.findIndex((h:any) => h?.includes('qty'));
      const gmvIdx = headers.findIndex((h:any) => h?.includes('gmv'));
      
      const price = priceIdx !== -1 && row[priceIdx] ? parseInt(String(row[priceIdx]).replace(/\D/g, '')) : 0;
      const qty = qtyIdx !== -1 && row[qtyIdx] ? parseInt(String(row[qtyIdx]).replace(/\D/g, '')) : 1;
      const gmv = gmvIdx !== -1 && row[gmvIdx] ? parseInt(String(row[gmvIdx]).replace(/\D/g, '')) : 0;
      
      await supabase.from('campaign_creators').insert({
        campaign_id: iswhiteCampaignId,
        creator_id: creatorId,
        tier: 'Standard',
        price: isNaN(price) ? 0 : price,
        qty_vt: isNaN(qty) ? 1 : qty,
        approval: 'approved',
        client_approval: 'approved',
        gmv_organic_legacy: isNaN(gmv) ? 0 : gmv,
        status_bayar: 'belum'
      });
      newCreatorsCount++;
    }
  }

  console.log(`Done. Updated ${updatedCount} existing. Inserted ${newCreatorsCount} missing.`);
}

fixIswhite().catch(console.error);
