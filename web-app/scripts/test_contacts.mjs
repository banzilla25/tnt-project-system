import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const anonKey = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const serviceKey = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1].trim() || anonKey;
const supabase = createClient("https://eolisqycvpkzdzzaugkk.supabase.co", serviceKey);

async function testContacts() {
  const { data: creators, error } = await supabase
    .from('creators')
    .select('id, username, creator_contacts(nomor, status)')
    .limit(5);
  console.log("Creators:", JSON.stringify(creators, null, 2));
  console.log("Error:", error);
}
testContacts();
