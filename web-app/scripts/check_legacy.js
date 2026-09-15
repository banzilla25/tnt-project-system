const xlsx = require('xlsx');

const filePath = "D:\\Project-Tracking-System\\Database_Listing TNT.xlsx";
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

const wardahRows = data.filter(row => String(row['Brand/Campaign'] || '').toLowerCase().includes('wardah'));
console.log(`Found ${wardahRows.length} rows for Wardah.`);
if (wardahRows.length > 0) {
  console.log(wardahRows.slice(0, 3));
}
