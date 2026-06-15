const xlsx = require('xlsx');
const workbook = xlsx.readFile('../TNT Project Tracking (Internal).xlsx');
const sheet = workbook.Sheets['OMG SKINCARE'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

for(let i=19; i<=21; i++) {
  console.log(`Row ${i}:`);
  for(let c=0; c<data[i].length; c++) {
    if(data[i][c]) console.log(`  Col ${c}: ${data[i][c]}`);
  }
}
