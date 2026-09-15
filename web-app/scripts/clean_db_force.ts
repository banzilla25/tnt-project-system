import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const safeCampaignIds = [17];
  
  // 1. Fetch all campaign_creators NOT in safe campaigns
  let ccIds: number[] = [];
  let offset = 0;
  while (true) {
    let { data: ccList, error: err1 } = await supabase
      .from('campaign_creators')
      .select('id')
      .not('campaign_id', 'in', `(${safeCampaignIds.join(',')})`)
      .range(offset, offset + 999);
    if (err1) throw err1;
    if (!ccList || ccList.length === 0) break;
    ccIds.push(...ccList.map(c => c.id));
    if (ccList.length < 1000) break;
    offset += 1000;
  }
  console.log(`Found ${ccIds.length} campaign_creators to delete.`);

  // Function to delete in chunks
  async function deleteInChunks(table: string, column: string, ids: number[]) {
    const chunkSize = 50;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { error } = await supabase.from(table).delete().in(column, chunk);
      if (error) {
        console.error(`Error deleting ${table} chunk:`, error);
      }
    }
    console.log(`Deleted chunks for ${table}`);
  }

  if (ccIds.length > 0) {
    await deleteInChunks('videos', 'campaign_creator_id', ccIds);
    await deleteInChunks('creator_payments', 'campaign_creator_id', ccIds);
    await deleteInChunks('creator_addresses', 'campaign_creator_id', ccIds);
    await deleteInChunks('live_schedules', 'campaign_creator_id', ccIds);
    await deleteInChunks('payout_creator', 'campaign_creator_id', ccIds);
    
    // Now delete the campaign creators themselves
    await deleteInChunks('campaign_creators', 'id', ccIds);
  }

  // 2. Fetch all campaigns NOT in safe campaigns
  let { data: campList, error: err2 } = await supabase
    .from('campaigns')
    .select('id')
    .not('id', 'in', `(${safeCampaignIds.join(',')})`);
    
  if (err2) throw err2;
  const cIds = campList?.map(c => c.id) || [];
  console.log(`Found ${cIds.length} campaigns to delete.`);

  if (cIds.length > 0) {
    await deleteInChunks('sales', 'campaign_id', cIds);
    await deleteInChunks('ads_performance', 'campaign_id', cIds);
    await deleteInChunks('ads_spends', 'campaign_id', cIds);
    await deleteInChunks('skus', 'campaign_id', cIds);
    await deleteInChunks('daily_performance', 'campaign_id', cIds);
    await deleteInChunks('payout_requests', 'campaign_id', cIds);
    
    // Finally delete campaigns
    await deleteInChunks('campaigns', 'id', cIds);
  }

  console.log('Force cleanup done!');
}

run().catch(console.error);
