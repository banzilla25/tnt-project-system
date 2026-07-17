import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const anonKey = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const serviceKey = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1].trim() || anonKey;
const supabase = createClient("https://eolisqycvpkzdzzaugkk.supabase.co", serviceKey);

async function testInsert() {
  const { data: cc, error: err1 } = await supabase.from('campaign_creators').select('id').limit(1).single();
  console.log("cc:", cc, "err1:", err1);
  if (cc) {
    const payload = {
      campaign_creator_id: cc.id,
      nama_penerima: 'Test',
      nama_jalan: 'Jalan Test',
      kecamatan: 'Test Kec',
      kabupaten_kota: 'Test Kab',
      provinsi: 'Test Prov',
      kode_pos: '12345',
      proses: 'Belum diproses'
    };
    console.log("Trying to insert with cc.id =", cc.id);
    const { data, error } = await supabase.from('creator_addresses').insert([payload]).select().single();
    console.log("Result:", data);
    console.log("Error:", error);
  }
}
testInsert();
