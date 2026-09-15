import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.rpc('get_table_schema', { table_name: 'campaign_creators' });
  if (error) {
    // Alternatively, just select 1 row
    const { data: row } = await supabase.from('campaign_creators').select('*').limit(1);
    console.log(Object.keys(row?.[0] || {}));
  } else {
    console.log(data);
  }
}
run();
