import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRpcAnon() {
  const { data, error } = await supabase.rpc('get_campaign_performance', { p_campaign_id: 44 });
  console.log('Anon Error:', error);
  console.log('Anon Data:', data);
}

testRpcAnon();
