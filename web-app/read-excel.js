const xlsx = require('xlsx');
const workbook = xlsx.readFile('D:/Project-Tracking-System/Database_Listing TNT.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { defval: null });
console.log(JSON.stringify(data.slice(0, 5), null, 2));
console.log(`Total rows: ${data.length}`);
