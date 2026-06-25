import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('creator_snapshots').insert({
    creator_id: 17207,
    tanggal_update: new Date().toISOString().split('T')[0],
    audience_age: '25-34',
    followers: 100000000,
    tier: 'Micro',
    level: 1,
    ratecard: 100000000,
    gmv_30d: 10000,
    updated_by: 'Test Script'
  }).select();

  console.log("Insert result:", { data, error });
}

main();
