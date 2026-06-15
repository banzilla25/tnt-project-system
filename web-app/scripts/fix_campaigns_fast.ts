import * as XLSX from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const dataPath = path.join(__dirname, '../../');
const fileListing = path.join(dataPath, 'Database_Listing TNT.xlsx');

function normalizeStr(str: string) {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeaderRow(data: any[], keywords: string[]) {
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;
    const rowStr = row.map((c:any) => String(c).toLowerCase()).join(' ');
    if (keywords.every(k => rowStr.includes(k.toLowerCase()))) return i;
  }
  return -1;
}

async function fixCampaignsFast() {
  console.log("🚀 Starting Fast Campaign Creator Link Fix...");

  // Load campaigns
  const { data: dbCamps } = await supabase.from('campaigns').select('id, nama');
  const campaignMap = new Map();
  if (dbCamps) dbCamps.forEach(c => campaignMap.set(normalizeStr(c.nama), c.id));

  // Load creators
  console.log("Fetching existing creators from DB...");
  const creatorMap = new Map();
  let page = 0;
  while(true) {
    const { data } = await supabase.from('creators').select('id, username').range(page*1000, (page+1)*1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(c => creatorMap.set(normalizeStr(c.username), c.id));
    page++;
  }

  // 3. Campaign Creators & Videos
  console.log("\n👥 Linking Creators to Campaigns (Fast Bulk Insert)...");
  const listingWb = XLSX.readFile(fileListing);
  const excludedSheets = ['TEMPLATE SALES', 'TEMPLATE AWARENESS', 'POOL DATABASE', 'LAGI TESTING', 'RAW_organic', 'TEST', 'Database Beauty'];
  
  const bulkCc = [];
  const bulkVid = [];

  for (const sheetName of listingWb.SheetNames.filter(s => !excludedSheets.includes(s))) {
    const sheet = listingWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const headerIdx = findHeaderRow(data, ['username', 'whatsapp']);
    if (headerIdx === -1) continue;
    
    const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const userIdx = headers.findIndex((h:any) => h?.includes('username'));
    const priceIdx = headers.findIndex((h:any) => h?.includes('price'));
    const qtyIdx = headers.findIndex((h:any) => h?.includes('qty'));
    const approvalIdx = headers.findIndex((h:any) => h?.includes('approval'));
    const gmvIdx = headers.findIndex((h:any) => h?.includes('gmv'));
    const tierIdx = headers.findIndex((h:any) => h?.includes('tier'));
    
    const videoCols: number[] = [];
    headers.forEach((h:any, idx:number) => { if (h && (h.includes('link video') || h === 'video' || h.includes('link vt'))) videoCols.push(idx); });

    const normBrand = normalizeStr(sheetName);
    let campId = Array.from(campaignMap.entries()).find(([nc]) => nc.includes(normBrand) || normBrand.includes(nc))?.[1];
    if (!campId && campaignMap.size > 0) campId = Array.from(campaignMap.values())[0];

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[userIdx] || !campId) continue;
      
      const cId = creatorMap.get(normalizeStr(row[userIdx]));
      if (!cId) continue;

      let apprv = String(row[approvalIdx] || 'pending').toLowerCase();
      if (!['pending','approved','alternate','not_approved'].includes(apprv)) apprv = 'pending';
      const price = row[priceIdx] ? parseInt(String(row[priceIdx]).replace(/\D/g, '')) : 0;
      const qty = row[qtyIdx] ? parseInt(String(row[qtyIdx]).replace(/\D/g, '')) : 1;

      bulkCc.push({
        campaign_id: campId, creator_id: cId,
        tier: row[tierIdx] ? String(row[tierIdx]).substring(0,50) : 'Standard',
        price: isNaN(price) ? 0 : price, qty_vt: isNaN(qty) ? 1 : qty,
        approval: apprv, gmv_organic_legacy: row[gmvIdx] ? parseInt(String(row[gmvIdx]).replace(/\D/g, '')) : 0,
        status_bayar: 'belum', pic_assist: 'Admin'
      });

      for (const vCol of videoCols) {
        if (row[vCol] && String(row[vCol]).length > 5) {
           bulkVid.push({
              _campId: campId, _creatorId: cId, // temp for mapping later
              link_video: String(row[vCol]).substring(0, 255),
              tanggal_post: new Date().toISOString().split('T')[0]
           });
        }
      }
    }
  }
  
  await supabase.from('campaign_creators').delete().neq('id', 0); // BIGINT
  await supabase.from('videos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log(`Prepared ${bulkCc.length} campaign_creators. Bulk inserting...`);
  for (let i = 0; i < bulkCc.length; i += 1000) {
     const b = bulkCc.slice(i, i+1000);
     const {error} = await supabase.from('campaign_creators').insert(b);
     if (error) console.error("CC Error:", error);
     else console.log(`Inserted CC batch ${i}-${i+b.length}`);
  }
  
  console.log("Fetching generated CC IDs...");
  const ccMap = new Map();
  let ccPage = 0;
  while(true) {
     const {data} = await supabase.from('campaign_creators').select('id, campaign_id, creator_id').range(ccPage*1000, (ccPage+1)*1000-1);
     if (!data || data.length === 0) break;
     data.forEach(cc => ccMap.set(`${cc.campaign_id}_${cc.creator_id}`, cc.id));
     ccPage++;
  }
  
  console.log(`Mapping ${bulkVid.length} videos...`);
  const finalVid = [];
  for (const v of bulkVid) {
      const ccId = ccMap.get(`${v._campId}_${v._creatorId}`);
      if (ccId) {
          finalVid.push({
              campaign_creator_id: ccId,
              link_video: v.link_video,
              tanggal_post: v.tanggal_post
          });
      }
  }

  for (let i = 0; i < finalVid.length; i += 1000) {
     const b = finalVid.slice(i, i+1000);
     const {error} = await supabase.from('videos').insert(b);
     if (error) console.error("Vid Error:", error);
     else console.log(`Inserted Vid batch ${i}-${i+b.length}`);
  }

  console.log("✅ Fast Campaign Fix Completed!");
}

fixCampaignsFast().catch(console.error);
