require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: camps, error } = await supabase.from('campaigns').select('id, nama');
  if (error) return console.error(error);
  
  const wardah = camps.find(c => c.nama.toLowerCase().includes('wardah'));
  if (!wardah) {
    console.log("Wardah campaign not found in DB.");
    return;
  }
  
  const { data: ccs } = await supabase.from('campaign_creators').select('gmv_organic_legacy').eq('campaign_id', wardah.id);
  const total = ccs.reduce((acc, row) => acc + (row.gmv_organic_legacy || 0), 0);
  console.log(`Campaign: ${wardah.nama}`);
  console.log(`Legacy Organic GMV in DB: Rp ${total.toLocaleString('id-ID')}`);
}
check();
