require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Use SERVICE ROLE KEY to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRLS() {
  // 1. Campaign 38 with service role
  const { data: camp38, error: campErr } = await supabase.from('campaigns').select('id, nama, tipe_campaign, start_date, end_date, status').eq('id', 38).single();
  console.log("=== CAMPAIGN 38 (SERVICE ROLE) ===");
  console.log("Error:", campErr?.message || 'none');
  console.log(JSON.stringify(camp38, null, 2));

  // 2. Campaign creators count
  const { count: ccCount } = await supabase.from('campaign_creators').select('id', { count: 'exact', head: true }).eq('campaign_id', 38).eq('approval', 'approved');
  console.log("\nApproved creators for campaign 38:", ccCount);

  // 3. Sales count for campaign 38
  const { count: salesCount } = await supabase.from('sales').select('id', { count: 'exact', head: true }).eq('campaign_id', 38);
  console.log("Sales count for campaign 38:", salesCount);

  // 4. Sample sales
  const { data: sampleSales } = await supabase.from('sales').select('id, tanggal, creator_username, gmv, content_uid, content_type, product_id').eq('campaign_id', 38).order('tanggal', { ascending: false }).limit(5);
  console.log("\n=== SAMPLE SALES FOR 38 ===");
  console.log(JSON.stringify(sampleSales, null, 2));

  // 5. SKUs
  const { data: skus } = await supabase.from('skus').select('id, product_id, product_name').eq('campaign_id', 38).limit(5);
  console.log("\n=== SKUs FOR 38 ===");
  console.log(JSON.stringify(skus, null, 2));

  // 6. Videos
  const { data: ccIds } = await supabase.from('campaign_creators').select('id').eq('campaign_id', 38).eq('approval', 'approved').limit(20);
  if (ccIds && ccIds.length > 0) {
    const ids = ccIds.map(c => c.id);
    const { count: vidCount } = await supabase.from('videos').select('id', { count: 'exact', head: true }).in('campaign_creator_id', ids);
    console.log("\nVideos for campaign 38 creators:", vidCount);
  }

  // 7. Ads performance
  const { count: adsCount } = await supabase.from('ads_performance').select('id', { count: 'exact', head: true }).eq('campaign_id', 38);
  console.log("Ads performance for campaign 38:", adsCount);

  // 8. RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_campaign_performance', { p_campaign_id: 38 });
  console.log("\n=== RPC RESULT ===");
  console.log("Error:", rpcError?.message || 'none');
  console.log(JSON.stringify(rpcData, null, 2));

  // 9. Awareness summary
  const { data: awareness } = await supabase.from('campaign_awareness_summary').select('*').eq('campaign_id', 38).limit(3);
  console.log("\n=== AWARENESS SUMMARY ===");
  console.log(JSON.stringify(awareness, null, 2));
}

checkRLS().catch(console.error);
