const xlsx = require('xlsx');
const workbook = xlsx.readFile('D:/Project-Tracking-System/Database_Listing TNT.xlsx');
const worksheet = workbook.Sheets['QAHIRA'];
if (!worksheet) {
  console.log("QAHIRA sheet not found");
  process.exit(1);
}

const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });

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
}).filter(r => r.Username);

console.log(`Found ${parsedData.length} valid rows.`);
console.log("Sample row:", JSON.stringify(parsedData[0], null, 2));

// Filter only approved ones as requested by user? "kreator yang di approve berdasarkan brand"
const approved = parsedData.filter(r => r.Approval && r.Approval.toString().toLowerCase() === 'approved');
console.log(`Found ${approved.length} approved rows.`);
