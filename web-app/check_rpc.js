import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRpc() {
  const { data, error } = await supabase.rpc('get_campaign_performance', { p_campaign_id: 44 });
  console.log(Array.isArray(data) ? 'Array' : 'Object');
  console.log('Keys:', data ? Object.keys(data) : null);
}

checkRpc();
