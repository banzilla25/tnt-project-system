require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAllSalesTypes() {
  const { data, error } = await supabase.from('sales').select('content_type');
  if (data) {
    const types = new Set(data.map(s => s.content_type));
    console.log("Unique content_types in sales table:", Array.from(types));
  }
}

checkAllSalesTypes().catch(console.error);
