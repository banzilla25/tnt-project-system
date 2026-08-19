const XLSX = require('xlsx');

const filePath = 'C:\\Users\\Hibban\\Downloads\\OMG Store affiliate organik maret-agustus.xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet);

const OMG_MAKEUP_SKUS = ['1729615507258049939', '1730259561940878739', '1732063036417148307', '1734425894899516819', '1734425681374184851', '1729572933903878547', '1734425966429635987', '1734425714136941971', '1730312902114117011', '1732464769691452819'];

// Group by constructed order_id
const groups = new Map();

for (const row of data) {
  const productId = (row['Product ID'] || '').toString().trim();
  if (!OMG_MAKEUP_SKUS.includes(productId)) continue;
  
  const orderIdRaw = (row['Order ID'] || '').toString().trim();
  const skuIdStr = (row['SKU ID'] || '').toString().trim();
  const rawUsername = (row['Creator Username'] || '').toString().trim();
  const creatorUsername = rawUsername.replace('@', '').toLowerCase();
  const constructedOrderId = `${orderIdRaw}_${skuIdStr}_${creatorUsername}_${productId}`;
  
  if (!groups.has(constructedOrderId)) groups.set(constructedOrderId, []);
  groups.get(constructedOrderId).push({
    orderIdRaw,
    skuIdStr,
    productId,
    productName: (row['Product Name'] || '').toString().substring(0, 40),
    creator: creatorUsername,
    quantity: row['Quantity'],
    price: row['Price'],
    estBase: row['Est. base commission'],
    commGmv: row['Commission GMV'],
    refund: row['Fully returned or refunded'],
    timeCreated: row['Time Created'],
    contentType: row['Content Type'],
    contentId: (row['Content ID'] || '').toString().trim(),
  });
}

// Show duplicates
let dupeGroups = 0;
let totalDupeRows = 0;
let shown = 0;

for (const [oid, rows] of groups) {
  if (rows.length > 1) {
    dupeGroups++;
    totalDupeRows += rows.length - 1;
    
    if (shown < 10) {
      console.log(`\n=== DUPLIKAT #${dupeGroups}: ${oid} (${rows.length} rows) ===`);
      rows.forEach((r, i) => {
        console.log(`  Row ${i+1}: Qty=${r.quantity} | Price=${r.price} | EstBase=${r.estBase} | CommGMV=${r.commGmv} | SKU=${r.skuIdStr} | Product=${r.productId} | Content=${r.contentType}/${r.contentId} | Time=${r.timeCreated} | Refund=${r.refund}`);
      });
      
      // Check what's different
      const diffs = [];
      const first = rows[0];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.quantity !== first.quantity) diffs.push('quantity');
        if (r.price !== first.price) diffs.push('price');
        if (r.estBase !== first.estBase) diffs.push('estBase');
        if (r.productId !== first.productId) diffs.push('productId');
        if (r.skuIdStr !== first.skuIdStr) diffs.push('skuIdStr');
        if (r.contentId !== first.contentId) diffs.push('contentId');
        if (r.timeCreated !== first.timeCreated) diffs.push('timeCreated');
      }
      console.log(`  Perbedaan: ${diffs.length > 0 ? [...new Set(diffs)].join(', ') : 'IDENTIK SEMUA'}`);
      shown++;
    }
  }
}

console.log(`\n=== RINGKASAN ===`);
console.log(`Total grup duplikat: ${dupeGroups}`);
console.log(`Total row duplikat (extra): ${totalDupeRows}`);
