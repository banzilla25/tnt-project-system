import * as XLSX from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const fileListing = path.join(__dirname, '../../Database_Listing TNT.xlsx');

function normalizeStr(str: string) { return str ? str.toString().toLowerCase().replace(/[^a-z0-9]/g, '') : ''; }

async function fixVideos() {
  console.log("🚀 Starting Videos Fix...");

  const { data: dbCamps } = await supabase.from('campaigns').select('id, nama');
  const campaignMap = new Map();
  if (dbCamps) dbCamps.forEach(c => campaignMap.set(normalizeStr(c.nama), c.id));

  const creatorMap = new Map();
  let page = 0;
  while(true) {
    const { data } = await supabase.from('creators').select('id, username').range(page*1000, (page+1)*1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(c => creatorMap.set(normalizeStr(c.username), c.id));
    page++;
  }

  const listingWb = XLSX.readFile(fileListing);
  const excludedSheets = ['TEMPLATE SALES', 'TEMPLATE AWARENESS', 'POOL DATABASE', 'LAGI TESTING', 'RAW_organic', 'TEST', 'Database Beauty'];
  
  const bulkVid = [];

  for (const sheetName of listingWb.SheetNames.filter(s => !excludedSheets.includes(s))) {
    const sheet = listingWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
        if (!data[i] || data[i].length < 3) continue;
        const rowStr = data[i].map((c:any) => String(c).toLowerCase()).join(' ');
        if (rowStr.includes('username') && rowStr.includes('whatsapp')) { headerIdx = i; break; }
    }
    if (headerIdx === -1) continue;
    
    const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const userIdx = headers.findIndex((h:any) => h?.includes('username'));
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

      for (const vCol of videoCols) {
        if (row[vCol] && String(row[vCol]).length > 5) {
           bulkVid.push({
              _campId: campId, _creatorId: cId,
              link_video: String(row[vCol]).substring(0, 255),
              tanggal: new Date().toISOString().split('T')[0]
           });
        }
      }
    }
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
              urutan: 1
          });
      }
  }

  for (let i = 0; i < finalVid.length; i += 1000) {
     const b = finalVid.slice(i, i+1000);
     const {error} = await supabase.from('videos').insert(b);
     if (error) console.error("Vid Error:", error);
     else console.log(`Inserted Vid batch ${i}-${i+b.length}`);
  }

  console.log("✅ Videos Fix Completed!");
}

fixVideos().catch(console.error);
