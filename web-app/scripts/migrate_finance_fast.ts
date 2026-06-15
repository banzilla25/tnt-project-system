import * as XLSX from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const fileBudgeting = path.join(__dirname, '../../TNT Campaign Budgeting.xlsx');

function normalizeStr(str: string) { return str ? str.toString().toLowerCase().replace(/[^a-z0-9]/g, '') : ''; }

async function runFinanceMigrationFast() {
  console.log("🚀 Starting Fast Finance Migration (Phase 3)...");

  console.log("Fetching existing creators from DB...");
  const creatorMap = new Map();
  let page = 0;
  while(true) {
    const { data } = await supabase.from('creators').select('id, username').range(page*1000, (page+1)*1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(c => creatorMap.set(normalizeStr(c.username), c.id));
    page++;
  }
  
  const { data: dbCamps } = await supabase.from('campaigns').select('id, nama');
  const campaignMap = new Map();
  if (dbCamps) dbCamps.forEach(c => campaignMap.set(normalizeStr(c.nama), c.id));

  console.log("Fetching existing campaign_creators...");
  const ccMap = new Map();
  let ccPage = 0;
  while(true) {
     const {data} = await supabase.from('campaign_creators').select('id, campaign_id, creator_id').range(ccPage*1000, (ccPage+1)*1000-1);
     if (!data || data.length === 0) break;
     data.forEach(cc => ccMap.set(`${cc.campaign_id}_${cc.creator_id}`, cc.id));
     ccPage++;
  }

  const budgetingWb = XLSX.readFile(fileBudgeting);
  const brandNames = budgetingWb.SheetNames.filter(s => s !== 'TEMPLATE');

  const bulkPayoutsByCamp: Record<number, any[]> = {};
  const bulkAdsByCamp: Record<number, number> = {}; // sum of ads budget
  const ccStatusUpdates: {id: number, status: string}[] = [];

  for (const sheetName of brandNames) {
    const sheet = budgetingWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    if (data.length < 2) continue;
    
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
        if (data[i] && data[i].some((c:any) => String(c).toLowerCase().includes('username id'))) {
            headerIdx = i; break;
        }
    }
    if (headerIdx === -1) continue;

    const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const userIdx = headers.findIndex((h:any) => h && h.includes('username id'));
    const pelunasanIdx = headers.findIndex((h:any) => h && h.includes('pelunasan'));
    const statusIdx = headers.findIndex((h:any) => h && h.includes('status bayar'));
    const adsBudgetIdx = headers.findIndex((h:any) => h && h.includes('total budget ads'));
    
    const normBrand = normalizeStr(sheetName);
    let campId = Array.from(campaignMap.entries()).find(([nc]) => nc.includes(normBrand) || normBrand.includes(nc))?.[1] || (campaignMap.size > 0 ? Array.from(campaignMap.values())[0] : null);

    if (!campId) continue;
    
    if (!bulkPayoutsByCamp[campId]) bulkPayoutsByCamp[campId] = [];
    if (!bulkAdsByCamp[campId]) bulkAdsByCamp[campId] = 0;

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      
      // 1. Payouts
      if (userIdx !== -1 && row[userIdx]) {
        const cId = creatorMap.get(normalizeStr(row[userIdx]));
        if (cId) {
            const ccId = ccMap.get(`${campId}_${cId}`);
            if (ccId) {
                const pelunasan = row[pelunasanIdx] ? parseInt(String(row[pelunasanIdx]).replace(/\D/g, '')) : 0;
                let status = String(row[statusIdx] || 'belum').toLowerCase();
                if (status.includes('pay off')) status = 'lunas';
                else if (status.includes('half')) status = 'sebagian';
                else status = 'belum';

                if (pelunasan > 0) {
                    bulkPayoutsByCamp[campId].push({
                        campaign_creator_id: ccId,
                        nominal: pelunasan,
                        tanggal_transfer: new Date().toISOString().split('T')[0]
                    });
                }
                
                if (status !== 'belum') {
                   ccStatusUpdates.push({ id: ccId, status });
                }
            }
        }
      }
      
      // 2. Ads
      if (adsBudgetIdx !== -1 && row[adsBudgetIdx]) {
         const adsVal = parseInt(String(row[adsBudgetIdx]).replace(/\D/g, ''));
         if (!isNaN(adsVal) && adsVal > 0) {
             bulkAdsByCamp[campId] += adsVal;
         }
      }
    }
  }
  
  await supabase.from('payout_creator').delete().neq('id', 0);
  await supabase.from('payout_requests').delete().neq('id', 0);
  
  console.log("Prepared payout & ads data. Bulk inserting...");
  
  // Create payout requests for ads
  for (const [campId, sumAds] of Object.entries(bulkAdsByCamp)) {
      if (sumAds > 0) {
          await supabase.from('payout_requests').insert({
              campaign_id: Number(campId),
              jenis_topup: 'ads',
              nominal: sumAds,
              status: 'approved'
          });
      }
  }
  
  // Create payout requests for creators & link payout_creator
  let totalPc = 0;
  for (const [campId, payouts] of Object.entries(bulkPayoutsByCamp)) {
      if (payouts.length > 0) {
          const totalNominal = payouts.reduce((sum, p) => sum + p.nominal, 0);
          
          const { data: prData, error: prErr } = await supabase.from('payout_requests').insert({
              campaign_id: Number(campId),
              jenis_topup: 'creator',
              nominal: totalNominal,
              status: 'approved'
          }).select('id').single();
          
          if (prData) {
              const insertPayouts = payouts.map(p => ({ ...p, payout_id: prData.id }));
              
              for (let i = 0; i < insertPayouts.length; i += 1000) {
                 const b = insertPayouts.slice(i, i+1000);
                 const {error} = await supabase.from('payout_creator').insert(b);
                 if (error) console.error("Payout Error:", error);
                 else totalPc += b.length;
              }
          } else {
             console.error("Failed to create payout request for camp", campId, prErr);
          }
      }
  }

  console.log(`Inserted ${totalPc} payout_creator entries.`);

  console.log(`Updating ${ccStatusUpdates.length} campaign_creators statuses...`);
  for (let i = 0; i < ccStatusUpdates.length; i += 100) {
     const batch = ccStatusUpdates.slice(i, i+100);
     await Promise.all(batch.map(p => supabase.from('campaign_creators').update({ status_bayar: p.status }).eq('id', p.id)));
  }

  console.log("\n✅ Finance Migration Completed!");
}

runFinanceMigrationFast().catch(console.error);
