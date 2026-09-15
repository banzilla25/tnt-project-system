const xlsx = require('xlsx');

const filePath = "D:\\Project-Tracking-System\\Database_Listing TNT.xlsx";
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

const brands = new Set();
data.forEach(row => {
  if (row['Brand/Campaign']) brands.add(row['Brand/Campaign']);
});
console.log(Array.from(brands));
