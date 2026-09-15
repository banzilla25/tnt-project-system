require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function remapRest() {
  const productIds = [
    '1729620843482810521',
    '1732261345920713881',
    '1735126895533589657',
    // also include the exact strings from the screenshot just in case they are different in sales
    '1732261345928713881',
    '1729755719213883933',
    '1730864636965651689',
    '1731324370888723689'
  ];
  const campaignId = 38;

  console.log("=== REMAPPING REST OF DATA FOR PWS (Campaign 38) ===");

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

remapRest().catch(console.error);
