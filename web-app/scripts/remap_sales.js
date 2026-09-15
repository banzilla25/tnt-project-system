require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function remapData() {
  const productIds = [
    '1730864636965651609', 
    '1729755710213883033', 
    '1729660628988561561', 
    '1731324370088723609'
  ];
  const campaignId = 38;

  console.log("=== REMAPPING DATA FOR PWS (Campaign 38) ===");

  // 1. Get Product Names for these IDs from unmapped sales to register SKUs properly
  const { data: salesData } = await supabase
    .from('sales')
    .select('product_id, raw_data')
    .is('campaign_id', null)
    .in('product_id', productIds)
    .limit(100);

  const productNames = {};
  if (salesData) {
    for (const row of salesData) {
      if (!productNames[row.product_id] && row.raw_data) {
        // Try to find Product Name in raw data
        const raw = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data;
        const name = raw['Product Name'] || raw['Nama Produk'] || raw['Product name'] || `PWS Product ${row.product_id}`;
        productNames[row.product_id] = name;
      }
    }
  }
  
  // Fill in missing names
  for (const pid of productIds) {
    if (!productNames[pid]) {
      productNames[pid] = `PWS Product ${pid}`;
    }
  }
  
  console.log("Found product names:", productNames);

  // 2. Insert into skus
  const skusToInsert = productIds.map(pid => ({
    campaign_id: campaignId,
    product_id: pid,
    nama_produk: productNames[pid]
  }));
  
  const { data: skusData, error: skusError } = await supabase.from('skus').upsert(skusToInsert, { onConflict: 'product_id, campaign_id' });
  if (skusError) {
    console.error("Error inserting SKUs:", skusError);
  } else {
    console.log("SKUs registered successfully.");
  }

  // 3. Update Sales
  const { data: updatedSales, error: updateSalesError } = await supabase
    .from('sales')
    .update({ campaign_id: campaignId })
    .is('campaign_id', null)
    .in('product_id', productIds)
    .select('id');
    
  if (updateSalesError) {
    console.error("Error updating sales:", updateSalesError);
  } else {
    console.log(`Updated ${updatedSales?.length || 0} unmapped sales records.`);
  }

  // 4. Update organic_videos
  const { data: updatedVideos, error: updateVideosError } = await supabase
    .from('organic_videos')
    .update({ campaign_id: campaignId })
    .is('campaign_id', null)
    .in('product_id', productIds)
    .select('id');
    
  if (updateVideosError) {
    console.error("Error updating organic_videos:", updateVideosError);
  } else {
    console.log(`Updated ${updatedVideos?.length || 0} unmapped organic_videos records.`);
  }

  console.log("=== REMAPPING COMPLETE ===");
}

remapData().catch(console.error);
