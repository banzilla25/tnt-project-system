const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(url, key);
async function check() {
  const { data, error } = await supabase.from('campaigns').select('id, nama');
  console.log('Campaigns:', data);
  
  if (data) {
     const omg = data.find(c => c.nama.toLowerCase().includes('omg'));
     if (omg) {
        console.log('OMG Campaign ID:', omg.id);
        const { data: sales, error: sErr } = await supabase.from('sales').select('id, super_key, gmv, tanggal_dibuat').eq('campaign_id', omg.id);
        console.log(`Found ${sales?.length} sales for OMG`);
        
        let aprGmv = 0;
        let mayGmv = 0;
        
        sales.forEach(s => {
           const d = new Date(s.tanggal_dibuat);
           if (d.getMonth() === 3) aprGmv += s.gmv; // April is 3 (0-indexed)
           if (d.getMonth() === 4) mayGmv += s.gmv; // May is 4
        });
        
        console.log('April GMV:', aprGmv);
        console.log('May GMV:', mayGmv);
     }
  }
}
check();
