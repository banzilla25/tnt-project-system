import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://eolisqycvpkzdzzaugkk.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGlzcXljdnBremR6emF1Z2trIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAyMzY4NiwiZXhwIjoyMDk2NTk5Njg2fQ.mTSiu6O3XVbPrKDHiWIT0a4V38jrY3mRrBhaAnMyBuk";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Testing videoActions fetch");
  const { data, error } = await supabase
    .from('campaign_creators')
    .select('*, creators!inner(*), videos(*)')
    .eq('campaign_id', 46)
    .in('approval', ['approved', 'pending'])
    .range(0, 10);
  
  console.log("videoActions Error:", error);
  console.log("videoActions Data length:", data?.length);
}

run();
