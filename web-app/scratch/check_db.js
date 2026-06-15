const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:/Project-Tracking-System/web-app/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('ads_performance').select('*');
  if (error) console.error("Error:", error);
  else {
    console.log(`Found ${data.length} rows in ads_performance`);
    if (data.length > 0) {
      console.log("Sample:", data[0]);
    }
  }
}

check();
