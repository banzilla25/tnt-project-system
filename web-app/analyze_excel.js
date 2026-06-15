const XLSX = require('xlsx');
const workbook = XLSX.readFile('../Database_Listing TNT.xlsx');

const summary = {};

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  if (data.length > 0) {
    const headerRow = data[1] || data[0]; // Sometimes header is on 2nd row (index 1)
    summary[sheetName] = {
      rowCount: data.length,
      headers: headerRow ? headerRow.filter(h => h != null) : []
    };
  } else {
    summary[sheetName] = { rowCount: 0, headers: [] };
  }
});

const fs = require('fs');
fs.writeFileSync('excel_summary.json', JSON.stringify(summary, null, 2));
