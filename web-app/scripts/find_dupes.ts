import * as XLSX from 'xlsx';
import path from 'path';

const dataPath = path.join(__dirname, '../../');
const fileListing = path.join(dataPath, 'Database_Listing TNT.xlsx');

function normalizeStr(str: string) { return str ? String(str).toLowerCase().replace(/[^a-z0-9]/g, '') : ''; }

function findDupesInSheet(sheetName: string) {
  const listingWb = XLSX.readFile(fileListing);
  const sheet = listingWb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  
  let headerIdx = data.findIndex(r => r && r.some((c:any) => String(c).toLowerCase().includes('username')));
  let headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
  let userIdx = headers.findIndex((h:any) => h && h.includes('username'));
  let priceIdx = headers.findIndex((h:any) => h && h.includes('price'));
  let gmvIdx = headers.findIndex((h:any) => h && h.includes('gmv'));

  const seen = new Set<string>();
  const dupes = [];

  for (let i = headerIdx + 1; i < data.length; i++) {
     const row = data[i];
     if (!row || !row[userIdx]) continue;
     const uname = normalizeStr(row[userIdx]);
     if (seen.has(uname)) {
         dupes.push({
             username: String(row[userIdx]),
             price: priceIdx !== -1 ? row[priceIdx] : null,
             gmv: gmvIdx !== -1 ? row[gmvIdx] : null
         });
     }
     seen.add(uname);
  }
  console.log(`\nDuplicates in ${sheetName}:`, dupes);
}

findDupesInSheet('ISWHITE');
findDupesInSheet('QAHIRA');
