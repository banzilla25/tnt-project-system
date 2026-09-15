const xlsx = require('xlsx');

function analyzeFiles() {
  try {
    const file1 = 'D:\\Project-Tracking-System\\SYB 06_05_2026 - 18_06_2026.xlsx';
    const file2 = 'D:\\Project-Tracking-System\\SYB 06_05_2026 - 12_06_2026.xlsx';

    const wb1 = xlsx.readFile(file1);
    const ws1 = wb1.Sheets[wb1.SheetNames[0]];
    const data1 = xlsx.utils.sheet_to_json(ws1);

    const wb2 = xlsx.readFile(file2);
    const ws2 = wb2.Sheets[wb2.SheetNames[0]];
    const data2 = xlsx.utils.sheet_to_json(ws2);

    const orders1 = data1.map(r => r['Order ID']).filter(Boolean);
    const orders2 = data2.map(r => r['Order ID']).filter(Boolean);

    const set1 = new Set(orders1);
    const set2 = new Set(orders2);

    let duplicates = 0;
    for (let order of orders2) {
      if (set1.has(order)) {
        duplicates++;
      }
    }

    let gmv1 = data1.reduce((sum, r) => {
      if (r['Fully returned or refunded']?.toLowerCase() === 'yes') return sum;
      let price = parseFloat(r['Price']) || 0;
      let qty = parseInt(r['Quantity']) || 0;
      return sum + (price * qty);
    }, 0);

    let gmv2 = data2.reduce((sum, r) => {
      if (r['Fully returned or refunded']?.toLowerCase() === 'yes') return sum;
      let price = parseFloat(r['Price']) || 0;
      let qty = parseInt(r['Quantity']) || 0;
      return sum + (price * qty);
    }, 0);

    console.log(`File 1 (6 Mei - 18 Jun) orders: ${orders1.length}, Total GMV: Rp ${gmv1.toLocaleString('id-ID')}`);
    console.log(`File 2 (6 Mei - 12 Jun) orders: ${orders2.length}, Total GMV: Rp ${gmv2.toLocaleString('id-ID')}`);
    console.log(`Overlap Order IDs (Muncul di kedua file): ${duplicates}`);
    
    // Test logic Upsert
    const finalDatabase = new Map();
    data2.forEach(r => {
      if(r['Order ID']) finalDatabase.set(r['Order ID'], r);
    });
    console.log(`Database Size after upload File 2: ${finalDatabase.size} orders`);
    
    data1.forEach(r => {
      if(r['Order ID']) finalDatabase.set(r['Order ID'], r); // Simulates Upsert
    });
    
    let finalGmv = Array.from(finalDatabase.values()).reduce((sum, r) => {
       if (r['Fully returned or refunded']?.toLowerCase() === 'yes') return sum;
       let price = parseFloat(r['Price']) || 0;
       let qty = parseInt(r['Quantity']) || 0;
       return sum + (price * qty);
    }, 0);
    
    console.log(`Database Size after upload File 1 (Upsert applied): ${finalDatabase.size} orders`);
    console.log(`Final Database GMV: Rp ${finalGmv.toLocaleString('id-ID')}`);
    
  } catch(e) {
    console.error(e);
  }
}

analyzeFiles();
