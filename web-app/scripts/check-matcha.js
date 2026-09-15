require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: matcha } = await supabase
    .from('creators')
    .select('id, username')
    .eq('username', 'matcha.mu00')
    .single();
  console.log("Matcha in creators:", matcha);

  const { data: cc } = await supabase
    .from('campaign_creators')
    .select('*')
    .eq('campaign_id', 17)
    .eq('creator_id', matcha.id)
    .single();
  console.log("Matcha in campaign_creators:", cc);
}

run().catch(console.error);
