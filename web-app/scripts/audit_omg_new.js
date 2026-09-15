const XLSX = require('xlsx');

const file1 = 'C:\\Users\\Hibban\\Downloads\\1 Maret - 31 Mei affiliate_orders_7675562803591333652.xlsx';
const file2 = 'C:\\Users\\Hibban\\Downloads\\20 mei - 19 agustus affiliate_orders_7675519517926049557.xlsx';

const OMG_MAKEUP_SKUS = [
  '1729615507258049939', '1730259561940878739', '1732063036417148307', 
  '1734425894899516819', '1734425681374184851', '1729572933903878547', 
  '1734425966429635987', '1734425714136941971', '1730312902114117011', 
  '1732464769691452819'
];

function processFiles(files) {
  let totalRawGmv = 0;
  let totalRawRows = 0;
  
  let dedupedGmv = 0;
  let dedupedRows = 0;
  const seenKeys = new Set();
  
  // To detect overlaps between the two files
  let overlapDupes = 0;
  
  for (const file of files) {
    console.log(`Membaca file: ${file.split('\\').pop()}...`);
    const workbook = XLSX.readFile(file);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    let fileRows = 0;
    
    for (const row of data) {
      const productId = (row['Product ID'] || '').toString().trim();
      
      // Filter hanya OMG Makeup
      if (!OMG_MAKEUP_SKUS.includes(productId)) continue;
      
      fileRows++;
      totalRawRows++;
      
      const gmv = parseFloat((row['Est. base commission'] || '0').toString().replace(/[^0-9.-]+/g, '')) || 0;
      totalRawGmv += gmv;
      
      // Bikin Composite Key sesuai aturan BARU
      const orderIdRaw = (row['Order ID'] || '').toString().trim();
      const skuIdStr = (row['SKU ID'] || '').toString().trim();
      const partnerCampaignId = (row['Partner campaign ID'] || '').toString().trim();
      
      const compositeKey = `${orderIdRaw}_${skuIdStr}_${productId}_${partnerCampaignId}`;
      
      if (!seenKeys.has(compositeKey)) {
        seenKeys.add(compositeKey);
        dedupedRows++;
        dedupedGmv += gmv;
      } else {
        overlapDupes++;
      }
    }
    console.log(` -> Ditemukan ${fileRows} baris OMG Makeup.`);
  }

  console.log(`\n================ HASIL ANALISIS ================`);
  console.log(`Total Baris (Mentah digabung): ${totalRawRows}`);
  console.log(`Total GMV Mentah (Jika di-Sum semua): Rp ${totalRawGmv.toLocaleString('id-ID')}`);
  console.log(`\nBaris Duplikat (Dibuang): ${overlapDupes} baris`);
  console.log(`(Duplikat ini bisa jadi karena irisan tanggal 20 Mei - 31 Mei, atau error duplikat TikTok)`);
  console.log(`\nTotal Baris Valid (Setelah Dedup): ${dedupedRows}`);
  console.log(`TOTAL GMV BERSIH (Valid di Sistem): Rp ${dedupedGmv.toLocaleString('id-ID')}`);
  console.log(`================================================`);
}

processFiles([file1, file2]);
