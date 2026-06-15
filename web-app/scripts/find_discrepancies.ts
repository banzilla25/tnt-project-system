import * as XLSX from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const dataPath = path.join(__dirname, '../../');
const fileListing = path.join(dataPath, 'Database_Listing TNT.xlsx');
const fileBudgeting = path.join(dataPath, 'TNT Campaign Budgeting.xlsx');
const fileTracking = path.join(dataPath, 'TNT Project Tracking (Internal).xlsx');

function normalizeStr(str: string) { return str ? String(str).toLowerCase().replace(/[^a-z0-9]/g, '') : ''; }

async function findDifferences() {
  console.log("Analyzing differences...");
  const listingWb = XLSX.readFile(fileListing);
  const budgetWb = XLSX.readFile(fileBudgeting);
  const trackWb = XLSX.readFile(fileTracking);

  const excludedListing = ['TEMPLATE SALES', 'TEMPLATE AWARENESS', 'POOL DATABASE', 'LAGI TESTING', 'RAW_organic', 'TEST', 'Database Beauty'];

  // 1. Creators
  const exCreators = new Set<string>();
  const exCCs: {camp: string, uname: string, rowData: any}[] = [];
  
  for (const sheetName of listingWb.SheetNames.filter(s => !excludedListing.includes(s))) {
    const data = XLSX.utils.sheet_to_json<any[]>(listingWb.Sheets[sheetName], { header: 1 });
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
        if (data[i] && data[i].some((c:any) => String(c).toLowerCase().includes('username'))) { headerIdx = i; break; }
    }
    if (headerIdx === -1) continue;
    
    const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const userIdx = headers.findIndex((h:any) => h && h.includes('username'));

    for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[userIdx]) continue;
        const uname = normalizeStr(row[userIdx]);
        const rawUname = String(row[userIdx]);
        if (!uname) {
             // this might be the -1 creator!
             console.log("Found empty/invalid username in Excel Listing:", rawUname);
             continue;
        }
        exCreators.add(uname);
        exCCs.push({ camp: normalizeStr(sheetName), uname, rowData: row });
    }
  }

  // DB Creators
  const dbCreators = new Set<string>();
  let page = 0;
  while(true) {
    const { data } = await supabase.from('creators').select('username').range(page*1000, (page+1)*1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(c => dbCreators.add(normalizeStr(c.username)));
    page++;
  }

  const missingCreators = [...exCreators].filter(x => !dbCreators.has(x));
  console.log("\n--- CREATORS ---");
  console.log("Missing Creators in DB (-1):", missingCreators.length > 0 ? missingCreators : "None found (might be due to trailing spaces/normalization deduplication).");
  if (missingCreators.length === 0) {
      console.log(`Excel unique count: ${exCreators.size}. DB unique count: ${dbCreators.size}.`);
  }

  // 2. Campaigns
  console.log("\n--- CAMPAIGNS ---");
  const maindataSheet = trackWb.Sheets['Maindata'];
  const maindata = XLSX.utils.sheet_to_json<any[]>(maindataSheet, { header: 1 });
  const mdHeaderIdx = maindata.findIndex(r => r && r.some((c:any) => String(c).toLowerCase().includes('campaign')));
  const exCamps = new Set<string>();
  if (mdHeaderIdx !== -1) {
     const headers = maindata[mdHeaderIdx].map((h:any) => String(h||'').trim().toLowerCase());
     const campIdx = headers.findIndex((h:any) => h && h.includes('campaign'));
     for (let i = mdHeaderIdx + 1; i < maindata.length; i++) {
         if (maindata[i] && maindata[i][campIdx]) exCamps.add(String(maindata[i][campIdx]).trim());
     }
  }
  const { data: dbCampsData } = await supabase.from('campaigns').select('nama');
  const dbCamps = dbCampsData?.map(c => c.nama) || [];
  
  console.log(`Excel Maindata Tracking (18):`);
  console.log([...exCamps].join(', '));
  
  const extraCamps = dbCamps.filter(dbC => ![...exCamps].some(exC => normalizeStr(dbC) === normalizeStr(exC)));
  console.log(`\nDB Extra Campaigns (+12):`);
  console.log(extraCamps.join(', '));


  // 3. Campaign Creators (-1)
  console.log("\n--- CAMPAIGN CREATORS ---");
  const { count: dbCCCount } = await supabase.from('campaign_creators').select('*', { count: 'exact', head: true });
  console.log(`Excel CC Count: ${exCCs.length}, DB CC Count: ${dbCCCount}`);
  // To find the exact -1, we'd have to cross reference all 18k, but let's just see if exCCs length is 18368.
  // Actually, we already found invalid usernames that are skipped. Let's see if any valid CC was not inserted.

  // 4. Payouts (-13)
  console.log("\n--- PAYOUTS ---");
  const exPayoutsList: {camp: string, uname: string, nominal: number, status: string}[] = [];
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
    const statusIdx = headers.findIndex((h:any) => h && h.includes('status bayar'));

    for (let i = headerIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || userIdx === -1 || !row[userIdx]) continue;
        if (pelunasanIdx !== -1 && row[pelunasanIdx]) {
             const p = parseInt(String(row[pelunasanIdx]).replace(/\D/g, ''));
             if (p > 0) {
                 exPayoutsList.push({
                     camp: sheetName,
                     uname: String(row[userIdx]),
                     nominal: p,
                     status: String(row[statusIdx] || '')
                 });
             }
        }
    }
  }

  // Get DB payouts
  const { data: dbPayoutsData } = await supabase.from('payout_creator').select('nominal, campaign_creators(creators(username))');
  
  // Create a normalized list of DB payouts to compare
  const dbPayoutItems = dbPayoutsData?.map(d => ({
      uname: normalizeStr((d.campaign_creators as any)?.creators?.username),
      nominal: d.nominal
  })) || [];

  const missingPayouts = [];
  const dbPayoutsCopy = [...dbPayoutItems];

  for (const exp of exPayoutsList) {
      const normU = normalizeStr(exp.uname);
      const idx = dbPayoutsCopy.findIndex(dbp => dbp.uname === normU && dbp.nominal === exp.nominal);
      if (idx !== -1) {
          dbPayoutsCopy.splice(idx, 1); // matched
      } else {
          missingPayouts.push(exp);
      }
  }

  console.log(`Missing Payouts in DB (${missingPayouts.length}):`);
  missingPayouts.forEach(mp => console.log(`- Campaign: ${mp.camp} | Creator: ${mp.uname} | Nominal: ${mp.nominal} | Status: ${mp.status}`));
}

findDifferences().catch(console.error);
