require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const campaignId = 34;
  
  const { data: sales } = await supabase.from('sales').select('tanggal, gmv').eq('campaign_id', 34).eq('is_refund', false);
  let total = 0;
  let totalUpToAug3 = 0;
  if (sales) {
    sales.forEach(s => {
      total += Number(s.gmv);
      const rowDate = new Date(s.tanggal).getTime();
      const cutoff = new Date('2026-08-04').getTime();
      if (rowDate < cutoff) {
        totalUpToAug3 += Number(s.gmv);
      }
    });
  }
  console.log(`Total GMV for 34: Rp ${total.toLocaleString('id-ID')}`);
  console.log(`Total up to Aug 3: Rp ${totalUpToAug3.toLocaleString('id-ID')}`);
}

run();
