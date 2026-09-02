const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const queryStrWithQuotes = `and(approval.in.("not_approved","alternate"))`;
  const res1 = await supabase.from('campaign_creators').select('id').or(queryStrWithQuotes).limit(1);
  console.log('With quotes error:', res1.error?.message);

  const queryStrNoQuotes = `and(approval.in.(not_approved,alternate))`;
  const res2 = await supabase.from('campaign_creators').select('id').or(queryStrNoQuotes).limit(1);
  console.log('No quotes error:', res2.error?.message);
}
run();
