import * as XLSX from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const dataPath = path.join(__dirname, '../../');
const fileBudgeting = path.join(dataPath, 'TNT Campaign Budgeting.xlsx');

function normalizeStr(str: string) {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function runFinanceMigration() {
  console.log("🚀 Starting Finance Migration (Phase 3)...");

  // Load existing creators
  const creatorMap = new Map();
  let page = 0;
  while(true) {
    const { data } = await supabase.from('creators').select('id, username').range(page*1000, (page+1)*1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(c => creatorMap.set(normalizeStr(c.username), c.id));
    page++;
  }
  
  // Load campaigns
  const { data: dbCamps } = await supabase.from('campaigns').select('id, nama');
  const campaignMap = new Map();
  if (dbCamps) {
    dbCamps.forEach(c => campaignMap.set(normalizeStr(c.nama), c.id));
  }

  const budgetingWb = XLSX.readFile(fileBudgeting);
  const brandNames = budgetingWb.SheetNames.filter(s => s !== 'TEMPLATE');

  let payoutCount = 0;
  let adsCount = 0;

  for (const sheetName of brandNames) {
    const sheet = budgetingWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    if (data.length < 2) continue;
    
    // Find Headers
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
        if (data[i] && data[i].some((c:any) => String(c).toLowerCase().includes('username id'))) {
            headerIdx = i; break;
        }
    }
    if (headerIdx === -1) continue;

    const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const userIdx = headers.findIndex((h:any) => h && h.includes('username id'));
    const totalRateIdx = headers.findIndex((h:any) => h && h.includes('total rate card'));
    const pelunasanIdx = headers.findIndex((h:any) => h && h.includes('pelunasan'));
    const statusIdx = headers.findIndex((h:any) => h && h.includes('status bayar'));
    const tglIdx = headers.findIndex((h:any) => h && (h.includes('tgl pembayaran') || h.includes('tanggal')));
    
    // Ads columns (usually on the right side)
    const adsBudgetIdx = headers.findIndex((h:any) => h && h.includes('total budget ads'));
    
    const campId = Array.from(campaignMap.entries()).find(([nc]) => nc.includes(normalizeStr(sheetName)) || normalizeStr(sheetName).includes(nc))?.[1] || (campaignMap.size > 0 ? Array.from(campaignMap.values())[0] : null);

    if (!campId) continue;

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      
      // 1. Process Payouts (Left Side)
      if (userIdx !== -1 && row[userIdx]) {
        const normUser = normalizeStr(row[userIdx]);
        const cId = creatorMap.get(normUser);
        
        if (cId) {
            // Find campaign_creator_id
            const { data: ccData } = await supabase.from('campaign_creators').select('id').eq('campaign_id', campId).eq('creator_id', cId).single();
            
            if (ccData) {
                const pelunasan = row[pelunasanIdx] ? parseInt(String(row[pelunasanIdx]).replace(/\D/g, '')) : 0;
                let status = String(row[statusIdx] || 'belum').toLowerCase();
                if (status.includes('pay off')) status = 'lunas';
                else if (status.includes('half')) status = 'cicilan';
                else status = 'belum';

                if (pelunasan > 0) {
                    await supabase.from('payout_creator').insert({
                        campaign_creator_id: ccData.id,
                        nominal: pelunasan,
                        tanggal_pembayaran: new Date().toISOString().split('T')[0],
                        status: 'selesai'
                    });
                    
                    await supabase.from('campaign_creators').update({ status_bayar: status }).eq('id', ccData.id);
                    payoutCount++;
                }
            }
        }
      }
      
      // 2. Process Ads (Right Side)
      if (adsBudgetIdx !== -1 && row[adsBudgetIdx]) {
         const adsVal = parseInt(String(row[adsBudgetIdx]).replace(/\D/g, ''));
         if (!isNaN(adsVal) && adsVal > 0) {
             await supabase.from('ads_spends').insert({
                 campaign_id: campId,
                 nominal: adsVal,
                 tanggal_topup: new Date().toISOString().split('T')[0],
                 keterangan: 'Migrasi Historis Excel'
             });
             adsCount++;
         }
      }
    }
  }
  
  console.log(`Inserted ${payoutCount} payouts and ${adsCount} ads spends.`);
  console.log("\n✅ Finance Migration Completed!");
}

runFinanceMigration().catch(console.error);
