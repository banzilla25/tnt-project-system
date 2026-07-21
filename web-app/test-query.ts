import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eolisqycvpkzdzzaugkk.supabase.co';
const supabaseKey = 'sb_publishable_OFbbBA8nlXzMLeZOliTt7A_pRadq_P7';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('campaign_creators')
    .select('id, notes_manager, notes_pic')
    .limit(10);

  console.log("Error:", error);
  console.log("Data:", data);
}

run();
