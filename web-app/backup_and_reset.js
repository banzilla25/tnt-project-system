require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Fetching existing data for backup...");
  // Ambil semua data campaign_creators
  const { data, error } = await supabase
    .from('campaign_creators')
    .select('*');
    
  if (error) {
    console.error("Error fetching data:", error);
    return;
  }
  
  // Save backup
  const backupPath = "D:\\Project-Tracking-System\\backup_campaign_creators_legacy.json";
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
  console.log(`Backup saved successfully to ${backupPath}. Total rows: ${data.length}`);
  
  // Reset gmv_organic_legacy to 0
  console.log("Resetting gmv_organic_legacy to 0 for all rows...");
  const { error: updateError } = await supabase
    .from('campaign_creators')
    .update({ gmv_organic_legacy: 0 })
    .neq('id', 0); // Hack to update all rows if needed, or simply .gte('id', 1)
    
  if (updateError) {
    console.error("Error updating data:", updateError);
  } else {
    console.log("Data gmv_organic_legacy has been successfully reset to 0.");
  }
}

run();
