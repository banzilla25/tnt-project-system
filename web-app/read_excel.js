const XLSX = require('xlsx');
const fs = require('fs');

const filePath = 'D:\\Project-Tracking-System\\ADS External.xlsx';
const workbook = XLSX.readFile(filePath);

console.log('Sheets:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    // Print first 20 rows
    data.slice(0, 20).forEach(row => {
        console.log(row.join(' | '));
    });
});
