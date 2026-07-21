import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eolisqycvpkzdzzaugkk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGlzcXljdnBremR6emF1Z2trIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAyMzY4NiwiZXhwIjoyMDk2NTk5Njg2fQ.mTSiu6O3XVbPrKDHiWIT0a4V38jrY3mRrBhaAnMyBuk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('campaign_creators')
    .select('id, creators(username), notes_manager, notes_pic')
    .eq('campaign_id', 46)
    .in('creators.username', ['serbaserbishp', 'dtca244', 'octacagia', 'looksbyaira']);

  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

run();
