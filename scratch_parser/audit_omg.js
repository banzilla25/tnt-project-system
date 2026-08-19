const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const filePath = 'C:\\Users\\Hibban\\Downloads\\20 mei - 19 agustus affiliate_orders_7675519517926049557.xlsx';

try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const data = xlsx.utils.sheet_to_json(sheet);
  console.log(`Data loaded: ${data.length} rows`);
  
  if (data.length > 0) {
    const monthlyGmv = {};
    const monthlyCreators = {};
    const monthlyVideos = {};
    const monthlyLiveSessions = {};
    
    data.forEach(row => {
      let dateStr = row['Time Created'];
      if (!dateStr) return;
      
      const parts = dateStr.split(' ');
      const dateParts = parts[0].split('/');
      if (dateParts.length !== 3) return;
      
      const monthStr = `${dateParts[2]}-${dateParts[1]}`;
      
      const allowedProductIds = [
        '1729615507258049939',
        '1730259561940878739',
        '1732063036417148307',
        '1734425894899516819',
        '1734425681374184851',
        '1729572933903878547',
        '1734425966429635987',
        '1734425714136941971',
        '1730312902114117011',
        '1732464769691452819'
      ];
      
      const productId = String(row['Product ID']);
      if (!allowedProductIds.includes(productId)) {
        return; // Skip if not an OMG Makeup product
      }
      
      if (monthlyGmv[monthStr] === undefined) {
        monthlyGmv[monthStr] = 0;
        monthlyCreators[monthStr] = new Set();
        monthlyVideos[monthStr] = new Set();
        monthlyLiveSessions[monthStr] = new Set();
      }
      
      let gmvStr = String(row['Commission GMV'] || '0').replace(/,/g, '').replace(/[^0-9.]/g, '');
      monthlyGmv[monthStr] += parseFloat(gmvStr) || 0;
      
      const creator = row['Creator Username'];
      if (creator) {
        monthlyCreators[monthStr].add(creator);
      }
      
      const cType = row['Content Type'];
      const cId = row['Content ID'];
      if (cId) {
        if (cType === 'Video') {
          monthlyVideos[monthStr].add(cId);
        } else if (cType === 'Live' || cType === 'Livestream') {
          monthlyLiveSessions[monthStr].add(cId);
        }
      }
    });
    
    console.log("\n--- MONTHLY SUMMARY (OMG MAKEUP PRODUCTS ONLY) ---");
    Object.keys(monthlyGmv).sort().forEach(m => {
      console.log(`Month: ${m}`);
      console.log(`  GMV: Rp ${monthlyGmv[m].toLocaleString()}`);
      console.log(`  Creators: ${monthlyCreators[m].size}`);
      console.log(`  Videos: ${monthlyVideos[m].size}`);
      console.log(`  Live Sessions: ${monthlyLiveSessions[m].size}`);
    });
  }
} catch (e) {
  console.error("Error:", e);
}
