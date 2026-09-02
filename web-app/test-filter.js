const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const start = '2026-08-26T00:00:00';
  const end = '2026-08-26T23:59:59';
  const queryStr = `and(approval.eq.approved,approved_at.gte.${start},approved_at.lte.${end}),and(approval.in.("not_approved","alternate"),not_approved_at.gte.${start},not_approved_at.lte.${end}),and(approval.eq.pending,created_at.gte.${start},created_at.lte.${end})`;
  console.log('Query String:', queryStr);
  const { data, error } = await supabase.from('campaign_creators').select('id, approval, approved_at, not_approved_at, created_at').eq('campaign_id', 55).or(queryStr);
  if (error) console.error('Error:', error);
  else console.log('Data count for 2026-08-26:', data.length, data.slice(0,2));
}
run();
