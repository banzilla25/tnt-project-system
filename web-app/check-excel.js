const xlsx = require('xlsx');
const workbook = xlsx.readFile('TNT Project Tracking (Internal).xlsx');

const sheet = workbook.Sheets['OMG SKINCARE'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

for (let i = 0; i < Math.min(30, data.length); i++) {
  console.log(`Row ${i}:`, data[i]);
}
