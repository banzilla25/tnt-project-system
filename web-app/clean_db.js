require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function clean() {
  let from = 0;
  let allData = [];
  while(true) {
    const { data, error } = await supabase.from('ads_performance').select('id, ad_id, tanggal').range(from, from + 999);
    if (error) { console.error(error); return; }
    if (!data || data.length === 0) break;
    allData.push(...data);
    from += 1000;
  }
  
  const map = {};
  const toDelete = [];
  // Sort descending by ID so we keep the latest inserted row
  allData.sort((a, b) => b.id - a.id);
  
  allData.forEach(row => {
    const key = `${row.ad_id}_${row.tanggal}`;
    if (map[key]) {
      toDelete.push(row.id);
    } else {
      map[key] = true;
    }
  });
  
  if (toDelete.length > 0) {
    console.log(`Found ${toDelete.length} duplicates. Deleting...`);
    // Delete in chunks
    for (let i=0; i<toDelete.length; i+=100) {
      const chunk = toDelete.slice(i, i+100);
      await supabase.from('ads_performance').delete().in('id', chunk);
    }
    console.log('Duplicates removed!');
  } else {
    console.log('No duplicates found. Database is perfectly clean!');
  }
}

clean();
