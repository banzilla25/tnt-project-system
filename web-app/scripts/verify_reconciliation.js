require('dotenv').config({ path: '.env.local' });
const xlsx = require('xlsx');

function normalizeStr(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeaderRow(data, keywords) {
  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const rowStr = row.map(c => String(c).toLowerCase()).join(' ');
    if (keywords.every(k => rowStr.includes(k.toLowerCase()))) {
      return i;
    }
  }
  return -1;
}

function run() {
  console.log('Loading Listing Data...');
  const listingWb = xlsx.readFile('../Database_Listing TNT.xlsx');
  
  console.log('Loading Tracking Data...');
  const trackingWb = xlsx.readFile('../TNT Project Tracking (Internal).xlsx');

  const excludedSheets = ['TEMPLATE SALES', 'TEMPLATE AWARENESS', 'POOL DATABASE', 'LAGI TESTING', 'RAW_organic', 'TEST', 'Database Beauty', 'Maindata', 'Daily Performance', 'DATABASE', 'SKU', 'NO KONTRAK'];
  
  const listingSheets = listingWb.SheetNames.filter(s => !excludedSheets.includes(s));

  let totalDiscrepancies = 0;

  for (const sheetName of listingSheets) {
    // 1. Get Approved Creators from Listing
    const listSheet = listingWb.Sheets[sheetName];
    const listData = xlsx.utils.sheet_to_json(listSheet, { header: 1 });
    const listHeaderIdx = findHeaderRow(listData, ['username']);
    
    if (listHeaderIdx === -1) {
      console.log(`[SKIP] No header in Listing for ${sheetName}`);
      continue;
    }

    const listHeaders = listData[listHeaderIdx].map(h => String(h||'').trim().toLowerCase());
    const listUserIdx = listHeaders.findIndex(h => h.includes('username'));
    const listApprIdx = listHeaders.findIndex(h => h.includes('approval'));

    const approvedInListing = new Set();
    
    for (let i = listHeaderIdx + 1; i < listData.length; i++) {
      const row = listData[i];
      if (!row || !row[listUserIdx]) continue;
      
      const rawUser = String(row[listUserIdx]).trim().replace('@', '');
      const normUser = normalizeStr(rawUser);
      
      let approvalStatus = listApprIdx !== -1 ? String(row[listApprIdx] || '').toLowerCase().trim() : 'pending';
      if (approvalStatus === 'approved' || approvalStatus === 'approve') {
        approvedInListing.add(normUser);
      }
    }

    // 2. Get Tracked Creators from Tracking
    let trackSheetName = null;
    for (const tName of trackingWb.SheetNames) {
      if (normalizeStr(tName) === normalizeStr(sheetName)) {
        trackSheetName = tName;
        break;
      }
    }

    if (!trackSheetName && sheetName === 'Salsa Cosmetics') trackSheetName = 'SALSA COSME';
    if (!trackSheetName && sheetName === 'Salsa Mom & Baby') trackSheetName = 'SALSA M&B';

    if (!trackSheetName || !trackingWb.Sheets[trackSheetName]) {
      // console.log(`[WARN] No Tracking sheet found for Listing sheet: ${sheetName}`);
      continue;
    }

    const trackSheet = trackingWb.Sheets[trackSheetName];
    const trackData = xlsx.utils.sheet_to_json(trackSheet, { header: 1 });
    const trackHeaderIdx = findHeaderRow(trackData, ['username']);

    if (trackHeaderIdx === -1) continue;

    const trackHeaders = trackData[trackHeaderIdx].map(h => String(h||'').trim().toLowerCase());
    const trackUserIdx = trackHeaders.findIndex(h => h.includes('username'));

    const trackedUsers = new Set();
    for (let i = trackHeaderIdx + 1; i < trackData.length; i++) {
      const row = trackData[i];
      if (!row || !row[trackUserIdx]) continue;
      const rawUser = String(row[trackUserIdx]).trim().replace('@', '');
      const normUser = normalizeStr(rawUser);
      if (normUser.length > 2 && normUser !== 'username') {
        trackedUsers.add(normUser);
      }
    }

    // 3. Compare
    let missingInTracking = [];
    let trackedButNotApproved = [];

    for (const u of approvedInListing) {
      if (!trackedUsers.has(u)) {
        missingInTracking.push(u);
      }
    }

    for (const u of trackedUsers) {
      if (!approvedInListing.has(u)) {
        trackedButNotApproved.push(u);
      }
    }

    console.log(`\n--- ${sheetName} ---`);
    console.log(`Approved in Listing: ${approvedInListing.size}`);
    console.log(`Tracked in Tracking: ${trackedUsers.size}`);
    
    if (missingInTracking.length > 0) {
      console.log(`❌ Approved but MISSING in Tracking (${missingInTracking.length}):`, missingInTracking.slice(0, 5).join(', ') + (missingInTracking.length > 5 ? '...' : ''));
      totalDiscrepancies++;
    }
    if (trackedButNotApproved.length > 0) {
      console.log(`⚠️ Tracked but NOT APPROVED in Listing (${trackedButNotApproved.length}):`, trackedButNotApproved.slice(0, 5).join(', ') + (trackedButNotApproved.length > 5 ? '...' : ''));
    }
    
    if (missingInTracking.length === 0 && trackedButNotApproved.length === 0) {
      console.log(`✅ Perfectly Matched!`);
    }
  }

  console.log(`\nReconciliation Complete. Found ${totalDiscrepancies} brands with missing approved creators.`);
}

run();
