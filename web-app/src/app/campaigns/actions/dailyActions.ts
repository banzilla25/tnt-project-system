'use server'

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, cache: 'no-store' });
    }
  }
});

export async function getDailyData(campaignId: number) {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) return null;

  let allSales: any[] = [];
  let allVideosFromCreators: any[] = [];
  
  const isAwareness = campaign.tipe_campaign === 'awareness';
  const isHybrid = campaign.tipe_campaign === 'gmv_awareness';

  // 1. Fetch Sales
  let from = 0;
  let to = 999;
  let hasMore = true;
  while (hasMore) {
    const { data: salesData, error } = await supabase
      .from('sales')
      .select('tanggal, gmv, creator_username, content_uid')
      .eq('campaign_id', campaignId)
      .eq('is_refund', false)
      .range(from, to);

    if (error) {
      console.error("Error fetching sales:", error);
      break;
    }

    if (salesData && salesData.length > 0) {
      allSales = [...allSales, ...salesData];
      if (salesData.length < 1000) {
        hasMore = false;
      } else {
        from += 1000;
        to += 1000;
      }
    } else {
      hasMore = false;
    }
  }

  // 2. Fetch Videos (for Awareness / Hybrid)
  if (isAwareness || isHybrid) {
    let from = 0;
    let to = 999;
    let hasMore = true;
    while (hasMore) {
      const { data: ccData, error } = await supabase
        .from('campaign_creators')
        .select('id, approved_at, creators(username), videos(id, created_at, link_video)')
        .eq('campaign_id', campaignId)
        .range(from, to);

      if (error) {
        console.error("Error fetching creators for videos:", error);
        break;
      }

      if (ccData && ccData.length > 0) {
        allVideosFromCreators = [...allVideosFromCreators, ...ccData];
        if (ccData.length < 1000) {
          hasMore = false;
        } else {
          from += 1000;
          to += 1000;
        }
      } else {
        hasMore = false;
      }
    }
  }

  // Group by Date and Month
  const grouped: Record<string, { gmv: number; creators: Set<string>; videos: Set<string> }> = {};
  const monthlyGrouped: Record<string, { gmv: number; creators: Set<string>; videos: Set<string> }> = {};

  const campaignStartStr = campaign.start_date || '';
  const campaignEndStr = campaign.status === 'selesai' ? campaign.end_date || '' : '';

  if (allSales.length > 0) {
    allSales.forEach(sale => {
      if (!sale.tanggal) return;
      // Extract YYYY-MM-DD
      const dateStr = sale.tanggal.substring(0, 10);
      
      if (campaignStartStr && dateStr < campaignStartStr) return;
      if (campaignEndStr && dateStr > campaignEndStr) return;

      if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, creators: new Set(), videos: new Set() };
      grouped[dateStr].gmv += (sale.gmv || 0);
      if (sale.creator_username) grouped[dateStr].creators.add(sale.creator_username);
      if (sale.content_uid) grouped[dateStr].videos.add(sale.content_uid);

      // Extract YYYY-MM
      const monthStr = sale.tanggal.substring(0, 7);
      if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, creators: new Set(), videos: new Set() };
      monthlyGrouped[monthStr].gmv += (sale.gmv || 0);
      if (sale.creator_username) monthlyGrouped[monthStr].creators.add(sale.creator_username);
      if (sale.content_uid) monthlyGrouped[monthStr].videos.add(sale.content_uid);
    });
  }

  if ((isAwareness || isHybrid) && allVideosFromCreators.length > 0) {
    allVideosFromCreators.forEach(cc => {
      const username = cc.creators?.username || 'unknown';
      
      // Hitung Creator berdasarkan approved_at
      if (cc.approved_at) {
        const approvedDateStr = cc.approved_at.substring(0, 10);
        
        let countCreator = true;
        if (campaignStartStr && approvedDateStr < campaignStartStr) countCreator = false;
        if (campaignEndStr && approvedDateStr > campaignEndStr) countCreator = false;
        
        if (countCreator) {
          if (!grouped[approvedDateStr]) grouped[approvedDateStr] = { gmv: 0, creators: new Set(), videos: new Set() };
          grouped[approvedDateStr].creators.add(username);

          const monthStr = cc.approved_at.substring(0, 7);
          if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, creators: new Set(), videos: new Set() };
          monthlyGrouped[monthStr].creators.add(username);
        }
      }

      // Hitung Video berdasarkan created_at (custom report post date)
      if (!cc.videos || cc.videos.length === 0) return;
      
      cc.videos.forEach((v: any) => {
        if (!v.created_at || !v.link_video) return; 
        
        const dateStr = v.created_at.substring(0, 10);
        
        if (campaignStartStr && dateStr < campaignStartStr) return;
        if (campaignEndStr && dateStr > campaignEndStr) return;
        
        if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, creators: new Set(), videos: new Set() };
        grouped[dateStr].videos.add(v.id.toString());

        const monthStr = v.created_at.substring(0, 7);
        if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, creators: new Set(), videos: new Set() };
        monthlyGrouped[monthStr].videos.add(v.id.toString());
      });
    });
  }

  const formattedDaily = Object.keys(grouped).map(date => ({
    date,
    gmvOrganic: grouped[date].gmv,
    totalCreators: grouped[date].creators.size,
    totalVideos: grouped[date].videos.size
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formattedMonthly = Object.keys(monthlyGrouped).map(month => ({
    month,
    gmvOrganic: monthlyGrouped[month].gmv,
    totalCreators: monthlyGrouped[month].creators.size,
    totalVideos: monthlyGrouped[month].videos.size
  })).sort((a, b) => new Date(b.month + '-01').getTime() - new Date(a.month + '-01').getTime());

  return {
    campaign,
    dailyData: formattedDaily,
    monthlyData: formattedMonthly
  };
}
