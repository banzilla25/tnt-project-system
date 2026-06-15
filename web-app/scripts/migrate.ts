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

async function runMigration() {
  console.log("🚀 Starting Data Migration...");
  
  const listingWb = XLSX.readFile(fileListing);
  const trackingWb = XLSX.readFile(fileTracking);
  
  // 1. Brands
  const excludedSheets = ['TEMPLATE SALES', 'TEMPLATE AWARENESS', 'POOL DATABASE', 'LAGI TESTING', 'RAW_organic', 'TEST', 'Database Beauty'];
  let brandNames = listingWb.SheetNames.filter(s => !excludedSheets.includes(s));
  
  console.log(`📦 Found ${brandNames.length} potential brands:`, brandNames);
  const brandMap = new Map();
  for (const b of brandNames) {
    const { data } = await supabase.from('brands').upsert({ nama: b }, { onConflict: 'nama' }).select().single();
    if (data) brandMap.set(normalizeStr(b), data.id);
  }

  // 2. Creators
  console.log("\n👥 Processing Creators (Deduplication)...");
  const creatorMap = new Map(); // normalized_username -> db record
  
  for (const sheetName of brandNames) {
    const sheet = listingWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const headerIdx = findHeaderRow(data, ['username']);
    if (headerIdx === -1) continue;
    
    const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const userIdx = headers.findIndex((h:any) => h?.includes('username'));
    const linkIdx = headers.findIndex((h:any) => h?.includes('link account'));
    const phoneIdx = headers.findIndex((h:any) => h?.includes('whatsapp') || h?.includes('wa'));
    const followerIdx = headers.findIndex((h:any) => h?.includes('followers'));
    const priceIdx = headers.findIndex((h:any) => h?.includes('price'));
    const qtyIdx = headers.findIndex((h:any) => h?.includes('qty'));
    const approvalIdx = headers.findIndex((h:any) => h?.includes('approval'));
    const gmvIdx = headers.findIndex((h:any) => h?.includes('gmv'));
    const tierIdx = headers.findIndex((h:any) => h?.includes('tier'));
    
    if (userIdx === -1) continue;

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[userIdx]) continue;
      
      const rawUser = String(row[userIdx]).trim();
      const normUser = normalizeStr(rawUser);
      if (!normUser || normUser === 'username' || normUser.length < 3) continue;

      if (!creatorMap.has(normUser)) {
        creatorMap.set(normUser, {
          username: rawUser.replace('@', ''),
          link_account: row[linkIdx] || null,
          phone: row[phoneIdx] || null,
          followers: row[followerIdx] ? parseInt(String(row[followerIdx]).replace(/\D/g, '')) : 0,
          // Store row data for campaign_creators later
          campaignData: []
        });
      }
      
      // Push campaign instance
      creatorMap.get(normUser).campaignData.push({
        brand: sheetName,
        price: row[priceIdx] ? parseInt(String(row[priceIdx]).replace(/\D/g, '')) : 0,
        qty: row[qtyIdx] ? parseInt(String(row[qtyIdx]).replace(/\D/g, '')) : 1,
        approval: String(row[approvalIdx] || 'pending').toLowerCase(),
        gmv: row[gmvIdx] ? parseInt(String(row[gmvIdx]).replace(/\D/g, '')) : 0,
        tier: row[tierIdx] || null,
        row: row,
        headers: headers
      });
    }
  }

  console.log(`Found ${creatorMap.size} unique creators. Inserting...`);
  // Insert creators in batches
  const creatorsArr = Array.from(creatorMap.entries());
  for (let i = 0; i < creatorsArr.length; i += 100) {
    const batch = creatorsArr.slice(i, i + 100).map(([k, v]) => ({
      username: v.username,
      nama_asli: v.username,
      link_account: v.link_account,
      rekening: null
    }));
    
    const { data, error } = await supabase.from('creators').upsert(batch, { onConflict: 'username' }).select('id, username');
    if (error) console.error("Error inserting creators:", error);
    if (data) {
      data.forEach(d => {
        const norm = normalizeStr(d.username);
        if (creatorMap.has(norm)) {
          creatorMap.get(norm).dbId = d.id;
        }
      });
    }
  }

  // 3. Campaigns
  console.log("\n📊 Processing Campaigns...");
  const maindataSheet = trackingWb.Sheets['Maindata'];
  const maindata = XLSX.utils.sheet_to_json<any[]>(maindataSheet, { header: 1 });
  const mdHeaderIdx = findHeaderRow(maindata, ['campaign', 'brand']);
  const campaignMap = new Map(); // normalized_campaign -> dbId

  if (mdHeaderIdx !== -1) {
    const headers = maindata[mdHeaderIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const campIdx = headers.findIndex((h:any) => h.includes('campaign'));
    const brandIdx = headers.findIndex((h:any) => h.includes('brand'));
    const targetIdx = headers.findIndex((h:any) => h.includes('target'));

    for (let i = mdHeaderIdx + 1; i < maindata.length; i++) {
      const row = maindata[i];
      if (!row || !row[campIdx]) continue;
      
      const campName = String(row[campIdx]).trim();
      const brandName = row[brandIdx] ? String(row[brandIdx]).trim() : '';
      const targetVal = row[targetIdx] ? parseInt(String(row[targetIdx]).replace(/\D/g, '')) : 0;
      
      // Determine Type (User explicit rules)
      const normCamp = normalizeStr(campName);
      let isAwareness = false;
      if (normCamp.includes('kimme') || normCamp.includes('dioly') || normCamp.includes('skinmology') || normCamp.includes('pws') || normCamp.includes('perfectwhite')) {
        isAwareness = true;
      } else if (targetVal < 1000000) {
        // Fallback heuristic
        isAwareness = true;
      }

      // Map brand
      let bId = null;
      for (const [nb, id] of brandMap.entries()) {
        if (normalizeStr(brandName).includes(nb) || normCamp.includes(nb)) {
          bId = id; break;
        }
      }
      if (!bId && brandMap.size > 0) bId = Array.from(brandMap.values())[0]; // fallback

      const { data, error } = await supabase.from('campaigns').insert({
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
        status: 'aktif',
        pin: '1234'
      }).select().single();

      if (data) {
        campaignMap.set(normCamp, data.id);
        campaignMap.set(normalizeStr(brandName), data.id); // fallback map
      } else {
        console.log("Failed to insert campaign", campName, error);
      }
    }
  }

  // 4. Campaign Creators (Linking)
  console.log("\n🔗 Linking Campaign Creators...");
  let ccCount = 0;
  for (const [normUser, cData] of creatorMap.entries()) {
    if (!cData.dbId) continue;

    for (const inst of cData.campaignData) {
      // Find matching campaign
      const normBrand = normalizeStr(inst.brand);
      let campId = null;
      
      // Try exact or contains
      for (const [nc, id] of campaignMap.entries()) {
        if (nc.includes(normBrand) || normBrand.includes(nc)) {
          campId = id; break;
        }
      }
      
      // If no campaign matched, just skip or link to first available
      if (!campId && campaignMap.size > 0) {
        campId = Array.from(campaignMap.values())[0];
      }
      
      if (!campId) continue;

      let apprv = inst.approval;
      if (!['pending','approved','alternate','not_approved'].includes(apprv)) apprv = 'pending';

      const { error } = await supabase.from('campaign_creators').insert({
        campaign_id: campId,
        creator_id: cData.dbId,
        tier: inst.tier || 'Standard',
        price: isNaN(inst.price) ? 0 : inst.price,
        qty_vt: isNaN(inst.qty) ? 1 : inst.qty,
        approval: apprv,
        gmv_organic_legacy: isNaN(inst.gmv) ? 0 : inst.gmv,
        status_bayar: 'belum'
      });

      if (!error) ccCount++;
    }
  }
  console.log(`Linked ${ccCount} creator instances to campaigns.`);

  console.log("\n✅ Migration Dry-Run / Insert Completed!");
}

runMigration().catch(console.error);
