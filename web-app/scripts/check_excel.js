const XLSX = require('xlsx');

const filePaths = [
    "C:\\Users\\Hibban\\Downloads\\ALL CAMPAIGN TNT affiliate_orders 2026\\JANUARI_affiliate_orders_7658679013448451860.xlsx",
    "C:\\Users\\Hibban\\Downloads\\ALL CAMPAIGN TNT affiliate_orders 2026\\JUNI_affiliate_orders_7658605194671605524_01-06-2026-06-07-2026.xlsx"
];

function checkExcel(filePath) {
    console.log(`\n--- Analyzing ${filePath} ---`);
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Find header row if it's not the first one. TikTok sometimes has some meta rows.
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(10, data.length); i++) {
            if (data[i] && data[i].includes("Content Type") || data[i].includes("Product Name") || data[i].includes("Campaign Name")) {
                headerRowIndex = i;
                break;
            }
        }
        
        const json = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
        if (json.length === 0) {
            console.log("No data found or headers not matched.");
            return;
        }

        const columns = Object.keys(json[0]);
        console.log("Columns:", columns);

        const contentTypes = new Set();
        const productNames = new Set();
        let pwsCount = 0;

        json.forEach(row => {
            const ct = row["Content Type"] || row["Tipe Konten"];
            if (ct) contentTypes.add(ct);
            
            const pn = row["Product Name"] || row["Nama Produk"];
            if (pn) {
                productNames.add(pn);
                if (pn.toLowerCase().includes("pws")) pwsCount++;
            }
        });

        console.log("Unique Content Types:", Array.from(contentTypes));
        console.log("Sample Products (first 5):", Array.from(productNames).slice(0, 5));
        console.log(`PWS in Product Name count: ${pwsCount}`);
        
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e.message);
    }
}

for (const p of filePaths) {
    checkExcel(p);
}
