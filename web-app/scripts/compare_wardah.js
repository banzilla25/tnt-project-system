const xlsx = require('xlsx');

function getSalesFileGMV(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
  let totalGMV = 0;
  const creatorGmv = {};

  data.forEach(row => {
    // Di file Sales, bisa bernama 'Commission GMV' atau 'Affiliate video GMV' jika formatnya campur
    let gmv = 0;
    if (row['Commission GMV']) {
      gmv = parseFloat(row['Commission GMV']) || 0;
    } else if (row['Affiliate video GMV']) {
      const gmvStr = String(row['Affiliate video GMV']);
      gmv = parseFloat(gmvStr.replace(/[^0-9]/g, '')) || 0;
    }
    
    // Refunds
    const isRefundStr = row['Fully returned or refunded'] || 'No';
    if (isRefundStr.trim().toLowerCase() === 'yes') {
      gmv = 0; // Exclude refund
    }

    const creator = (row['Creator Username'] || row['Creator name'] || 'Unknown').replace('@', '').toLowerCase();

    totalGMV += gmv;
    if (!creatorGmv[creator]) creatorGmv[creator] = 0;
    creatorGmv[creator] += gmv;
  });

  return { totalGMV, creatorGmv };
}

function getLegacyGMV(campaignKeyword) {
  const filePath = "D:\\Project-Tracking-System\\Database_Listing TNT.xlsx";
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  
  let totalGMV = 0;
  const creatorGmv = {};

  data.forEach(row => {
    const brand = String(row['Brand/Campaign'] || '').toLowerCase();
    if (brand.includes(campaignKeyword.toLowerCase())) {
      let gmv = 0;
      const gmvVal = row['GMV Organic'];
      if (typeof gmvVal === 'number') {
        gmv = gmvVal;
      } else if (typeof gmvVal === 'string') {
        gmv = parseFloat(gmvVal.replace(/[^0-9]/g, '')) || 0;
      }
      
      const creator = String(row['Username'] || '').replace('https://www.tiktok.com/@', '').split('?')[0].toLowerCase();
      totalGMV += gmv;
      if (!creatorGmv[creator]) creatorGmv[creator] = 0;
      creatorGmv[creator] += gmv;
    }
  });

  return { totalGMV, creatorGmv };
}

console.log("=== COMPARING WARDAH ===");

const raw1 = getSalesFileGMV("D:\\Project-Tracking-System\\ORGANIC TNT 12 JUNI\\SALES\\WARDAH 02_03_2026 - 31_05_2026 .xlsx");
const raw2 = getSalesFileGMV("D:\\Project-Tracking-System\\ORGANIC TNT 12 JUNI\\SALES\\WARDAH 01_06_2026 - 12_060_2026.xlsx");

const totalRawGMV = raw1.totalGMV + raw2.totalGMV;
const rawCreators = {};
for (const [c, v] of Object.entries(raw1.creatorGmv)) { rawCreators[c] = (rawCreators[c] || 0) + v; }
for (const [c, v] of Object.entries(raw2.creatorGmv)) { rawCreators[c] = (rawCreators[c] || 0) + v; }

console.log(`Total GMV Raw (TikTok Export): Rp ${totalRawGMV.toLocaleString('id-ID')}`);

const legacy = getLegacyGMV("Wardah");
console.log(`Total GMV Legacy (Excel Database): Rp ${legacy.totalGMV.toLocaleString('id-ID')}`);

console.log("\n--- Top 5 Creators Diff ---");
const allCreators = new Set([...Object.keys(rawCreators), ...Object.keys(legacy.creatorGmv)]);

const diffs = [];
for (const c of allCreators) {
  const rGMV = rawCreators[c] || 0;
  const lGMV = legacy.creatorGmv[c] || 0;
  if (rGMV > 0 || lGMV > 0) {
    diffs.push({
      creator: c,
      rawGMV: rGMV,
      legacyGMV: lGMV,
      diff: Math.abs(rGMV - lGMV)
    });
  }
}

diffs.sort((a, b) => b.diff - a.diff);
console.table(diffs.slice(0, 10));
