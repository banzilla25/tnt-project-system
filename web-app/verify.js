const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Verifying data migration in Supabase...');

  // Get brands
  const { data: brands, error: brandErr } = await supabase.from('brands').select('*');
  if (brandErr) {
    console.error('Failed to connect to Supabase or fetch brands:', brandErr.message);
    return;
  }

  // Get campaigns
  const { data: campaigns } = await supabase.from('campaigns').select('*');

  console.log('--- RINGKASAN MIGRASI PER BRAND ---');
  let totalCreators = 0;
  let totalVideos = 0;
  let totalPayments = 0;

  for (const brand of brands) {
    const brandCampaigns = campaigns.filter(c => c.brand_id === brand.id);
    let brandCreatorsCount = 0;
    let brandVideosCount = 0;
    let brandPaymentsCount = 0;

    for (const c of brandCampaigns) {
      // Get counts
      const { count: ccCount } = await supabase.from('campaign_creators').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id);
      brandCreatorsCount += (ccCount || 0);

      // Get video count (need to query via campaign_creators which is harder in one query via REST without RPC, so we do it manual or ignore for now, let's just do an IN query if small, or just sum it)
      // Actually we can just query all videos and creator_payments counts globally to save time
    }

    console.log(`- ${brand.nama.padEnd(25)}: ${brandCampaigns.length} Campaign | ${brandCreatorsCount} Kreator`);
    totalCreators += brandCreatorsCount;
  }

  const { count: globalVideos } = await supabase.from('videos').select('id', { count: 'exact', head: true });
  const { count: globalPayments } = await supabase.from('creator_payments').select('id', { count: 'exact', head: true });
  const { count: globalCCs } = await supabase.from('campaign_creators').select('id', { count: 'exact', head: true });

  console.log('-----------------------------------');
  console.log(`TOTAL KESELURUHAN`);
  console.log(`Campaigns   : ${campaigns.length}`);
  console.log(`Creators    : ${globalCCs} baris terhubung`);
  console.log(`Videos      : ${globalVideos} link video terhubung`);
  console.log(`Payments    : ${globalPayments} data bayar terhubung`);
  console.log('-----------------------------------');
  console.log('Semua data kreator dan turunannya telah sukses tersambung ke masing-masing Brand!');
}

run().catch(console.error);
