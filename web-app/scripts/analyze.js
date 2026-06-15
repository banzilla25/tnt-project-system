const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const basePath = path.join(__dirname, '../../');
const files = [
  'Database_Listing TNT.xlsx',
  'TNT Campaign Budgeting.xlsx',
  'TNT Project Tracking (Internal).xlsx'
];

files.forEach(file => {
  const filePath = path.join(basePath, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${file}`);
    return;
  }
  
  console.log(`\n--- Analyzing File: ${file} ---`);
  const workbook = XLSX.readFile(filePath);
  console.log(`Sheet Names (${workbook.SheetNames.length}):`, workbook.SheetNames.join(', '));
  
  // Analyze structure of the first few sheets (or specific important sheets)
  const sheetsToAnalyze = workbook.SheetNames.slice(0, 3);
  
  sheetsToAnalyze.forEach(sheetName => {
    console.log(`\n  Sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length === 0) {
      console.log('    Empty sheet.');
      return;
    }
    
    // Find the header row (usually the first or second non-empty row)
    let headerRow = [];
    let rowIdx = 0;
    while(rowIdx < Math.min(5, data.length)) {
       if(data[rowIdx] && data[rowIdx].length > 2) {
           headerRow = data[rowIdx];
           break;
       }
       rowIdx++;
    }
    console.log(`    Headers (Row ${rowIdx + 1}):`, headerRow);
    console.log(`    Total Rows (approx): ${data.length}`);
  });
});
