import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const anonKey = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const serviceKey = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1].trim() || anonKey;
const supabase = createClient("https://eolisqycvpkzdzzaugkk.supabase.co", serviceKey);

async function testFetchAndUpdate() {
  const { data, error } = await supabase
    .from('creator_addresses')
    .select('*, campaign_creators!inner(campaign_id)')
    .limit(1)
    .single();
    
  console.log("Fetched Data:", data);
  
  if (data) {
    const payload = { ...data, nama_penerima: "Update Test" };
    const { data: updateData, error: updateError } = await supabase
      .from('creator_addresses')
      .update(payload)
      .eq('id', data.id);
      
    console.log("Update Error:", updateError);
  }
}
testFetchAndUpdate();
