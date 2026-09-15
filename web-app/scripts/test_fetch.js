require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testFetch() {
  const fetchAll = async (table) => {
    let allData = [];
    let from = 0;
    let to = 999;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase.from(table).select('*').order('id', { ascending: true }).range(from, to);
      if (error) throw error;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < 1000) hasMore = false;
        else { from += 1000; to += 1000; }
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  try {
    console.log("Fetching heavy tables...");
    const creatorsPromise = fetchAll('creators');
    const snapshotsPromise = fetchAll('creator_snapshots');
    const contactsPromise = fetchAll('creator_contacts');
    const campaignCreatorsPromise = fetchAll('campaign_creators');
    const videosPromise = fetchAll('videos');
    const salesPromise = fetchAll('sales');
    
    console.log("Waiting for Promise.all...");
    await Promise.all([
      creatorsPromise,
      snapshotsPromise,
      contactsPromise,
      campaignCreatorsPromise,
      videosPromise,
      salesPromise
    ]);
    console.log("Success fetching heavy tables.");
    
    console.log("Fetching other tables...");
    await Promise.all([
      supabase.from('brands').select('*'),
      supabase.from('campaigns').select('*'),
      supabase.from('niches').select('*'),
      supabase.from('creator_niches').select('*'),
      supabase.from('creator_notes').select('*'),
      supabase.from('audit_logs').select('*'),
      supabase.from('skus').select('*'),
      supabase.from('vw_campaign_summary').select('*'),
      supabase.from('daily_performance').select('*'),
      supabase.from('payout_requests').select('*'),
      supabase.from('payout_creator').select('*'),
      supabase.from('creator_payments').select('*'),
      supabase.from('ads_spends').select('*'),
      supabase.from('creator_addresses').select('*'),
      supabase.from('live_schedules').select('*'),
      supabase.from('ads_performance').select('*'),
      supabase.from('ad_name_mapping').select('*')
    ]);
    console.log("Success fetching all tables!");
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

testFetch();
