const XLSX = require('xlsx');

const workbook = XLSX.readFile('../Database_Listing TNT.xlsx');
const sheets = [
  "OMG MAKEUP", "SALSA COSME", "WARDAH", "SALSA BABY CARE", "PWS",
  "NAISDAY", "DIOLY", "MSGLOWBEAUTY", "MSGLOWFORMEN", "SKINMOLOGY",
  "KIMME", "QAHIRA", "SYB", "ISWHITE"
];

sheets.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return;
  
  let headers = rows[0];
  let headerRowIndex = 0;
  
  // Find the row that contains "Tier" or "Username" or "Link Account"
  for (let i = 0; i < 5; i++) {
    if (!rows[i]) continue;
    const rowStr = rows[i].map(c => String(c).toLowerCase()).join(' ');
    if (rowStr.includes('username') || rowStr.includes('tier')) {
      headers = rows[i];
      headerRowIndex = i;
      break;
    }
  }

  const cleanHeaders = headers.map(h => String(h).trim().toLowerCase());
  
  // Count how many have username
  const uIdx = cleanHeaders.indexOf('username');
  let usernameCount = 0;
  let emptyUsernameCount = 0;
  
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    if (uIdx !== -1 && row[uIdx]) {
      usernameCount++;
    } else {
      emptyUsernameCount++;
    }
  }

  console.log(`\n--- ${sheetName} ---`);
  console.log(`Header is on row index: ${headerRowIndex}`);
  console.log("Headers:", cleanHeaders.filter(h => h && h !== 'undefined').join(', '));
  console.log(`Username column index: ${uIdx}`);
  console.log(`Rows with username: ${usernameCount}, Rows missing username: ${emptyUsernameCount}`);
});
