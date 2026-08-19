const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Check registered SKUs for campaign 33
  const { data: skus } = await supabase.from('skus').select('product_id, nama_produk').eq('campaign_id', 33);
  console.log(`=== SKUs terdaftar di Campaign 33 ===`);
  console.log(`Jumlah SKU: ${skus.length}`);
  skus.forEach(s => console.log(`  ${s.product_id} - ${s.nama_produk}`));

  const registeredProductIds = skus.map(s => s.product_id);

  // 2. Check sales count and GMV in DB
  let allSales = [];
  let start = 0;
  while (true) {
    const { data } = await supabase.from('sales').select('gmv, product_id, creator_username, is_refund').eq('campaign_id', 33).range(start, start + 999);
    if (!data || data.length === 0) break;
    allSales = allSales.concat(data);
    if (data.length < 1000) break;
    start += 1000;
  }
  
  let dbGmvTotal = 0;
  let dbGmvExclRefund = 0;
  let dbGmvInSku = 0;
  let dbGmvNotInSku = 0;
  const dbProductIds = new Set();
  
  allSales.forEach(s => {
    dbGmvTotal += Number(s.gmv || 0);
    dbProductIds.add(s.product_id);
    if (!s.is_refund) {
      dbGmvExclRefund += Number(s.gmv || 0);
      if (registeredProductIds.includes(s.product_id)) {
        dbGmvInSku += Number(s.gmv || 0);
      } else {
        dbGmvNotInSku += Number(s.gmv || 0);
      }
    }
  });
  
  console.log(`\n=== Sales di DB (campaign_id=33) ===`);
  console.log(`Total rows: ${allSales.length}`);
  console.log(`GMV Total: Rp ${dbGmvTotal.toLocaleString('id-ID')}`);
  console.log(`GMV Excl Refund: Rp ${dbGmvExclRefund.toLocaleString('id-ID')}`);
  console.log(`GMV In Registered SKUs: Rp ${dbGmvInSku.toLocaleString('id-ID')}`);
  console.log(`GMV NOT In Registered SKUs: Rp ${dbGmvNotInSku.toLocaleString('id-ID')}`);
  
  // 3. Check which product_ids in DB are NOT in SKU table
  const unregistered = [...dbProductIds].filter(p => !registeredProductIds.includes(p));
  if (unregistered.length > 0) {
    console.log(`\n=== Product IDs di sales TAPI TIDAK terdaftar di SKU ===`);
    unregistered.forEach(p => {
      const rows = allSales.filter(s => s.product_id === p && !s.is_refund);
      const gmv = rows.reduce((sum, s) => sum + Number(s.gmv || 0), 0);
      console.log(`  ${p} - ${rows.length} rows - Rp ${gmv.toLocaleString('id-ID')}`);
    });
  }

  // 4. Compare with Excel
  const OMG_MAKEUP_SKUS = ['1729615507258049939', '1730259561940878739', '1732063036417148307', '1734425894899516819', '1734425681374184851', '1729572933903878547', '1734425966429635987', '1734425714136941971', '1730312902114117011', '1732464769691452819'];
  
  const filePath = 'C:\\Users\\Hibban\\Downloads\\OMG Store affiliate organik maret-agustus.xlsx';
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);

  let excelRows = 0;
  let excelGmv = 0;
  const excelProductIds = new Set();

  for (const row of data) {
    const productId = (row['Product ID'] || '').toString().trim();
    if (OMG_MAKEUP_SKUS.includes(productId)) {
      const isRefund = row['Fully returned or refunded'] === 'Yes';
      if (!isRefund) {
        const gmv = parseFloat((row['Est. base commission'] || '0').toString().replace(/[^0-9.-]+/g, '')) || 0;
        excelGmv += gmv;
        excelRows++;
        excelProductIds.add(productId);
      }
    }
  }

  console.log(`\n=== Excel OMG Makeup (Est. base commission, Excl Refund) ===`);
  console.log(`Rows: ${excelRows}`);
  console.log(`GMV: Rp ${excelGmv.toLocaleString('id-ID')}`);
  
  // 5. Check which Excel product IDs are registered vs not
  console.log(`\n=== Perbandingan Product IDs ===`);
  console.log(`Excel OMG Makeup SKUs: ${[...excelProductIds].join(', ')}`);
  console.log(`DB Registered SKUs: ${registeredProductIds.join(', ')}`);
  
  const missingFromDb = [...excelProductIds].filter(p => !registeredProductIds.includes(p));
  if (missingFromDb.length > 0) {
    console.log(`\n⚠️ SKU di Excel TAPI TIDAK terdaftar di DB:`);
    missingFromDb.forEach(p => console.log(`  ${p}`));
  }
  
  console.log(`\n=== RINGKASAN ===`);
  console.log(`Excel (April): Rp ${excelGmv.toLocaleString('id-ID')}`);
  console.log(`DB (Sistem):   Rp ${dbGmvInSku.toLocaleString('id-ID')}`);
  console.log(`Selisih:        Rp ${(excelGmv - dbGmvInSku).toLocaleString('id-ID')}`);
}

run();
