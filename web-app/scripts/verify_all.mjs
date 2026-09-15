import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const anonKey = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient("https://eolisqycvpkzdzzaugkk.supabase.co", anonKey);

async function check() {
  const { data: campaigns } = await supabase.from('campaigns').select('id, nama').limit(10);
  console.log("Sample Campaigns:", campaigns);
  
  // Calculate GMV for all ads regardless of campaign name, just group by campaign_id
  const { data: ads } = await supabase.from('ads_performance').select('*');
  
  const latestMap = new Map();
  for (const row of ads) {
    const existing = latestMap.get(row.ad_id);
    if (!existing || new Date(row.tanggal) > new Date(existing.tanggal)) {
      latestMap.set(row.ad_id, row);
    }
  }

  const campBreakdown = {};
  for (const ad of latestMap.values()) {
    if (!campBreakdown[ad.campaign_id]) {
      campBreakdown[ad.campaign_id] = 0;
    }
    campBreakdown[ad.campaign_id] += Number(ad.gross_revenue_usd || 0);
  }
  
  console.log("Campaign breakdown (by ID):", campBreakdown);
}
check();
