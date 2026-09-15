const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: campaign } = await supabase.from('campaigns').select('start_date, end_date').eq('id', 33).single();
  console.log("Campaign 33 dates:", campaign);
}

run();
