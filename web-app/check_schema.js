require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Check if campaign_total_sales has total_organic_gmv column
  const { data, error } = await supabaseAdmin.from('campaign_total_sales').select('*').limit(1);
  console.log('campaign_total_sales columns:', data ? Object.keys(data[0] || {}) : 'no data');
  console.log('campaign_total_sales error:', error);
  console.log('campaign_total_sales sample:', data);
}
check();
