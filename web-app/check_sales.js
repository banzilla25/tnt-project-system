require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const { data: salesTypes } = await supabase.from('sales').select('content_type').limit(20);
  console.log("Sample content types in sales:");
  const types = new Set(salesTypes.map(s => s.content_type));
  console.log(Array.from(types));

  // Also check if campaign 38 has any live_schedules
  const { count } = await supabase.from('live_schedules').select('*', { count: 'exact', head: true }).eq('campaign_creator_id', 23784); // using one of ccIds from earlier
  console.log("Live schedules for 23784:", count);
}

test().catch(console.error);
