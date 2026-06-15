import * as XLSX from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const dataPath = path.join(__dirname, '../../');
const fileListing = path.join(dataPath, 'Database_Listing TNT.xlsx');
const fileTracking = path.join(dataPath, 'TNT Project Tracking (Internal).xlsx');

function normalizeStr(str: string) {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeaderRow(data: any[], keywords: string[]) {
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (!row || row.length < 3) continue; // Skip title rows that have less than 3 columns
    const rowStr = row.map((c:any) => String(c).toLowerCase()).join(' ');
    if (keywords.every(k => rowStr.includes(k.toLowerCase()))) {
      return i;
    }
  }
  return -1;
}

async function fixCampaigns() {
  console.log("🚀 Starting Campaign Fix...");

  // Delete all campaigns (cascades to skus, campaign_creators)
  console.log("Wiping existing campaigns...");
  await supabase.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Load brands
  const { data: dbBrands } = await supabase.from('brands').select('id, nama');
  const brandMap = new Map();
  if (dbBrands) dbBrands.forEach(b => brandMap.set(normalizeStr(b.nama), b.id));

  // 1. Insert Campaigns
  console.log("\n📊 Re-inserting Campaigns...");
  const trackingWb = XLSX.readFile(fileTracking);
  const maindataSheet = trackingWb.Sheets['Maindata'];
  const maindata = XLSX.utils.sheet_to_json<any[]>(maindataSheet, { header: 1 });
  const mdHeaderIdx = findHeaderRow(maindata, ['campaign', 'target']);
  
  const campaignMap = new Map(); // normalized -> id

  if (mdHeaderIdx !== -1) {
    const headers = maindata[mdHeaderIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const campIdx = headers.findIndex((h:any) => h.includes('campaign'));
    
    for (let i = mdHeaderIdx + 1; i < maindata.length; i++) {
      const row = maindata[i];
      if (!row || !row[campIdx]) continue;
      
      const campName = String(row[campIdx]).trim();
      const targetVal = row.length > 5 ? parseInt(String(row[8] || '0').replace(/\D/g, '')) : 0; // target is usually col 8
      const normCamp = normalizeStr(campName);
      let isAwareness = normCamp.includes('kimme') || normCamp.includes('dioly') || normCamp.includes('skinmology') || normCamp.includes('pws') || normCamp.includes('perfectwhite') || (targetVal < 1000000 && targetVal > 0);

      let bId = null;
      for (const [nb, id] of brandMap.entries()) {
        if (normCamp.includes(nb)) { bId = id; break; }
      }
      if (!bId && brandMap.size > 0) bId = Array.from(brandMap.values())[0];

      const { data } = await supabase.from('campaigns').insert({
        brand_id: bId,
        nama: campName,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        budget_creator_plafon: 0, budget_ads_plafon: 0,
        tipe_campaign: isAwareness ? 'awareness' : 'sales',
        target_gmv: isAwareness ? null : targetVal, target_video: isAwareness ? targetVal : null,
        target_creator: null, status: 'selesai', pin: '1234'
      }).select().single();
      
      if (data) campaignMap.set(normCamp, data.id);
    }
  }
  console.log(`Inserted ${campaignMap.size} campaigns.`);

  // Load creators
  console.log("\nFetching existing creators from DB...");
  const creatorMap = new Map();
  let page = 0;
  while(true) {
    const { data } = await supabase.from('creators').select('id, username').range(page*1000, (page+1)*1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(c => creatorMap.set(normalizeStr(c.username), c.id));
    page++;
  }

  // 2. SKUs
  console.log("\n📦 Inserting SKUs...");
  const skuSheet = trackingWb.Sheets['SKU'];
  if (skuSheet) {
    const skuData = XLSX.utils.sheet_to_json<any[]>(skuSheet, { header: 1 });
    const skuHeaderIdx = findHeaderRow(skuData, ['campaign', 'nama produk']);
    if (skuHeaderIdx !== -1) {
      const headers = skuData[skuHeaderIdx].map((h:any) => String(h||'').trim().toLowerCase());
      const cIdx = headers.findIndex((h:any) => h.includes('campaign'));
      const nIdx = headers.findIndex((h:any) => h.includes('nama produk'));
      const pidIdx = headers.findIndex((h:any) => h.includes('product id'));
      
      for (let i = skuHeaderIdx + 1; i < skuData.length; i++) {
        const row = skuData[i];
        if (!row || !row[cIdx] || !row[nIdx]) continue;
        
        const normCamp = normalizeStr(row[cIdx]);
        let cId = Array.from(campaignMap.entries()).find(([nc]) => nc.includes(normCamp) || normCamp.includes(nc))?.[1];
        
        if (cId) {
           await supabase.from('skus').insert({
             campaign_id: cId,
             nama: String(row[nIdx]).substring(0, 255),
             product_id: row[pidIdx] ? String(row[pidIdx]).substring(0, 100) : 'UNKNOWN',
             komisi: 0
           });
        }
      }
    }
  }

  // 3. Campaign Creators & Videos
  console.log("\n👥 Linking Creators to Campaigns...");
  const listingWb = XLSX.readFile(fileListing);
  const excludedSheets = ['TEMPLATE SALES', 'TEMPLATE AWARENESS', 'POOL DATABASE', 'LAGI TESTING', 'RAW_organic', 'TEST', 'Database Beauty'];
  
  let ccCount = 0;
  let videoCount = 0;

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
    if (!campId && campaignMap.size > 0) campId = Array.from(campaignMap.values())[0]; // fallback

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[userIdx] || !campId) continue;
      
      const cId = creatorMap.get(normalizeStr(row[userIdx]));
      if (!cId) continue;

      let apprv = String(row[approvalIdx] || 'pending').toLowerCase();
      if (!['pending','approved','alternate','not_approved'].includes(apprv)) apprv = 'pending';
      const price = row[priceIdx] ? parseInt(String(row[priceIdx]).replace(/\D/g, '')) : 0;
      const qty = row[qtyIdx] ? parseInt(String(row[qtyIdx]).replace(/\D/g, '')) : 1;

      const { data: ccData } = await supabase.from('campaign_creators').upsert({
        campaign_id: campId, creator_id: cId,
        tier: row[tierIdx] ? String(row[tierIdx]).substring(0,50) : 'Standard',
        price: isNaN(price) ? 0 : price, qty_vt: isNaN(qty) ? 1 : qty,
        approval: apprv, gmv_organic_legacy: row[gmvIdx] ? parseInt(String(row[gmvIdx]).replace(/\D/g, '')) : 0,
        status_bayar: 'belum', pic_assist: 'Admin'
      }, { onConflict: 'campaign_id, creator_id' }).select('id').single();

      if (ccData) {
         ccCount++;
         for (const vCol of videoCols) {
            if (row[vCol] && String(row[vCol]).length > 5) {
               await supabase.from('videos').insert({
                  campaign_creator_id: ccData.id, link_video: String(row[vCol]).substring(0, 255),
                  tanggal_post: new Date().toISOString().split('T')[0], status: 'live'
               });
               videoCount++;
            }
         }
      }
    }
  }
  console.log(`Inserted ${ccCount} campaign_creators, ${videoCount} videos.`);
  console.log("✅ Campaign Fix Completed!");
}

fixCampaigns().catch(console.error);
