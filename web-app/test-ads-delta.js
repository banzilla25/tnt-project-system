const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://eolisqycvpkzdzzaugkk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbGlzcXljdnBremR6emF1Z2trIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAyMzY4NiwiZXhwIjoyMDk2NTk5Njg2fQ.mTSiu6O3XVbPrKDHiWIT0a4V38jrY3mRrBhaAnMyBuk');

async function run() {
  const { data: adsData } = await supabase
    .from('ads_performance')
    .select('ad_id, tanggal, gross_revenue_usd, kurs')
    .eq('campaign_id', 46)
    .order('tanggal', { ascending: true });

  const adsByDate = {};
  const previousAdValues = {};

  adsData.forEach(ad => {
    const dateStr = ad.tanggal.substring(0, 10);
    const currentGmv = ad.gross_revenue_usd || 0;
    const prevGmv = previousAdValues[ad.ad_id] || 0;
    const deltaUsd = currentGmv - prevGmv;
    
    // Only count positive deltas
    if (deltaUsd > 0) {
      const kurs = (ad.kurs && ad.kurs < 1000) ? ad.kurs * 1000 : (ad.kurs || 16000);
      const deltaIdr = deltaUsd * kurs;
      
      if (!adsByDate[dateStr]) adsByDate[dateStr] = 0;
      adsByDate[dateStr] += deltaIdr;
    }
    
    previousAdValues[ad.ad_id] = currentGmv;
  });

  console.log(adsByDate);
}

run();
