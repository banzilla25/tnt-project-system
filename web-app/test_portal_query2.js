const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const campaignId = 38;
  const { data: ccData, error } = await supabase
    .from('campaign_creators')
    .select(`
      id, 
      creator_id,
      client_approval, 
      notes_pic, 
      tier,
      content_type,
      sample_progress,
      sample_progress,
      creators(username, nama_asli, link_account, creator_snapshots(followers, level, tier), creator_contacts(nomor, status)),
      videos(id, link_video, content_uid, vt_approval, urutan)
    `)
    .eq('campaign_id', campaignId)
    .in('approval', ['approved', 'alternate']);

  if (error) {
    console.error("Error ccData:", error);
  } else {
    console.log("ccData length:", ccData.length);
  }
}

testQuery();
