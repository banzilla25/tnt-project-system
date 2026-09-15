const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dirPath = "C:\\Users\\Hibban\\Downloads\\ALL CAMPAIGN TNT affiliate_orders 2026";

function checkExcel(filePath) {
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

        const contentTypes = new Set();
        let pwsCount = 0;
        let tntCount = 0;
        let totalRows = json.length;
        
        json.forEach(row => {
            const ct = row["Content Type"] || row["Tipe Konten"];
            if (ct) contentTypes.add(ct);
            
            const pn = row["Product Name"] || row["Nama Produk"];
            if (pn) {
                if (pn.toLowerCase().includes("pws")) pwsCount++;
                if (pn.toLowerCase().includes("tnt")) tntCount++;
            }
        });

        console.log(`\n📄 ${path.basename(filePath)}`);
        console.log(`   Total Rows: ${totalRows}`);
        console.log(`   Content Types: ${Array.from(contentTypes).join(', ')}`);
        console.log(`   Products with 'PWS': ${pwsCount}`);
        
    } catch (e) {
        console.error(`Error reading ${path.basename(filePath)}:`, e.message);
    }
}

fs.readdirSync(dirPath).forEach(file => {
    if (file.endsWith('.xlsx')) {
        checkExcel(path.join(dirPath, file));
    }
});
