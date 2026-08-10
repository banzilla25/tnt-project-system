const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const parseTikTokDate = (dateStr) => {
  if (!dateStr) return new Date('1970-01-01T00:00:00Z').toISOString();
  try {
    let str = dateStr.trim();
    if (str.includes('-') && str.length > 15) {
      const match = str.match(/^(\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2}:\d{2})?)/);
      if (match) str = match[1];
    }
    if (str.includes('/')) {
      const parts = str.split(' ');
      const dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        let year = dateParts[2];
        let p1 = parseInt(dateParts[1]);
        let p0 = parseInt(dateParts[0]);
        let month = p1;
        let day = p0;
        if (p0 > 12) { month = p1; day = p0; }
        else if (p1 > 12) { month = p0; day = p1; }
        if (year.length === 2) year = '20' + year;
        str = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${parts[1] || '00:00:00'}`;
      }
    }
    str = str.replace(' ', 'T');
    if (str.includes('T')) {
      const timeParts = str.split('T')[1].split(':');
      if (timeParts.length === 2) str += ':00';
      if (!str.endsWith('Z') && !str.includes('+')) str += '.000Z';
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
    
    const fallback = new Date(str.substring(0, 10));
    if (!isNaN(fallback.getTime())) return fallback.toISOString();

    return new Date('1970-01-01T00:00:00Z').toISOString();
  } catch (err) {
    return new Date('1970-01-01T00:00:00Z').toISOString();
  }
};

async function run() {
  console.log("Starting DB migration for sales...");
  let start = 0;
  const limit = 1000;
  let totalUpdated = 0;

  while (true) {
    const { data, error } = await supabase
      .from('sales')
      .select('id, raw_data, price, quantity')
      .not('raw_data', 'is', null)
      .range(start, start + limit - 1);
      
    if (error) {
      console.error("Error fetching:", error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    const updates = [];
    
    for (const row of data) {
      const raw = row.raw_data || {};
      
      // Fix Date
      const timeCreatedAlias = raw['Time Created'] || raw['Time created'] || raw['time created'] || raw['Created Time'] || raw['Waktu Pesanan'] || raw['waktu pesanan'];
      let newTanggal = null;
      if (timeCreatedAlias) {
         newTanggal = parseTikTokDate(timeCreatedAlias.toString());
      }
      
      // Fix GMV
      const baseCommissionStr = raw['Est. base commission'] || raw['Commission base'] || raw['Base Commission'] || raw['est. base commission'] || raw['commission base'];
      let newGmv = 0;
      
      if (baseCommissionStr !== undefined && baseCommissionStr !== '') {
         newGmv = Math.round(parseFloat(baseCommissionStr.toString().replace(/[^0-9.-]+/g, "")));
      } else {
         newGmv = Math.round((row.price || 0) * (row.quantity || 0));
      }
      
      let updatePayload = { gmv: newGmv };
      if (newTanggal) {
         updatePayload.tanggal = newTanggal;
      }
      
      updates.push({ id: row.id, ...updatePayload });
    }
    
    // Update sequentially or in batches (Supabase does not have bulk update, we upsert by id)
    // Actually we can use upsert if we select everything, but let's just do Promise.all chunks of 50
    for (let i = 0; i < updates.length; i += 50) {
       const chunk = updates.slice(i, i + 50);
       await Promise.all(chunk.map(u => 
          supabase.from('sales').update({ gmv: u.gmv, tanggal: u.tanggal }).eq('id', u.id)
       ));
    }
    
    totalUpdated += data.length;
    console.log(`Processed ${totalUpdated} rows...`);
    start += limit;
  }
  
  console.log(`Done! Total rows updated: ${totalUpdated}`);
}

run();
