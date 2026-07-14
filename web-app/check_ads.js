const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.rpc('execute_sql', { sql: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ads_performance';" });
  console.log(JSON.stringify({data, error}, null, 2));
}

check();
