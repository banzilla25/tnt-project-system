require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkUnmappedSales() {
  const { data, count, error } = await supabase
    .from('sales')
    .select('product_id', { count: 'exact', head: true })
    .is('campaign_id', null);
    
  console.log("Unmapped sales count:", count);
  console.log(error);
}

checkUnmappedSales().catch(console.error);
