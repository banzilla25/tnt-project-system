const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const campaignsToFind = [
    'SKINMOLOGY',
    'MSGLOWFORMEN',
    'MSGLOWBEAUTY',
    'ISWHITE',
    'NAISDAY'
  ];

  const { data: campaigns, error } = await supabase.from('campaigns').select('*').in('nama', campaignsToFind);
  if (error) {
    console.error(error);
    return;
  }

  const { data: summaries } = await supabase.from('vw_campaign_summary').select('*').in('campaign_id', campaigns.map(c => c.id));

  for (const cName of campaignsToFind) {
    const c = campaigns.find(x => x.nama === cName);
    if (!c) {
      console.log(`Campaign ${cName} not found in DB!`);
      continue;
    }
    const summary = summaries.find(x => x.campaign_id === c.id) || {};
    
    // Using string formatting
    const formatRp = (num) => 'Rp' + Number(num || 0).toLocaleString('id-ID');
    
    console.log(`\n================ ${cName} ================`);
    console.log(`[Achievement]`);
    console.log(`  Target   : ${formatRp(c.target_gmv)}`);
    console.log(`  Progress : ${formatRp(summary.total_gmv)}`);
    
    console.log(`[Budget]`);
    console.log(`  Budget Awal (Campaign) : ${formatRp(c.budget_awal_campaign)}`);
    console.log(`  Budget Awal (ADS)      : ${formatRp(c.budget_awal_ads)}`);
    
    console.log(`[Budget Terpakai]`);
    console.log(`  Campaign Terpakai : ${formatRp(summary.total_pembayaran_kreator)}`); // In vw_campaign_summary
    console.log(`  ADS Terpakai      : ${formatRp(summary.total_ads_spend)}`);
  }
  process.exit(0);
}

run();
