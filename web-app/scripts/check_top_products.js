const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = "C:\\Users\\Hibban\\Downloads\\ALL CAMPAIGN TNT affiliate_orders 2026\\MEI_affiliate_orders_7658727705300223764.xlsx";

function getTopProducts(filePath) {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(10, data.length); i++) {
            if (data[i] && (data[i].includes("Content Type") || data[i].includes("Product Name") || data[i].includes("Campaign Name"))) {
                headerRowIndex = i;
                break;
            }
        }
        
        const json = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
        if (json.length === 0) return;

        const productCounts = {};
        
        json.forEach(row => {
            const pn = row["Product Name"] || row["Nama Produk"];
            if (pn) {
                productCounts[pn] = (productCounts[pn] || 0) + 1;
            }
        });

        console.log(`\nTop 10 Products in ${path.basename(filePath)}:`);
        Object.entries(productCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([name, count]) => {
                console.log(`- ${count} sales: ${name.substring(0, 80)}...`);
            });
        
    } catch (e) {
        console.error(`Error reading ${path.basename(filePath)}:`, e.message);
    }
}

getTopProducts(filePath);
