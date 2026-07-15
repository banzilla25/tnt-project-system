require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('ads_performance')
    .select('ad_id, tanggal, id')
    .order('tanggal', { ascending: true });
  
  if (error) console.error(error);
  else {
    const map = {};
    let duplicates = 0;
    data.forEach(row => {
      const key = `${row.ad_id}_${row.tanggal}`;
      if (map[key]) {
        duplicates++;
      } else {
        map[key] = 1;
      }
    });
    console.log(`Total rows: ${data.length}`);
    console.log(`Duplicates: ${duplicates}`);
  }
}

check();
