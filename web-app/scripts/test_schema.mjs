import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const anonKey = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const serviceKey = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1].trim() || anonKey;
const supabase = createClient("https://eolisqycvpkzdzzaugkk.supabase.co", serviceKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('creator_addresses')
    .select('*')
    .limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}
checkSchema();
