const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching all ads_performance data...');
  const { data, error } = await supabase
    .from('ads_performance')
    .select('id, ad_id, ad_name, tanggal, cost_usd, gross_revenue_usd, impressions, clicks, product_page_views, checkouts_initiated, purchases, items_purchased')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log(`Fetched ${data.length} rows.`);

  const adsById = {};
  data.forEach(row => {
    const key = row.ad_id || row.ad_name;
    if (!key) return;
    if (!adsById[key]) adsById[key] = [];
    adsById[key].push(row);
  });

  const updates = [];

  for (const key in adsById) {
    const rows = adsById[key];
    for (let i = 0; i < rows.length; i++) {
      const rowI = rows[i];
      let sumCost = 0; let sumRev = 0; let sumImp = 0; let sumClicks = 0; let sumPpv = 0;
      let sumCheckouts = 0; let sumPurch = 0; let sumItems = 0; let sumViews = 0;

      for (let j = 0; j < i; j++) {
        const rowJ = rows[j];
        if (new Date(rowJ.tanggal) < new Date(rowI.tanggal)) {
          sumCost += Number(rowJ.cost_usd || 0);
          sumRev += Number(rowJ.gross_revenue_usd || 0);
          sumImp += Number(rowJ.impressions || 0);
          sumClicks += Number(rowJ.clicks || 0);
          sumPpv += Number(rowJ.product_page_views || 0);
          sumCheckouts += Number(rowJ.checkouts_initiated || 0);
          sumPurch += Number(rowJ.purchases || 0);
          sumItems += Number(rowJ.items_purchased || 0);
        }
      }

      if (sumCost > 0 || sumRev > 0 || sumImp > 0) {
        updates.push({
          id: rowI.id,
          cost_usd: Number(rowI.cost_usd || 0) + sumCost,
          gross_revenue_usd: Number(rowI.gross_revenue_usd || 0) + sumRev,
          impressions: Number(rowI.impressions || 0) + sumImp,
          clicks: Number(rowI.clicks || 0) + sumClicks,
          product_page_views: Number(rowI.product_page_views || 0) + sumPpv,
          checkouts_initiated: Number(rowI.checkouts_initiated || 0) + sumCheckouts,
          purchases: Number(rowI.purchases || 0) + sumPurch,
          items_purchased: Number(rowI.items_purchased || 0) + sumItems
        });
      }
    }
  }

  console.log(`Found ${updates.length} rows to update to true lifetime data.`);

  if (updates.length > 0) {
    for (let i = 0; i < updates.length; i++) {
      const up = updates[i];
      const { id, ...rest } = up;
      const { error: updateError } = await supabase.from('ads_performance').update(rest).eq('id', id);
      if (updateError) console.error(`Error updating id ${id}:`, updateError);
      if (i % 100 === 0) console.log(`Updated ${i} rows...`);
    }
    console.log('Reconstruction complete!');
  }
}
run();
