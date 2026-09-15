const xlsx = require('xlsx');
const workbook = xlsx.readFile('D:/Project-Tracking-System/Database_Listing TNT.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
// Use header: 1 to get an array of arrays
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });

// Find the row that contains 'Username'
let headerRowIndex = -1;
for (let i = 0; i < data.length; i++) {
  if (data[i].includes('Username')) {
    headerRowIndex = i;
    break;
  }
}

if (headerRowIndex === -1) {
  console.log("Could not find header row");
  process.exit(1);
}

const headers = data[headerRowIndex];
const rows = data.slice(headerRowIndex + 1);

const parsedData = rows.map(row => {
  let obj = {};
  headers.forEach((h, i) => {
    if (h) {
      obj[h.trim()] = row[i];
    }
  });
  return obj;
}).filter(r => r.Username); // Only keep rows with Username

console.log(`Found ${parsedData.length} valid rows.`);
console.log("Sample row:", JSON.stringify(parsedData[0], null, 2));

