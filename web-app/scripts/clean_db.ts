import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDB() {
  console.log('Fetching Qahira campaign ID...');
  const { data: qahiraCampaigns, error: cErr } = await supabase
    .from('campaigns')
    .select('id')
    .ilike('nama', '%Qahira%');

  if (cErr) {
    console.error('Error fetching Qahira campaign:', cErr);
    return;
  }

  const safeIds = qahiraCampaigns.map(c => c.id);
  console.log('Safe Campaign IDs:', safeIds);

  if (safeIds.length === 0) {
    console.error('Qahira campaign not found. Aborting to be safe.');
    return;
  }

  const safeIdsStr = `(${safeIds.join(',')})`;

  // Delete sales that are NOT in safeIds or are null
  console.log('Deleting sales...');
  let { error: sErr } = await supabase.from('sales').delete().neq('id', 0).not('campaign_id', 'in', safeIdsStr);
  if (sErr) console.error(sErr);
  await supabase.from('sales').delete().is('campaign_id', null);

  // Delete ads_performance
  console.log('Deleting ads_performance...');
  await supabase.from('ads_performance').delete().neq('id', 0).not('campaign_id', 'in', safeIdsStr);
  await supabase.from('ads_performance').delete().is('campaign_id', null);

  // Get campaign_creators to delete
  const { data: ccData } = await supabase
    .from('campaign_creators')
    .select('id')
    .not('campaign_id', 'in', safeIdsStr);

  const ccIdsToDelete = ccData ? ccData.map(cc => cc.id) : [];

  if (ccIdsToDelete.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < ccIdsToDelete.length; i += chunkSize) {
      const chunk = ccIdsToDelete.slice(i, i + chunkSize);
      const ccIdsStr = `(${chunk.join(',')})`;
      console.log(`Deleting relations for ${chunk.length} campaign_creators...`);
      await supabase.from('videos').delete().filter('campaign_creator_id', 'in', ccIdsStr);
      await supabase.from('creator_payments').delete().filter('campaign_creator_id', 'in', ccIdsStr);
      await supabase.from('creator_addresses').delete().filter('campaign_creator_id', 'in', ccIdsStr);
      await supabase.from('live_schedules').delete().filter('campaign_creator_id', 'in', ccIdsStr);
      await supabase.from('payout_creator').delete().filter('campaign_creator_id', 'in', ccIdsStr);
    }
  }

  console.log('Deleting ads_spends...');
  await supabase.from('ads_spends').delete().neq('id', 0).not('campaign_id', 'in', safeIdsStr);

  console.log('Deleting skus...');
  await supabase.from('skus').delete().neq('id', 0).not('campaign_id', 'in', safeIdsStr);

  console.log('Deleting daily_performance...');
  await supabase.from('daily_performance').delete().neq('id', 0).not('campaign_id', 'in', safeIdsStr);

  console.log('Deleting payout_requests...');
  await supabase.from('payout_requests').delete().neq('id', 0).not('campaign_id', 'in', safeIdsStr);

  console.log('Deleting campaign_creators...');
  await supabase.from('campaign_creators').delete().neq('id', 0).not('campaign_id', 'in', safeIdsStr);

  console.log('Deleting campaigns...');
  await supabase.from('campaigns').delete().neq('id', 0).not('id', 'in', safeIdsStr);

  console.log('Cleanup completed successfully!');
}

cleanDB().catch(console.error);
