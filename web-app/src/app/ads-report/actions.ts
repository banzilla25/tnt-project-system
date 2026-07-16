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
  
  // 1. Fetch data directly from the new PostgreSQL View `ads_performance_delta`
  // This view automatically computes delta_cost_usd, delta_gross_revenue_usd, etc. using LAG()
  let query = supabase
    .from('ads_performance_delta')
    .select('*, creators(username)');
    
  if (params.startDate) {
    query = query.gte('tanggal', params.startDate);
  }
  if (params.endDate) {
    query = query.lte('tanggal', params.endDate);
  }
  if (params.campaignId !== null && params.campaignId !== undefined) {
    query = query.eq('campaign_id', params.campaignId);
  }
  if (params.campaignAdsName) {
    query = query.eq('campaign_ads_name', params.campaignAdsName);
  }
  
  // Note: search query is handled in JS below because filtering by relations/OR across multiple columns 
  // can sometimes be tricky in PostgREST without specific text search configs.
  // Since we're only fetching a filtered date range, the row count is small enough for JS.

  const { data: rawFilteredData, error } = await query;
  if (error) throw error;
  
  if (!rawFilteredData || rawFilteredData.length === 0) {
    return { summary: { totalSpend: 0, totalGmv: 0, totalImpressions: 0, roas: 0, cpm: 0 }, data: [], campaignBreakdown: { list: [], globalUnmappedCampaigns: 0 }, budgetBalances: {} };
  }

  // 2. Apply Search Query Filter in memory
  let breakdownData = rawFilteredData;
  if (params.searchQuery) {
    const q = params.searchQuery.toLowerCase();
    breakdownData = breakdownData.filter(r => 
      (r.ad_name && r.ad_name.toLowerCase().includes(q)) || 
      (r.ad_id && r.ad_id.toLowerCase().includes(q))
    );
  }

  // Fetch campaigns to map names (Move this up so we can use it for breakdown)
  const { data: campaignsData } = await supabase.from('campaigns').select('id, nama');
  const campaignNames: Record<number, string> = {};
  if (campaignsData) {
    campaignsData.forEach(c => {
      campaignNames[c.id] = c.nama;
    });
  }

  // 3. Calculate Campaign Breakdown (using ALL campaigns matching date/search)
  const campaignBreakdown: Record<number, any> = {};
  let globalUnmappedCampaigns = 0;
  for (const ad of breakdownData) {
    const kurs = ad.kurs || 16000;
    const cId = ad.campaign_id;
    if (!cId) {
       globalUnmappedCampaigns++;
       continue;
    }
    if (!campaignBreakdown[cId]) {
      campaignBreakdown[cId] = { name: campaignNames[cId] || 'Unknown Campaign', spend: 0, gmv: 0, impressions: 0, clicks: 0, purchases: 0, unmapped: 0, spend_usd: 0 };
    }
    campaignBreakdown[cId].spend += (ad.delta_cost_usd || 0) * kurs;
    campaignBreakdown[cId].spend_usd += (ad.delta_cost_usd || 0);
    campaignBreakdown[cId].gmv += (ad.delta_gross_revenue_usd || 0) * kurs;
    campaignBreakdown[cId].impressions += (ad.delta_impressions || 0);
    campaignBreakdown[cId].clicks += (ad.delta_clicks || 0);
    campaignBreakdown[cId].purchases += (ad.delta_purchases || 0);
    if (!ad.creator_id || !ad.campaign_ads_name) {
      campaignBreakdown[cId].unmapped++;
    }
  }

  const list = Object.entries(campaignBreakdown).map(([id, data]: any) => ({ id: Number(id), ...data }));
  list.sort((a, b) => b.gmv - a.gmv);

  // 4. Apply Campaign ID filter for Table and Summary
  let tableData = breakdownData;
  if (params.campaignId !== null && params.campaignId !== undefined) {
    tableData = tableData.filter(r => r.campaign_id === params.campaignId);
  }

  // 5. Calculate Global Summary (using filtered tableData)
  let sumSpend = 0; let sumGmv = 0; let sumImpr = 0; let sumSpendUsd = 0;
  for (const ad of tableData) {
    const kurs = ad.kurs || 16000;
    sumSpend += (ad.delta_cost_usd || 0) * kurs;
    sumSpendUsd += (ad.delta_cost_usd || 0);
    sumGmv += (ad.delta_gross_revenue_usd || 0) * kurs;
    sumImpr += (ad.delta_impressions || 0);
  }
  const summary = {
    totalSpend: sumSpend,
    totalSpendUsd: sumSpendUsd,
    totalGmv: sumGmv,
    totalImpressions: sumImpr,
    roas: sumSpend > 0 ? sumGmv / sumSpend : 0,
    cpm: sumImpr > 0 ? sumSpend / (sumImpr / 1000) : 0,
  };

  // 6. Sort
  tableData.sort((a, b) => {
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

  // Calculate allocated budgets from `ads_allocations`
  const { data: budgetData } = await supabase.from('ads_allocations').select('*');
  const budgetBalances: Record<number, { allocated: number, remaining: number }> = {};
  
  if (budgetData) {
    list.forEach((camp: any) => {
      const campBudgets = budgetData.filter(b => b.campaign_id === camp.id);
      const allocated = campBudgets.reduce((sum, b) => sum + (Number(b.alokasi_usd) || 0), 0);
      const remaining = allocated - camp.spend_usd;
      budgetBalances[camp.id] = { allocated, remaining };
    });
  }

  return {
    summary,
    campaignBreakdown: { list, globalUnmappedCampaigns },
    budgetBalances,
    data: filteredData
  };
}
