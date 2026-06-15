import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const dataPath = path.join(__dirname, '../../');
const fileListing = path.join(dataPath, 'Database_Listing TNT.xlsx');
const fileBudgeting = path.join(dataPath, 'TNT Campaign Budgeting.xlsx');
const fileTracking = path.join(dataPath, 'TNT Project Tracking (Internal).xlsx');

function normalizeStr(str: string) { return str ? String(str).toLowerCase().replace(/[^a-z0-9]/g, '') : ''; }

async function validate() {
  const report: any = { A: {}, B: {}, C: [], D: {}, E: {} };

  console.log("Loading Excel files...");
  const listingWb = XLSX.readFile(fileListing);
  const budgetWb = XLSX.readFile(fileBudgeting);
  const trackWb = XLSX.readFile(fileTracking);

  const excludedListing = ['TEMPLATE SALES', 'TEMPLATE AWARENESS', 'POOL DATABASE', 'LAGI TESTING', 'RAW_organic', 'TEST', 'Database Beauty'];
  
  // A. COUNTS IN EXCEL
  let exCreators = new Set();
  let exCampaignCreators = 0;
  let exVideos = 0;
  let exTotalGMV: Record<string, number> = {};
  let exTotalPrice: Record<string, number> = {};

  for (const sheetName of listingWb.SheetNames.filter(s => !excludedListing.includes(s))) {
    const data = XLSX.utils.sheet_to_json<any[]>(listingWb.Sheets[sheetName], { header: 1 });
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
        if (data[i] && data[i].some((c:any) => String(c).toLowerCase().includes('username'))) { headerIdx = i; break; }
    }
    if (headerIdx === -1) continue;
    
    const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const userIdx = headers.findIndex((h:any) => h && h.includes('username'));
    const priceIdx = headers.findIndex((h:any) => h && h.includes('price'));
    const gmvIdx = headers.findIndex((h:any) => h && h.includes('gmv'));
    const videoCols: number[] = [];
    headers.forEach((h:any, idx:number) => { if (h && (h.includes('link video') || h === 'video' || h.includes('link vt'))) videoCols.push(idx); });

    const normBrand = normalizeStr(sheetName);
    if (!exTotalGMV[normBrand]) exTotalGMV[normBrand] = 0;
    if (!exTotalPrice[normBrand]) exTotalPrice[normBrand] = 0;

    for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[userIdx]) continue;
        const uname = normalizeStr(row[userIdx]);
        if (!uname) continue;
        
        exCreators.add(uname);
        exCampaignCreators++;
        
        for (const vCol of videoCols) {
            if (row[vCol] && String(row[vCol]).length > 5) exVideos++;
        }
        
        if (priceIdx !== -1 && row[priceIdx]) {
           const p = parseInt(String(row[priceIdx]).replace(/\D/g, ''));
           if (!isNaN(p)) exTotalPrice[normBrand] += p;
        }
        if (gmvIdx !== -1 && row[gmvIdx]) {
           const g = parseInt(String(row[gmvIdx]).replace(/\D/g, ''));
           if (!isNaN(g)) exTotalGMV[normBrand] += g;
        }
    }
  }

  let exPayouts = 0;
  let exAds = 0;
  let exTotalAds: Record<string, number> = {};
  
  for (const sheetName of budgetWb.SheetNames.filter(s => s !== 'TEMPLATE')) {
    const data = XLSX.utils.sheet_to_json<any[]>(budgetWb.Sheets[sheetName], { header: 1 });
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
        if (data[i] && data[i].some((c:any) => String(c).toLowerCase().includes('username id'))) { headerIdx = i; break; }
    }
    if (headerIdx === -1) continue;
    
    const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const userIdx = headers.findIndex((h:any) => h && h.includes('username id'));
    const pelunasanIdx = headers.findIndex((h:any) => h && h.includes('pelunasan'));
    const adsIdx = headers.findIndex((h:any) => h && h.includes('total budget ads'));
    const normBrand = normalizeStr(sheetName);
    if (!exTotalAds[normBrand]) exTotalAds[normBrand] = 0;

    for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        if (userIdx !== -1 && row[userIdx] && pelunasanIdx !== -1 && row[pelunasanIdx]) {
             const p = parseInt(String(row[pelunasanIdx]).replace(/\D/g, ''));
             if (p > 0) exPayouts++;
        }
        if (adsIdx !== -1 && row[adsIdx]) {
             const a = parseInt(String(row[adsIdx]).replace(/\D/g, ''));
             if (a > 0) {
                 exAds++;
                 exTotalAds[normBrand] += a;
             }
        }
    }
  }

  // DB Counts
  console.log("Fetching DB counts...");
  const qC = await supabase.from('creators').select('username', { count: 'exact' });
  const qCamp = await supabase.from('campaigns').select('id, nama', { count: 'exact' });
  const qCC = await supabase.from('campaign_creators').select('id, campaign_id, price, gmv_organic_legacy', { count: 'exact' });
  const qVid = await supabase.from('videos').select('id', { count: 'exact' });
  const qPay = await supabase.from('payout_creator').select('id', { count: 'exact' });
  const qAds = await supabase.from('payout_requests').select('id, nominal, campaign_id').eq('jenis_topup', 'ads');
  
  report.A = {
     creators: { excel: exCreators.size, db: qC.count },
     campaign_creators: { excel: exCampaignCreators, db: qCC.count },
     videos: { excel: exVideos, db: qVid.count },
     payouts: { excel: exPayouts, db: qPay.count },
     campaigns: { excel: trackWb.Sheets['Maindata'] ? XLSX.utils.sheet_to_json(trackWb.Sheets['Maindata']).length : 0, db: qCamp.count }, // Approx
  };

  // B. Integrity
  console.log("Checking DB Integrity...");
  // Duplicate creators
  const cNames = qC.data?.map(c => normalizeStr(c.username)) || [];
  const cCountMap: any = {};
  cNames.forEach(n => cCountMap[n] = (cCountMap[n] || 0) + 1);
  const dupes = Object.entries(cCountMap).filter(([k,v]) => (v as number) > 1);
  
  report.B = {
     duplicate_creators: dupes.length,
     duplicate_details: dupes.slice(0, 5)
  };

  // D. Aggregates
  console.log("Checking Aggregates...");
  const dbTotalPrice: Record<string, number> = {};
  const dbTotalGMV: Record<string, number> = {};
  
  const camps = qCamp.data || [];
  const campMap = new Map();
  camps.forEach(c => campMap.set(c.id, normalizeStr(c.nama)));
  
  for (const cc of (qCC.data || [])) {
     const nName = campMap.get(cc.campaign_id);
     if (!nName) continue;
     if (!dbTotalPrice[nName]) dbTotalPrice[nName] = 0;
     if (!dbTotalGMV[nName]) dbTotalGMV[nName] = 0;
     dbTotalPrice[nName] += (cc.price || 0);
     dbTotalGMV[nName] += (cc.gmv_organic_legacy || 0);
  }

  const dbTotalAds: Record<string, number> = {};
  for (const a of (qAds.data || [])) {
     const nName = campMap.get(a.campaign_id);
     if (!nName) continue;
     if (!dbTotalAds[nName]) dbTotalAds[nName] = 0;
     dbTotalAds[nName] += (a.nominal || 0);
  }
  
  report.D = { exTotalPrice, dbTotalPrice, exTotalGMV, dbTotalGMV, exTotalAds, dbTotalAds };

  // E. Sensitive Data
  console.log("Checking sensitive data...");
  const qCont = await supabase.from('creator_contacts').select('nomor');
  const nomMap: any = {};
  qCont.data?.forEach(c => {
     if (c.nomor && c.nomor.length > 5) nomMap[c.nomor] = (nomMap[c.nomor] || 0) + 1;
  });
  const dupNom = Object.entries(nomMap).filter(([k,v]) => (v as number) > 1);
  
  report.E = {
      duplicate_wa_count: dupNom.length,
      duplicate_wa_sample: dupNom.slice(0, 5)
  };

  fs.writeFileSync(path.join(__dirname, 'validation_report.json'), JSON.stringify(report, null, 2));
  console.log("Validation complete.");
}

validate().catch(console.error);
