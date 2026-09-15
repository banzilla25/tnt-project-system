const xlsx = require('xlsx');

const filePath = 'D:/Project-Tracking-System/TNT Project Tracking (Internal).xlsx';
console.log(`Reading file: ${filePath}`);

const workbook = xlsx.readFile(filePath);
console.log('Available sheets:', workbook.SheetNames);

const sheetName = 'Daily Performance';
if (!workbook.SheetNames.includes(sheetName)) {
  console.log(`Sheet "${sheetName}" not found!`);
  process.exit(1);
}

const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { defval: null });

console.log(`Total rows in ${sheetName}:`, data.length);
console.log('First 5 rows:');
console.log(JSON.stringify(data.slice(0, 5), null, 2));

process.exit(0);
