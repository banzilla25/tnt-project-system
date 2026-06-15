require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const fetchAll = async (table) => {
    let allData = [];
    let from = 0;
    let to = 999;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase.from(table).select('*').order('id', { ascending: true }).range(from, to);
      if (error) throw error;
      console.log(`Fetched ${data.length} from ${table}`);
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < 1000) hasMore = false;
        else { from += 1000; to += 1000; }
      } else {
        hasMore = false;
      }
    }
    return allData;
  };
  
  const creators = await fetchAll('creators');
  console.log("Total creators fetched:", creators.length);
}

run().catch(console.error);
