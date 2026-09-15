const XLSX = require('xlsx');

const filePath = 'C:\\Users\\Hibban\\Downloads\\OMG Store affiliate organik maret-agustus.xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet);

const OMG_MAKEUP_SKUS = ['1729615507258049939', '1730259561940878739', '1732063036417148307', '1734425894899516819', '1734425681374184851', '1729572933903878547', '1734425966429635987', '1734425714136941971', '1730312902114117011', '1732464769691452819'];

let oldKeyDupes = 0;
let newKeyDupes = 0;

const oldKeySet = new Set();
const newKeySet = new Set();

let totalGMV = 0;
let newUniqueGMV = 0;

for (const row of data) {
  const productId = (row['Product ID'] || '').toString().trim();
  if (!OMG_MAKEUP_SKUS.includes(productId)) continue;
  
  const gmv = parseFloat((row['Est. base commission'] || '0').toString().replace(/[^0-9.-]+/g, '')) || 0;
  totalGMV += gmv;

  const orderIdRaw = (row['Order ID'] || '').toString().trim();
  const skuIdStr = (row['SKU ID'] || '').toString().trim();
  const creatorUsername = (row['Creator Username'] || '').toString().replace('@', '').toLowerCase().trim();
  const partnerCampaignId = (row['Partner campaign ID'] || '').toString().trim();
  
  // CURRENT SYSTEM KEY
  const oldKey = `${orderIdRaw}_${skuIdStr}_${creatorUsername}_${productId}`;
  if (oldKeySet.has(oldKey)) {
    oldKeyDupes++;
  } else {
    oldKeySet.add(oldKey);
  }
  
  // NEW USER REQUESTED KEY
  const newKey = `${orderIdRaw}_${skuIdStr}_${productId}_${partnerCampaignId}`;
  if (newKeySet.has(newKey)) {
    newKeyDupes++;
  } else {
    newKeySet.add(newKey);
    newUniqueGMV += gmv;
  }
}

console.log(`=== PERBANDINGAN COMPOSITE KEY ===`);
console.log(`Total GMV Mentah (pivot table): Rp ${totalGMV.toLocaleString('id-ID')}`);
console.log(`Duplikat pakai Kunci Lama (Order_SKU_Creator_Product): ${oldKeyDupes}`);
console.log(`Duplikat pakai Kunci Baru (Order_SKU_Product_Campaign): ${newKeyDupes}`);
console.log(`Total GMV Kunci Baru: Rp ${newUniqueGMV.toLocaleString('id-ID')}`);
