import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const dataPath = path.join(__dirname, '../../');
const fileListing = path.join(dataPath, 'Database_Listing TNT.xlsx');

function normalizeUsername(str: string) {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizePhone(str: string) {
  if (!str) return '';
  let cleaned = str.toString().replace(/\D/g, '');
  if (cleaned.startsWith('08')) {
    cleaned = '62' + cleaned.substring(1);
  }
  return cleaned;
}

function normalizeLink(str: string) {
  if (!str) return '';
  let cleaned = str.toString().toLowerCase().trim();
  // Try to extract just the username part from standard tiktok/ig links
  try {
    const url = new URL(cleaned.startsWith('http') ? cleaned : `https://${cleaned}`);
    return url.pathname.replace(/\/$/, ''); // e.g. /@username
  } catch (e) {
    return cleaned;
  }
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

async function runAudit() {
  console.log("🕵️ Starting Audit...");
  
  const listingWb = XLSX.readFile(fileListing);
  const excludedSheets = ['TEMPLATE SALES', 'TEMPLATE AWARENESS', 'POOL DATABASE', 'LAGI TESTING', 'RAW_organic', 'TEST', 'Database Beauty'];
  const brandNames = listingWb.SheetNames.filter(s => !excludedSheets.includes(s));
  
  const phoneToUsernames = new Map<string, Set<string>>();
  const linkToUsernames = new Map<string, Set<string>>();
  const rawDataStore = new Map<string, any[]>(); // normalized username -> array of raw records
  
  for (const sheetName of brandNames) {
    const sheet = listingWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const headerIdx = findHeaderRow(data, ['username']);
    if (headerIdx === -1) continue;
    
    const headers = data[headerIdx].map((h:any) => String(h||'').trim().toLowerCase());
    const userIdx = headers.findIndex((h:any) => h?.includes('username'));
    const linkIdx = headers.findIndex((h:any) => h?.includes('link account'));
    const phoneIdx = headers.findIndex((h:any) => h?.includes('whatsapp') || h?.includes('wa'));
    
    if (userIdx === -1) continue;

    for (let i = headerIdx + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[userIdx]) continue;
      
      const rawUser = String(row[userIdx]).trim();
      const normUser = normalizeUsername(rawUser);
      if (!normUser || normUser === 'username' || normUser.length < 3) continue;

      if (!rawDataStore.has(normUser)) {
        rawDataStore.set(normUser, []);
      }
      rawDataStore.get(normUser)!.push({
        rawUser,
        phone: row[phoneIdx],
        link: row[linkIdx],
        sheet: sheetName
      });

      // Process Phone
      if (phoneIdx !== -1 && row[phoneIdx]) {
        const normPhone = normalizePhone(row[phoneIdx]);
        if (normPhone && normPhone.length > 8) {
          if (!phoneToUsernames.has(normPhone)) phoneToUsernames.set(normPhone, new Set());
          phoneToUsernames.get(normPhone)!.add(normUser);
        }
      }

      // Process Link
      if (linkIdx !== -1 && row[linkIdx]) {
        const normLink = normalizeLink(row[linkIdx]);
        if (normLink && normLink.length > 5) {
          if (!linkToUsernames.has(normLink)) linkToUsernames.set(normLink, new Set());
          linkToUsernames.get(normLink)!.add(normUser);
        }
      }
    }
  }

  // Find suspicious duplicates
  const suspiciousPhones = Array.from(phoneToUsernames.entries()).filter(([phone, users]) => users.size > 1);
  const suspiciousLinks = Array.from(linkToUsernames.entries()).filter(([link, users]) => users.size > 1);

  let report = "=== AUDIT REPORT ===\n\n";
  
  report += `🔍 Found ${suspiciousPhones.length} Phone Numbers shared by MULTIPLE different normalized usernames.\n`;
  suspiciousPhones.slice(0, 50).forEach(([phone, users]) => {
    report += `\n📱 Phone: ${phone}\n`;
    users.forEach(u => {
      const records = rawDataStore.get(u) || [];
      const sample = records[0];
      report += `   -> Username: ${u} (Raw in excel: ${sample.rawUser} in tab ${sample.sheet})\n`;
    });
  });

  if (suspiciousPhones.length > 50) report += `\n... and ${suspiciousPhones.length - 50} more phone conflicts.\n`;

  report += `\n\n🔍 Found ${suspiciousLinks.length} Links shared by MULTIPLE different normalized usernames.\n`;
  suspiciousLinks.slice(0, 50).forEach(([link, users]) => {
    report += `\n🔗 Link: ${link}\n`;
    users.forEach(u => {
      const records = rawDataStore.get(u) || [];
      const sample = records[0];
      report += `   -> Username: ${u} (Raw in excel: ${sample.rawUser} in tab ${sample.sheet})\n`;
    });
  });

  fs.writeFileSync(path.join(__dirname, 'audit_report.txt'), report);
  console.log("✅ Audit completed. Report saved to audit_report.txt");
}

runAudit().catch(console.error);
