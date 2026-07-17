import { createClient } from "@supabase/supabase-js";
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const anonKey = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient("https://eolisqycvpkzdzzaugkk.supabase.co", anonKey);

async function check() {
  const { data: campaigns } = await supabase.from('campaigns').select('id, nama').ilike('nama', '%OMG%');
  console.log("Campaigns:", campaigns);
  
  if (campaigns && campaigns.length > 0) {
    const omgId = campaigns[0].id;
    const { data: ads } = await supabase.from('ads_performance').select('*').eq('campaign_id', omgId);
    
    const latestMap = new Map();
    for (const row of ads) {
      const existing = latestMap.get(row.ad_id);
      if (!existing || new Date(row.tanggal) > new Date(existing.tanggal)) {
        latestMap.set(row.ad_id, row);
      }
    }

    let totalGmvUsd = 0;
    let totalSpendUsd = 0;
    for (const ad of latestMap.values()) {
      totalGmvUsd += Number(ad.gross_revenue_usd || 0);
      totalSpendUsd += Number(ad.cost_usd || 0);
    }

    console.log(`For Campaign ${campaigns[0].nama}:`);
    console.log("Total GMV USD:", totalGmvUsd);
    console.log("Total Spend USD:", totalSpendUsd);
  }
}
check();
