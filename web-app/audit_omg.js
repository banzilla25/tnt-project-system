const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const filePath = 'C:\\Users\\Hibban\\Downloads\\OMG Store affiliate organik maret-agustus.xlsx';
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);

  const OMG_MAKEUP_SKUS = ['1729615507258049939', '1730259561940878739', '1732063036417148307', '1734425894899516819', '1734425681374184851', '1729572933903878547', '1734425966429635987', '1734425714136941971', '1730312902114117011', '1732464769691452819'];

  // Simulate order_id construction (same as OrganicImport.tsx line 421)
  const orderIds = new Map(); // order_id -> row data
  let dupeCount = 0;
  let dupeGmv = 0;
  let totalRows = 0;
  let totalGmv = 0;

  for (const row of data) {
    const productId = (row['Product ID'] || '').toString().trim();
    if (!OMG_MAKEUP_SKUS.includes(productId)) continue;
    
    const isRefund = row['Fully returned or refunded'] === 'Yes';
    const gmv = parseFloat((row['Est. base commission'] || '0').toString().replace(/[^0-9.-]+/g, '')) || 0;
    const orderIdRaw = (row['Order ID'] || '').toString().trim();
    const skuIdStr = (row['SKU ID'] || '').toString().trim();
    const rawUsername = (row['Creator Username'] || '').toString().trim();
    const creatorUsername = rawUsername.replace('@', '').toLowerCase();
    
    // This is how OrganicImport.tsx constructs the order_id
    const constructedOrderId = `${orderIdRaw}_${skuIdStr}_${creatorUsername}_${productId}`;
    
    totalRows++;
    totalGmv += gmv;
    
    if (orderIds.has(constructedOrderId)) {
      dupeCount++;
      dupeGmv += gmv;
      // console.log(`DUPE: ${constructedOrderId} | GMV: ${gmv}`);
    } else {
      orderIds.set(constructedOrderId, { gmv, isRefund });
    }
  }

  let uniqueGmv = 0;
  let uniqueGmvExclRefund = 0;
  orderIds.forEach(v => {
    uniqueGmv += v.gmv;
    if (!v.isRefund) uniqueGmvExclRefund += v.gmv;
  });

  console.log(`=== ANALISIS DUPLIKAT ORDER_ID ===`);
  console.log(`Total rows OMG Makeup di Excel: ${totalRows}`);
  console.log(`Total GMV (Est. base commission): Rp ${totalGmv.toLocaleString('id-ID')}`);
  console.log(`Unique order_ids: ${orderIds.size}`);
  console.log(`Duplikat rows: ${dupeCount}`);
  console.log(`GMV duplikat (hilang karena upsert): Rp ${dupeGmv.toLocaleString('id-ID')}`);
  console.log(`\nGMV unique only: Rp ${uniqueGmv.toLocaleString('id-ID')}`);
  console.log(`GMV unique excl refund: Rp ${uniqueGmvExclRefund.toLocaleString('id-ID')}`);
  console.log(`\nDB saat ini: 3.081 rows, GMV: Rp 117.576.402`);
  console.log(`Selisih rows: ${orderIds.size} - 3081 = ${orderIds.size - 3081}`);
}
run();
