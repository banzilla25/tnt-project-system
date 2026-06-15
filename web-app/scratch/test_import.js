const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:/Project-Tracking-System/web-app/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const inserts = [{
    ad_id: "test-ad-123",
    campaign_id: 17, // assuming Qahira campaign id
    ad_name: "Test Ad Name",
    creator_id: null,
    tanggal: "2026-06-13",
    cost_usd: 10.5,
    gross_revenue_usd: 100.0,
    purchases: 5,
    impressions: 1000,
    clicks: 50,
    kurs: 16000
  }];

  const { data, error } = await supabase.from('ads_performance').upsert(inserts, { onConflict: 'ad_id' });
  console.log("Upsert result:", { data, error });
}

test();
