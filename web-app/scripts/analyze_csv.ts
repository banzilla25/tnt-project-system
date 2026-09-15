import fs from 'fs';
import Papa from 'papaparse';

const analyzeFile = (filePath: string) => {
  console.log(`\nAnalyzing ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const results = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    delimiter: ";"
  });
  
  const data = results.data as any[];
  console.log(`Total rows: ${data.length}`);
  
  const orderIds = new Map<string, any[]>();
  
  data.forEach((row, idx) => {
    const oid = row['Order ID'];
    if (!oid) return;
    
    if (!orderIds.has(oid)) {
      orderIds.set(oid, []);
    }
    orderIds.get(oid)!.push({ idx: idx + 2, prod: row['Product Name'], gmv: row['Price'] });
  });
  
  let duplicateOids = 0;
  for (const [oid, rows] of orderIds.entries()) {
    if (rows.length > 1) {
      duplicateOids++;
      console.log(`\nDuplicate Order ID found: ${oid}`);
      rows.forEach(r => console.log(`  Row ${r.idx}: Product: ${r.prod.substring(0, 30)}... | Price: ${r.gmv}`));
    }
  }
  
  if (duplicateOids === 0) {
    console.log("No duplicate Order IDs found in this file.");
  } else {
    console.log(`\nFound ${duplicateOids} Order IDs that appear multiple times!`);
  }
};

analyzeFile("D:/Project-Tracking-System/QAHIRA 18_02_2026 - 18_05_2026.csv");
analyzeFile("D:/Project-Tracking-System/QAHIRA 19_05_2026 - 12_06_2026.csv");
