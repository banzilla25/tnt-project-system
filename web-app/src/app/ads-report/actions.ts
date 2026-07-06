"use server";

import { createClient } from "@/utils/supabase/server";

export async function getAdsReportData(params: {
  startDate?: string;
  endDate?: string;
  campaignId?: number | null;
  campaignAdsName?: string | null;
  searchQuery?: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
}) {
  const supabase = await createClient();
  
  // 1. Fetch ALL data (we need history to calculate deltas)
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('ads_performance')
      .select('*, creators(username)')
      .order('tanggal', { ascending: true })
      .range(from, from + step - 1);
      
    if (error) throw error;
    if (data && data.length > 0) {
      allData.push(...data);
    }
    if (!data || data.length < step) {
      break;
    }
    from += step;
  }
  
  if (allData.length === 0) return { summary: { totalSpend: 0, totalGmv: 0, totalImpressions: 0, roas: 0, cpm: 0 }, data: [], campaignBreakdown: { list: [], globalUnmappedCampaigns: 0 }, globalUnmappedCampaigns: 0 };

  // 2. Group by ad_id to calculate deltas
  const adsByAdId: Record<string, any[]> = {};
  for (const row of allData) {
    const key = row.ad_id || row.ad_name || row.id.toString();
    if (!adsByAdId[key]) adsByAdId[key] = [];
    adsByAdId[key].push(row);
  }

  // Calculate Deltas
  const deltaData = [];
  for (const key in adsByAdId) {
    const rows = adsByAdId[key];
    // Rows are already ordered by tanggal ASC
    let hwm_cost = 0;
    let hwm_rev = 0;
    let hwm_imp = 0;
    let hwm_clicks = 0;
    let hwm_ppv = 0;
    let hwm_checkouts = 0;
    let hwm_purchases = 0;
    let hwm_items = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      const cost = Number(row.cost_usd || 0);
      const rev = Number(row.gross_revenue_usd || 0);
      const imp = Number(row.impressions || 0);
      const clicks = Number(row.clicks || 0);
      const ppv = Number(row.product_page_views || 0);
      const checkouts = Number(row.checkouts_initiated || 0);
      const purchases = Number(row.purchases || 0);
      const items = Number(row.items_purchased || 0);
      
      const deltaRow = {
        ...row,
        delta_cost_usd: cost > hwm_cost ? cost - hwm_cost : 0,
        delta_gross_revenue_usd: rev > hwm_rev ? rev - hwm_rev : 0,
        delta_impressions: imp > hwm_imp ? imp - hwm_imp : 0,
        delta_clicks: clicks > hwm_clicks ? clicks - hwm_clicks : 0,
        delta_product_page_views: ppv > hwm_ppv ? ppv - hwm_ppv : 0,
        delta_checkouts_initiated: checkouts > hwm_checkouts ? checkouts - hwm_checkouts : 0,
        delta_purchases: purchases > hwm_purchases ? purchases - hwm_purchases : 0,
        delta_items_purchased: items > hwm_items ? items - hwm_items : 0,
      };

      hwm_cost = Math.max(hwm_cost, cost);
      hwm_rev = Math.max(hwm_rev, rev);
      hwm_imp = Math.max(hwm_imp, imp);
      hwm_clicks = Math.max(hwm_clicks, clicks);
      hwm_ppv = Math.max(hwm_ppv, ppv);
      hwm_checkouts = Math.max(hwm_checkouts, checkouts);
      hwm_purchases = Math.max(hwm_purchases, purchases);
      hwm_items = Math.max(hwm_items, items);

      deltaRow.cost_usd = deltaRow.delta_cost_usd;
      deltaRow.gross_revenue_usd = deltaRow.delta_gross_revenue_usd;
      deltaRow.impressions = deltaRow.delta_impressions;
      deltaRow.clicks = deltaRow.delta_clicks;
      deltaRow.product_page_views = deltaRow.delta_product_page_views;
      deltaRow.checkouts_initiated = deltaRow.delta_checkouts_initiated;
      deltaRow.purchases = deltaRow.delta_purchases;
      deltaRow.items_purchased = deltaRow.delta_items_purchased;
      
      deltaData.push(deltaRow);
    }
  }

  // 3. Apply Filters
  let filteredData = deltaData;
  
  if (params.startDate) {
    filteredData = filteredData.filter(r => r.tanggal >= params.startDate!);
  }
  if (params.endDate) {
    filteredData = filteredData.filter(r => r.tanggal <= params.endDate!);
  }
  
  // Search query (Ad Name or Ad ID)
  if (params.searchQuery) {
    const q = params.searchQuery.toLowerCase();
    filteredData = filteredData.filter(r => 
      (r.ad_name && r.ad_name.toLowerCase().includes(q)) || 
      (r.ad_id && r.ad_id.toLowerCase().includes(q))
    );
  }
  
  // This is the global searchFilteredAds equivalent
  const searchFilteredAds = [...filteredData];
  
  // Apply Campaign ID and Campaign Ads filter
  if (params.campaignId !== null && params.campaignId !== undefined) {
    filteredData = filteredData.filter(r => r.campaign_id === params.campaignId);
  }
  if (params.campaignAdsName) {
    filteredData = filteredData.filter(r => r.campaign_ads_name === params.campaignAdsName);
  }
  
  // 4. Calculate Global Summary
  let sumSpend = 0; let sumGmv = 0; let sumImpr = 0;
  for (const ad of filteredData) {
    const kurs = ad.kurs || 16000;
    sumSpend += ad.cost_usd * kurs;
    sumGmv += ad.gross_revenue_usd * kurs;
    sumImpr += ad.impressions;
  }
  const summary = {
    totalSpend: sumSpend,
    totalGmv: sumGmv,
    totalImpressions: sumImpr,
    roas: sumSpend > 0 ? sumGmv / sumSpend : 0,
    cpm: sumImpr > 0 ? sumSpend / (sumImpr / 1000) : 0,
  };

  // 5. Calculate Campaign Breakdown
  const campaignBreakdown: any = {};
  let globalUnmappedCampaigns = 0;
  for (const ad of searchFilteredAds) {
    const kurs = ad.kurs || 16000;
    const cId = ad.campaign_id;
    if (!cId) {
       globalUnmappedCampaigns++;
       continue;
    }
    if (!campaignBreakdown[cId]) {
      campaignBreakdown[cId] = { name: '', spend: 0, gmv: 0, impressions: 0, purchases: 0, unmapped: 0 };
    }
    campaignBreakdown[cId].spend += ad.cost_usd * kurs;
    campaignBreakdown[cId].gmv += ad.gross_revenue_usd * kurs;
    campaignBreakdown[cId].impressions += ad.impressions;
    campaignBreakdown[cId].purchases += ad.purchases || 0;
    if (!ad.creator_id || !ad.campaign_ads_name) {
      campaignBreakdown[cId].unmapped++;
    }
  }

  const list = Object.entries(campaignBreakdown).map(([id, data]: any) => ({ id: Number(id), ...data }));
  list.sort((a, b) => b.gmv - a.gmv);

  // 6. Sort
  filteredData.sort((a, b) => {
    let valA = a[params.sortKey];
    let valB = b[params.sortKey];
    if (params.sortKey === 'tanggal') {
      valA = new Date(valA || 0).getTime(); valB = new Date(valB || 0).getTime();
    } else if (params.sortKey === 'creator_id') {
      valA = a.creators?.username || ''; valB = b.creators?.username || '';
    } else if (['cost_usd', 'gross_revenue_usd', 'kurs', 'impressions', 'clicks', 'purchases'].includes(params.sortKey)) {
      valA = Number(valA || 0); valB = Number(valB || 0);
    } else {
      valA = String(valA || ''); valB = String(valB || '');
    }
    if (valA < valB) return params.sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return params.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // 7. Return all filtered data so frontend can group it and paginate the DOM
  return {
    summary,
    campaignBreakdown: { list, globalUnmappedCampaigns },
    globalUnmappedCampaigns,
    data: filteredData
  };
}
