const XLSX = require('xlsx');
const workbook = XLSX.readFile('../Database_Listing TNT.xlsx');
const sheet = workbook.Sheets['QAHIRA'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 1 });
for (let i = 0; i < 5; i++) console.log(data[i]);

