require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const sum = await supabase.rpc('exec_sql', { sql_query: "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_campaign_daily_stats'" });
  if (sum.data && sum.data.length > 0) {
    console.log(sum.data[0].pg_get_functiondef);
  } else {
    console.log('Function not found');
  }
}
check();
