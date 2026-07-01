const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1]; // Use service role
const supabase = createClient(url, key);
async function check() {
  const { data, error } = await supabase.from('campaigns').select('id, nama');
  if (error) console.error(error);
  console.log('Campaigns:', data);
  
  if (data) {
     const omg = data.find(c => c.nama.toLowerCase().includes('omg'));
     if (omg) {
        console.log('OMG Campaign ID:', omg.id);
        const { data: sales, error: sErr } = await supabase.from('sales').select('id, super_key, gmv, tanggal_dibuat').eq('campaign_id', omg.id);
        if (sErr) console.error(sErr);
        console.log(`Found ${sales?.length} sales for OMG`);
        
        let aprGmv = 0;
        let mayGmv = 0;
        let aprDates = [];
        
        sales.forEach(s => {
           const d = new Date(s.tanggal_dibuat);
           if (d.getMonth() === 3) {
             aprGmv += s.gmv; // April is 3 (0-indexed)
             if (aprDates.length < 5) aprDates.push(s.tanggal_dibuat);
           }
           if (d.getMonth() === 4) mayGmv += s.gmv; // May is 4
        });
        
        console.log('April GMV:', aprGmv);
        console.log('April Sample Dates:', aprDates);
        console.log('May GMV:', mayGmv);
     }
  }
}
check();
