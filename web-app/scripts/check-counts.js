require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkCount(table) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  console.log(`${table}: ${count}`);
}

async function run() {
  await checkCount('creator_niches');
  await checkCount('creator_notes');
  await checkCount('audit_logs');
  await checkCount('daily_performance');
  await checkCount('sales');
}

run().catch(console.error);
