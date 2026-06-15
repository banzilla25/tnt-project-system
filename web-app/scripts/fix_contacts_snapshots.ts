import * as XLSX from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fileListing = path.join(__dirname, '../../Database_Listing TNT.xlsx');

function normalizeStr(str: string) {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fixContactsAndSnapshots() {
  console.log("🚀 Starting Fast Contacts & Snapshots Migration...");

  console.log("Fetching existing creators from DB...");
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
  
  const bulkContacts = [];
  const bulkSnapshots = [];
  
  // Track seen to avoid duplicates in the same batch
  const seenContacts = new Set();

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
    const phoneIdx = headers.findIndex((h:any) => h?.includes('whatsapp') || h?.includes('wa'));
    const followerIdx = headers.findIndex((h:any) => h?.includes('followers'));
    const gmvIdx = headers.findIndex((h:any) => h?.includes('gmv'));
    const levelIdx = headers.findIndex((h:any) => h?.includes('level'));

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[userIdx]) continue;
      
      const cId = creatorMap.get(normalizeStr(row[userIdx]));
      if (!cId) continue;

      if (phoneIdx !== -1 && row[phoneIdx]) {
        let phone = String(row[phoneIdx]).replace(/\D/g, '');
        if (phone.length > 5) {
           const contactKey = `${cId}_${phone}`;
           if (!seenContacts.has(contactKey)) {
              seenContacts.add(contactKey);
              bulkContacts.push({
                 creator_id: cId,
                 nomor: phone,
                 status: 'aktif',
                 tanggal_mulai: new Date().toISOString().split('T')[0]
              });
           }
        }
      }

      if (followerIdx !== -1 && row[followerIdx]) {
         const f = parseInt(String(row[followerIdx]).replace(/\D/g, ''));
         if (!isNaN(f) && f > 0) {
            let lvl = 0;
            if (row[levelIdx]) {
                const match = String(row[levelIdx]).match(/\d+/);
                if (match) lvl = parseInt(match[0]);
            }
            bulkSnapshots.push({
               creator_id: cId,
               followers: f,
               level: lvl,
               gmv_30d: row[gmvIdx] ? parseInt(String(row[gmvIdx]).replace(/\D/g, '')) : 0,
               tanggal_update: new Date().toISOString().split('T')[0]
            });
         }
      }
    }
  }
  
  await supabase.from('creator_contacts').delete().neq('creator_id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('creator_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log(`Prepared ${bulkContacts.length} contacts, ${bulkSnapshots.length} snapshots. Inserting...`);
  
  for (let i = 0; i < bulkContacts.length; i += 1000) {
     const b = bulkContacts.slice(i, i+1000);
     const {error} = await supabase.from('creator_contacts').insert(b);
     if (error) console.error("Contact Error:", error);
     else console.log(`Inserted Contact batch ${i}-${i+b.length}`);
  }
  
  for (let i = 0; i < bulkSnapshots.length; i += 1000) {
     const b = bulkSnapshots.slice(i, i+1000);
     const {error} = await supabase.from('creator_snapshots').insert(b);
     if (error) console.error("Snapshot Error:", error);
     else console.log(`Inserted Snapshot batch ${i}-${i+b.length}`);
  }

  console.log("✅ Contacts & Snapshots Migration Completed!");
}

fixContactsAndSnapshots().catch(console.error);
