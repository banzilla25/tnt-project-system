const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testUpdate() {
  const { data, error } = await supabase
    .from('campaign_creators')
    .update({ approval: 'approved' })
    .eq('id', 12345); // just an id that doesn't exist, we just want to see if RLS blocks it.
  
  console.log("Error:", error);
}

testUpdate();
