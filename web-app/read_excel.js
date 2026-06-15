const xlsx = require('xlsx');
const fs = require('fs');

function readExcel(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log(`--- File: ${filePath} ---`);
    console.log("Headers:");
    console.log(data[0]);
    console.log("Row 1:");
    console.log(data[1]);
    console.log("Row 2:");
    console.log(data[2]);
    console.log("\n");
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
}

readExcel("D:\\Project-Tracking-System\\ORGANIC TNT 12 JUNI\\AWARENESS\\PWS 07-05-2026 - 11-06-2026.xlsx");
