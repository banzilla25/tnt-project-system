import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const dataPath = path.join(__dirname, '../../');
const fileListing = path.join(dataPath, 'Database_Listing TNT.xlsx');
const fileTracking = path.join(dataPath, 'TNT Project Tracking (Internal).xlsx');
const fileBudgeting = path.join(dataPath, 'TNT Campaign Budgeting.xlsx');

function normalizeStr(str: string) {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeaderRow(data: any[], keywords: string[]) {
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const rowStr = row.map((c:any) => String(c).toLowerCase()).join(' ');
    if (keywords.every(k => rowStr.includes(k.toLowerCase()))) {
      return i;
    }
  }
  return -1;
}

async function runRelationsMigration() {
  console.log("🚀 Starting Relational Migration (Phase 2)...");

  // Load existing creators
  console.log("Fetching existing creators from DB...");
  const creatorMap = new Map();
  let page = 0;
  while(true) {
    const { data } = await supabase.from('creators').select('id, username').range(page*1000, (page+1)*1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(c => creatorMap.set(normalizeStr(c.username), c.id));
    page++;
  }
  console.log(`Loaded ${creatorMap.size} creators.`);

  // Load existing brands
  const { data: dbBrands } = await supabase.from('brands').select('id, nama');
  const brandMap = new Map();
  if (dbBrands) {
    dbBrands.forEach(b => brandMap.set(normalizeStr(b.nama), b.id));
  }

  // 1. Niches
  console.log("\n🌱 Inserting Niches...");
  const nicheNames = ['Skincare', 'Makeup', 'Home Living', 'Lifestyle', 'Fashion'];
  const nicheMap = new Map();
  for (const n of nicheNames) {
    const { data } = await supabase.from('niches').upsert({ nama: n }, { onConflict: 'nama' }).select().single();
    if (data) nicheMap.set(n.toLowerCase(), data.id);
  }

  // 2. Campaigns
  console.log("\n📊 Inserting Campaigns...");
  const trackingWb = XLSX.readFile(fileTracking);
  const maindataSheet = trackingWb.Sheets['Maindata'];
  const maindata = XLSX.utils.sheet_to_json<any[]>(maindataSheet, { header: 1 });
  const mdHeaderIdx = findHeaderRow(maindata, ['campaign']);
  
  const campaignMap = new Map(); // normalized campaign -> id
  const campNameToId = new Map(); // raw -> id (for SKU)

  if (mdHeaderIdx !== -1) {
    const headers = maindata[mdHeaderIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const campIdx = headers.findIndex((h:any) => h.includes('campaign'));
    const brandIdx = headers.findIndex((h:any) => h.includes('brand'));
    const targetIdx = headers.findIndex((h:any) => h.includes('target'));

    const campaignsToInsert = [];
    for (let i = mdHeaderIdx + 1; i < maindata.length; i++) {
      const row = maindata[i];
      if (!row || !row[campIdx]) continue;
      
      const campName = String(row[campIdx]).trim();
      const brandName = row[brandIdx] ? String(row[brandIdx]).trim() : '';
      const targetVal = row[targetIdx] ? parseInt(String(row[targetIdx]).replace(/\D/g, '')) : 0;
      
      const normCamp = normalizeStr(campName);
      let isAwareness = false;
      if (normCamp.includes('kimme') || normCamp.includes('dioly') || normCamp.includes('skinmology') || normCamp.includes('pws') || normCamp.includes('perfectwhite')) {
        isAwareness = true;
      } else if (targetVal < 1000000 && targetVal > 0) {
        isAwareness = true;
      }

      let bId = null;
      for (const [nb, id] of brandMap.entries()) {
        if (normalizeStr(brandName).includes(nb) || normCamp.includes(nb)) {
          bId = id; break;
        }
      }
      if (!bId && brandMap.size > 0) bId = Array.from(brandMap.values())[0];

      campaignsToInsert.push({
        brand_id: bId,
        nama: campName,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
        budget_creator_plafon: 0,
        budget_ads_plafon: 0,
        tipe_campaign: isAwareness ? 'awareness' : 'sales',
        target_gmv: isAwareness ? null : targetVal,
        target_video: isAwareness ? targetVal : null,
        target_creator: null,
        status: 'selesai', // Historic campaigns
        pin: '1234'
      });
    }

    // Load existing campaigns to avoid duplicates
    const { data: existingCamps } = await supabase.from('campaigns').select('id, nama');
    const existingCampNames = new Set(existingCamps?.map(c => normalizeStr(c.nama)) || []);

    // Insert campaigns
    for (const c of campaignsToInsert) {
      const normName = normalizeStr(c.nama);
      if (existingCampNames.has(normName)) {
         const existId = existingCamps?.find(ec => normalizeStr(ec.nama) === normName)?.id;
         if (existId) {
             campaignMap.set(normName, existId);
             campNameToId.set(c.nama, existId);
             for (const [nb, bId] of brandMap.entries()) {
                if (c.brand_id === bId) campaignMap.set(nb, existId);
             }
         }
         continue;
      }

      const { data, error } = await supabase.from('campaigns').insert(c).select().single();
      if (error) console.error(`Error inserting campaign ${c.nama}:`, error);
      if (data) {
        existingCampNames.add(normName);
        existingCamps?.push(data);
        campaignMap.set(normalizeStr(data.nama), data.id);
        campNameToId.set(data.nama, data.id);
        
        // Also map brand name as fallback
        for (const [nb, bId] of brandMap.entries()) {
           if (c.brand_id === bId) campaignMap.set(nb, data.id);
        }
      }
    }
    console.log(`Inserted ${campaignMap.size} campaigns.`);
  }

  // 3. SKUs
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
      const comIdx = headers.findIndex((h:any) => h.includes('commision') || h.includes('komisi'));

      let skuCount = 0;
      for (let i = skuHeaderIdx + 1; i < skuData.length; i++) {
        const row = skuData[i];
        if (!row || !row[cIdx] || !row[nIdx]) continue;
        
        let cId = null;
        const normCamp = normalizeStr(row[cIdx]);
        for (const [nc, id] of campaignMap.entries()) {
          if (nc.includes(normCamp) || normCamp.includes(nc)) {
             cId = id; break;
          }
        }
        
        if (cId) {
           const {error} = await supabase.from('skus').insert({
             campaign_id: cId,
             nama: String(row[nIdx]).substring(0, 255),
             product_id: row[pidIdx] ? String(row[pidIdx]).substring(0, 100) : 'UNKNOWN',
             komisi: row[comIdx] ? parseFloat(String(row[comIdx])) : 0
           });
           if (!error) skuCount++;
        }
      }
      console.log(`Inserted ${skuCount} SKUs.`);
    }
  }

  // 4. Listing (Contacts, Snapshots, Niches, Campaign Creators, Videos)
  console.log("\n👥 Inserting Creator Relational Data...");
  const listingWb = XLSX.readFile(fileListing);
  const excludedSheets = ['TEMPLATE SALES', 'TEMPLATE AWARENESS', 'POOL DATABASE', 'LAGI TESTING', 'RAW_organic', 'TEST', 'Database Beauty'];
  const brandNamesList = listingWb.SheetNames.filter(s => !excludedSheets.includes(s));

  let ccCount = 0;
  let snapCount = 0;
  let contactCount = 0;
  let videoCount = 0;

  for (const sheetName of brandNamesList) {
    const sheet = listingWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const headerIdx = findHeaderRow(data, ['username']);
    if (headerIdx === -1) continue;
    
    const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const userIdx = headers.findIndex((h:any) => h?.includes('username'));
    const phoneIdx = headers.findIndex((h:any) => h?.includes('whatsapp') || h?.includes('wa'));
    const followerIdx = headers.findIndex((h:any) => h?.includes('followers'));
    const priceIdx = headers.findIndex((h:any) => h?.includes('price'));
    const qtyIdx = headers.findIndex((h:any) => h?.includes('qty'));
    const approvalIdx = headers.findIndex((h:any) => h?.includes('approval'));
    const gmvIdx = headers.findIndex((h:any) => h?.includes('gmv'));
    const tierIdx = headers.findIndex((h:any) => h?.includes('tier'));
    const levelIdx = headers.findIndex((h:any) => h?.includes('level'));
    
    // Video links are usually dynamic
    const videoCols: number[] = [];
    headers.forEach((h:any, idx:number) => {
      if (h && (h.includes('link video') || h === 'video' || h.includes('link vt'))) {
        videoCols.push(idx);
      }
    });

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[userIdx]) continue;
      
      const rawUser = String(row[userIdx]).trim();
      const normUser = normalizeStr(rawUser);
      const cId = creatorMap.get(normUser);
      if (!cId) continue;

      // Contact
      if (phoneIdx !== -1 && row[phoneIdx]) {
        let phone = String(row[phoneIdx]).replace(/\D/g, '');
        if (phone.length > 5) {
           await supabase.from('creator_contacts').upsert({
             creator_id: cId,
             tipe_kontak: 'wa',
             nilai_kontak: phone,
             status: 'aktif',
             tanggal_mulai: new Date().toISOString().split('T')[0]
           }, { onConflict: 'creator_id, nilai_kontak' });
           contactCount++;
        }
      }

      // Snapshot
      if (followerIdx !== -1 && row[followerIdx]) {
         const f = parseInt(String(row[followerIdx]).replace(/\D/g, ''));
         if (!isNaN(f) && f > 0) {
            await supabase.from('creator_snapshots').insert({
               creator_id: cId,
               followers: f,
               level: row[levelIdx] ? String(row[levelIdx]) : 'Micro',
               gmv_30d: row[gmvIdx] ? parseInt(String(row[gmvIdx]).replace(/\D/g, '')) : 0,
               tanggal_snapshot: new Date().toISOString()
            });
            snapCount++;
         }
      }

      // Campaign Creator
      const normBrand = normalizeStr(sheetName);
      let campId = null;
      for (const [nc, id] of campaignMap.entries()) {
        if (nc.includes(normBrand) || normBrand.includes(nc)) {
          campId = id; break;
        }
      }
      if (!campId && campaignMap.size > 0) campId = Array.from(campaignMap.values())[0];

      if (campId) {
        let apprv = String(row[approvalIdx] || 'pending').toLowerCase();
        if (!['pending','approved','alternate','not_approved'].includes(apprv)) apprv = 'pending';
        
        const price = row[priceIdx] ? parseInt(String(row[priceIdx]).replace(/\D/g, '')) : 0;
        const qty = row[qtyIdx] ? parseInt(String(row[qtyIdx]).replace(/\D/g, '')) : 1;

        const { data: ccData, error: ccErr } = await supabase.from('campaign_creators').upsert({
          campaign_id: campId,
          creator_id: cId,
          tier: row[tierIdx] ? String(row[tierIdx]).substring(0,50) : 'Standard',
          price: isNaN(price) ? 0 : price,
          qty_vt: isNaN(qty) ? 1 : qty,
          approval: apprv,
          gmv_organic_legacy: row[gmvIdx] ? parseInt(String(row[gmvIdx]).replace(/\D/g, '')) : 0,
          status_bayar: 'belum',
          pic_assist: 'Admin'
        }, { onConflict: 'campaign_id, creator_id' }).select('id').single();

        if (ccData) {
           ccCount++;
           
           // Videos
           for (const vCol of videoCols) {
              if (row[vCol]) {
                 const link = String(row[vCol]);
                 if (link.length > 5) {
                    await supabase.from('videos').insert({
                       campaign_creator_id: ccData.id,
                       link_video: link.substring(0, 255),
                       tanggal_post: new Date().toISOString().split('T')[0],
                       status: 'live'
                    });
                    videoCount++;
                 }
              }
           }
        }
      }
    }
  }
  
  console.log(`Inserted ${contactCount} contacts, ${snapCount} snapshots, ${ccCount} campaign_creators, ${videoCount} videos.`);

  console.log("\n✅ Phase 2 Relational Migration Completed!");
}

runRelationsMigration().catch(console.error);
