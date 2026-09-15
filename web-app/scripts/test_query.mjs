import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://eolisqycvpkzdzzaugkk.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGlzcXljdnBremR6emF1Z2trIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAyMzY4NiwiZXhwIjoyMDk2NTk5Njg2fQ.mTSiu6O3XVbPrKDHiWIT0a4V38jrY3mRrBhaAnMyBuk";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("1. Testing campaign fetch");
  const { data: campaign, error: cErr } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', 46)
    .single();
  console.log("Campaign Error:", cErr);

  console.log("\n2. Testing campaign_creators fetch");
  const { data, error } = await supabase
    .from('campaign_creators')
    .select(`
      *,
      creators(username, nama_asli, link_account, creator_snapshots(followers, level, tier)),
      videos(id, link_video, content_uid, vt_approval, urutan)
    `)
    .eq('campaign_id', 46)
    .in('approval', ['approved', 'pending'])
    .range(0, 10);
  
  console.log("campaign_creators Error:", error);
  console.log("campaign_creators Data length:", data?.length);

  console.log("\n3. Testing campaign_creators_performance SQL VIEW");
  const { error: vErr } = await supabase
    .from('campaign_creators_performance')
    .select('*')
    .eq('campaign_id', 46)
    .range(0, 10);
  console.log("View Error:", vErr);

  console.log("\n4. Testing RPC get_campaign_performance");
  const { error: rErr } = await supabase
    .rpc('get_campaign_performance', { p_campaign_id: 46 });
  console.log("RPC get_campaign_performance Error:", rErr);

  console.log("\n5. Testing RPC get_campaign_video_gmv");
  const { error: rErr2 } = await supabase
    .rpc('get_campaign_video_gmv', { p_campaign_id: 46 });
  console.log("RPC get_campaign_video_gmv Error:", rErr2);
}

run();
