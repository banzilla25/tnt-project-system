import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { count, error } = await supabase
    .from('campaign_creators')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', 44);

  console.log('COUNT KIME (44):', count);
  
  const { count: countGlow } = await supabase
    .from('campaign_creators')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', 41);

  console.log('COUNT MS GLOW (41):', countGlow);
}

check();
