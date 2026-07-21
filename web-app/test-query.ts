import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eolisqycvpkzdzzaugkk.supabase.co';
const supabaseKey = 'sb_publishable_OFbbBA8nlXzMLeZOliTt7A_pRadq_P7';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('campaign_creators')
    .select('id, content_type, qty_vt, qty_live')
    .or('content_type.eq."Video & Live",and(content_type.eq.-,qty_vt.gte.1,qty_live.gte.1),and(content_type.is.null,qty_vt.gte.1,qty_live.gte.1)')
    .limit(5);

  console.log("Error:", error);
  console.log("Data:", data);
}

run();
