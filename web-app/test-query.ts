import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eolisqycvpkzdzzaugkk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGlzcXljdnBremR6emF1Z2trIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAyMzY4NiwiZXhwIjoyMDk2NTk5Njg2fQ.mTSiu6O3XVbPrKDHiWIT0a4V38jrY3mRrBhaAnMyBuk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('campaign_creators')
    .select('id, notes_manager, notes_pic')
    .eq('campaign_id', 46)
    .or('notes_manager.not.is.null,notes_pic.not.is.null')
    .order('id', { ascending: false });

  console.log("Error:", error);
  console.log("Data length:", data?.length);
  
  if (data) {
    let count = 0;
    for (const row of data) {
      const mn = JSON.parse(row.notes_manager || '[]');
      const pn = JSON.parse(row.notes_pic || '[]');
      if (mn.length > 0 || pn.length > 0) count++;
    }
    console.log("Actual rows with notes:", count);
  }
}

run();
