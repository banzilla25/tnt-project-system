require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { count, error } = await supabase
    .from('creators')
    .select('*', { count: 'exact', head: true });
  
  if (error) throw error;
  console.log("Total creators in DB:", count);
}

run().catch(console.error);
