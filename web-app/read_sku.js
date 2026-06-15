const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('../TNT Project Tracking (Internal).xlsx');
const sheet = workbook.Sheets['SKU'];
if (!sheet) {
  console.log("Sheet SKU not found.");
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
const headers = rows[0];

const grouped = {};

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || !row[0]) continue;
  
  const campaign = String(row[0]).trim();
  const namaProduk = row[2];
  const productId = row[3];
  const comm = row[6];
  
  if (!grouped[campaign]) {
    grouped[campaign] = [];
  }
  
  grouped[campaign].push({
    nama_produk: namaProduk,
    product_id: productId,
    commission: comm
  });
}

fs.writeFileSync('sku_analysis.json', JSON.stringify(grouped, null, 2));
console.log("Wrote sku_analysis.json");
