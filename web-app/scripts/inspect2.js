const xlsx = require('xlsx');
const workbook = xlsx.readFile('../TNT Project Tracking (Internal).xlsx');
const sheet = workbook.Sheets['OMG SKINCARE'];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

for(let i=10; i<=25; i++) {
  if (data[i] && data[i][1] && String(data[i][1]).includes('arnilawati')) {
    console.log(`Arnilawati is row ${i}:`);
    for(let c=0; c<data[i].length; c++) {
      if(data[i][c]) console.log(`  Col ${c}: ${data[i][c]}`);
    }
  }
}
