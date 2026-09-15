const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('payment_items').select('*').limit(1);
  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log("Columns:", Object.keys(data[0]));
  }
}

run();
