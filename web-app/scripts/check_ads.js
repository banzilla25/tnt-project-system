const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_campaign_performance', { p_campaign_id: 1 });
  console.log(data ? "RPC exists" : "RPC failed", error);
}

check();
