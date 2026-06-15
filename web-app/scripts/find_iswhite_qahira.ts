import * as XLSX from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const dataPath = path.join(__dirname, '../../');
const fileListing = path.join(dataPath, 'Database_Listing TNT.xlsx');

function normalizeStr(str: string) { return str ? String(str).toLowerCase().replace(/[^a-z0-9]/g, '') : ''; }

async function findSpecificDiffs() {
  console.log("Analyzing Iswhite and Qahira...");
  const listingWb = XLSX.readFile(fileListing);

  // 1. ISWHITE (Price)
  console.log("\n--- ISWHITE ---");
  const iswhiteSheet = listingWb.Sheets['ISWHITE'];
  const iswhiteData = XLSX.utils.sheet_to_json<any[]>(iswhiteSheet, { header: 1 });
  
  let headerIdx = iswhiteData.findIndex(r => r && r.some((c:any) => String(c).toLowerCase().includes('username')));
  let headers = iswhiteData[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
  let userIdx = headers.findIndex((h:any) => h && h.includes('username'));
  let priceIdx = headers.findIndex((h:any) => h && h.includes('price'));

  const exIswhitePrices: Record<string, number> = {};
  for (let i = headerIdx + 1; i < iswhiteData.length; i++) {
     const row = iswhiteData[i];
     if (!row || !row[userIdx]) continue;
     const uname = normalizeStr(row[userIdx]);
     if (priceIdx !== -1 && row[priceIdx]) {
         const p = parseInt(String(row[priceIdx]).replace(/\D/g, ''));
         if (!isNaN(p)) exIswhitePrices[uname] = p;
     }
  }

  // Get DB prices for Iswhite
  // Find campaign_id for iswhite
  const { data: cData } = await supabase.from('campaigns').select('id').ilike('nama', '%iswhite%').single();
  if (cData) {
      const { data: dbData } = await supabase.from('campaign_creators').select('price, creators(username)').eq('campaign_id', cData.id);
      const dbPrices: Record<string, number> = {};
      dbData?.forEach(d => {
          dbPrices[normalizeStr((d as any).creators.username)] = d.price;
      });

      // Find diff
      const iswhiteMissing = [];
      for (const [uname, price] of Object.entries(exIswhitePrices)) {
          if (dbPrices[uname] !== price) {
              iswhiteMissing.push({ uname, excelPrice: price, dbPrice: dbPrices[uname] });
          }
      }
      console.log("Iswhite Discrepancies:", iswhiteMissing);
  }

  // 2. QAHIRA (GMV)
  console.log("\n--- QAHIRA ---");
  const qahiraSheet = listingWb.Sheets['QAHIRA'];
  const qahiraData = XLSX.utils.sheet_to_json<any[]>(qahiraSheet, { header: 1 });
  
  headerIdx = qahiraData.findIndex(r => r && r.some((c:any) => String(c).toLowerCase().includes('username')));
  headers = qahiraData[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
  userIdx = headers.findIndex((h:any) => h && h.includes('username'));
  let gmvIdx = headers.findIndex((h:any) => h && h.includes('gmv'));

  const exQahiraGMV: Record<string, {val: number, raw: any}> = {};
  for (let i = headerIdx + 1; i < qahiraData.length; i++) {
     const row = qahiraData[i];
     if (!row || !row[userIdx]) continue;
     const uname = normalizeStr(row[userIdx]);
     if (gmvIdx !== -1 && row[gmvIdx]) {
         const g = parseInt(String(row[gmvIdx]).replace(/\D/g, ''));
         if (!isNaN(g)) exQahiraGMV[uname] = { val: g, raw: row[gmvIdx] };
     }
  }

  const { data: qcData } = await supabase.from('campaigns').select('id').ilike('nama', '%qahira%').single();
  if (qcData) {
      const { data: dbData } = await supabase.from('campaign_creators').select('gmv_organic_legacy, creators(username)').eq('campaign_id', qcData.id);
      const dbGMV: Record<string, number> = {};
      dbData?.forEach(d => {
          dbGMV[normalizeStr((d as any).creators.username)] = d.gmv_organic_legacy;
      });

      // Find diff
      const qahiraMissing = [];
      for (const [uname, gmv] of Object.entries(exQahiraGMV)) {
          if (dbGMV[uname] !== gmv.val) {
              qahiraMissing.push({ uname, excelRaw: gmv.raw, excelParsed: gmv.val, dbGMV: dbGMV[uname] });
          }
      }
      console.log("Qahira Discrepancies:", qahiraMissing);
  }

}

findSpecificDiffs().catch(console.error);
