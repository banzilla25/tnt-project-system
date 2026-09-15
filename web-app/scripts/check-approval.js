const xlsx = require('xlsx');
const workbook = xlsx.readFile('D:/Project-Tracking-System/Database_Listing TNT.xlsx');
const worksheet = workbook.Sheets['QAHIRA'];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });

let headerRowIndex = -1;
for (let i = 0; i < data.length; i++) {
  if (data[i].includes('Username')) {
    headerRowIndex = i;
    break;
  }
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

const approvals = new Set(parsedData.map(r => r.Approval));
console.log("Unique Approval values:", Array.from(approvals));
