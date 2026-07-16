const xlsx = require('xlsx');

const filePath = 'D:\\Project-Tracking-System\\KIME_CustomReport_Campaign_Creator_Video_Product_Shop_Product Category 2026-01-16_2026-07-14 (1).xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

console.log('Total Rows:', data.length);
if (data.length > 0) {
  console.log('Columns:', Object.keys(data[0]));
}

const uniqueVideos = new Set();
data.forEach(row => {
  if (row['Video ID']) uniqueVideos.add(row['Video ID']);
  else if (row['Content ID']) uniqueVideos.add(row['Content ID']);
});
console.log('Unique Videos:', uniqueVideos.size);

// Sample first 2 rows
console.log('Sample Row 1:', data[0]);
console.log('Sample Row 2:', data[1]);
