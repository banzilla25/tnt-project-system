const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:/Project-Tracking-System/web-app/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_schema_info', { table_name: 'ads_performance' });
  // Instead of rpc which we might not have, just try to select kurs
  const res = await supabase.from('ads_performance').select('kurs').limit(1);
  console.log("Select kurs result:", res);
}

check();
