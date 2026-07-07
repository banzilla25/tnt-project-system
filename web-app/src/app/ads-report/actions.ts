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

  // Calculate Lifetime (Cumulative)
  const enrichedData = [];
  for (const key in adsByAdId) {
    const rows = adsByAdId[key];
    // Rows are already ordered by tanggal ASC
    let lifetime_cost = 0;
    let lifetime_rev = 0;
    let lifetime_imp = 0;
    let lifetime_clicks = 0;
    let lifetime_ppv = 0;
    let lifetime_checkouts = 0;
    let lifetime_purchases = 0;
    let lifetime_items = 0;

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
      
      lifetime_cost += cost;
      lifetime_rev += rev;
      lifetime_imp += imp;
      lifetime_clicks += clicks;
      lifetime_ppv += ppv;
      lifetime_checkouts += checkouts;
      lifetime_purchases += purchases;
      lifetime_items += items;

      const enrichedRow = {
        ...row,
        lifetime_cost_usd: lifetime_cost,
        lifetime_gross_revenue_usd: lifetime_rev,
        lifetime_impressions: lifetime_imp,
        lifetime_clicks: lifetime_clicks,
        lifetime_product_page_views: lifetime_ppv,
        lifetime_checkouts_initiated: lifetime_checkouts,
        lifetime_purchases: lifetime_purchases,
        lifetime_items_purchased: lifetime_items,
      };

      enrichedData.push(enrichedRow);
    }
  }

  // 3. Apply Filters
  let filteredData = enrichedData;
  
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

  // Fetch campaigns to map names
  const { data: campaignsData } = await supabase.from('campaigns').select('id, nama');
  const campaignNames: Record<number, string> = {};
  if (campaignsData) {
    campaignsData.forEach(c => {
      campaignNames[c.id] = c.nama;
    });
  }

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
      campaignBreakdown[cId] = { name: campaignNames[cId] || 'Unknown Campaign', spend: 0, gmv: 0, impressions: 0, clicks: 0, purchases: 0, unmapped: 0, spend_usd: 0 };
    }
    campaignBreakdown[cId].spend += ad.cost_usd * kurs;
    campaignBreakdown[cId].spend_usd += ad.cost_usd;
    campaignBreakdown[cId].gmv += ad.gross_revenue_usd * kurs;
    campaignBreakdown[cId].impressions += ad.impressions;
    campaignBreakdown[cId].clicks += ad.clicks || 0;
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

  // 7. Calculate Lifetime Budget Balances for Campaigns
  const { data: allocations } = await supabase.from('ads_allocations').select('campaign_id, alokasi_usd');
  const { data: allSpend } = await supabase.from('ads_performance').select('campaign_id, cost_usd');
  
  const budgetBalances: Record<number, { allocated: number, spent: number, remaining: number }> = {};
  
  if (allocations) {
    for (const alloc of allocations) {
      const cId = alloc.campaign_id;
      if (!budgetBalances[cId]) budgetBalances[cId] = { allocated: 0, spent: 0, remaining: 0 };
      budgetBalances[cId].allocated += Number(alloc.alokasi_usd || 0);
    }
  }
  
  if (allSpend) {
    for (const spend of allSpend) {
      const cId = spend.campaign_id;
      if (!cId) continue;
      if (!budgetBalances[cId]) budgetBalances[cId] = { allocated: 0, spent: 0, remaining: 0 };
      budgetBalances[cId].spent += Number(spend.cost_usd || 0);
    }
  }
  
  for (const cId in budgetBalances) {
    budgetBalances[cId].remaining = budgetBalances[cId].allocated - budgetBalances[cId].spent;
  }

  // 8. Return all filtered data so frontend can group it and paginate the DOM
  return {
    summary,
    campaignBreakdown: { list, globalUnmappedCampaigns },
    globalUnmappedCampaigns,
    budgetBalances,
    data: filteredData
  };
}
