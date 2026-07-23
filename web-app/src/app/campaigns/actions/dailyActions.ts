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

  // 1. Fetch Sales via RPC
  const { data: dailyStats, error: dsError } = await supabase.rpc('get_campaign_daily_stats', { p_campaign_id: campaignId });
  const allSalesStats = dailyStats || [];

  // 2. Fetch Videos (for all campaigns now, as requested)
  let from_v = 0;
  let to_v = 999;
  let hasMore_v = true;
  while (hasMore_v) {
    const { data: ccData, error } = await supabase
      .from('campaign_creators')
      .select('id, approved_at, creators(username), videos(id, created_at, link_video)')
      .eq('campaign_id', campaignId)
      .range(from_v, to_v);

    if (error) {
      console.error("Error fetching creators for videos:", error);
      break;
    }

    if (ccData && ccData.length > 0) {
      allVideosFromCreators = [...allVideosFromCreators, ...ccData];
      if (ccData.length < 1000) {
        hasMore_v = false;
      } else {
        from_v += 1000;
        to_v += 1000;
      }
    } else {
      hasMore_v = false;
    }
  }

  // 3. Fetch Ads Performance (for GMV Ads Delta)
  let allAds: any[] = [];
  let adsFrom = 0;
  let adsTo = 999;
  let adsHasMore = true;
  while (adsHasMore) {
    const { data: adsData, error } = await supabase
      .from('ads_performance')
      .select('ad_id, tanggal, gross_revenue_usd, kurs')
      .eq('campaign_id', campaignId)
      .order('tanggal', { ascending: true })
      .range(adsFrom, adsTo);

    if (error) {
      console.error("Error fetching ads:", error);
      break;
    }

    if (adsData && adsData.length > 0) {
      allAds = [...allAds, ...adsData];
      if (adsData.length < 1000) adsHasMore = false;
      else { adsFrom += 1000; adsTo += 1000; }
    } else {
      adsHasMore = false;
    }
  }

  // 4. Fetch Live Sessions via RPC (for accurate Sesi Live count)
  const { data: liveStats } = await supabase.rpc('get_campaign_live_stats', { p_campaign_id: campaignId });
  const allLiveSessions = liveStats || [];

  // Group by Date and Month
  const grouped: Record<string, { gmv: number; gmvAds: number; creators: Set<string>; videos: Set<string>; gmvLive: number; gmvVT: number; ordersLive: number; ordersVT: number; liveSessions: Set<string> }> = {};
  const monthlyGrouped: Record<string, { gmv: number; gmvAds: number; creators: Set<string>; videos: Set<string>; gmvLive: number; gmvVT: number; ordersLive: number; ordersVT: number; liveSessions: Set<string> }> = {};

  const campaignStartStr = campaign.start_date || '';
  const campaignEndStr = campaign.status === 'selesai' ? campaign.end_date || '' : '';

  if (allSalesStats.length > 0) {
    allSalesStats.forEach((stat: any) => {
      if (!stat.date_str) return;
      const dateStr = stat.date_str;
      
      if (campaignStartStr && dateStr < campaignStartStr) return;
      if (campaignEndStr && dateStr > campaignEndStr) return;

      if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
      
      grouped[dateStr].gmvLive += (stat.gmv_live || 0);
      grouped[dateStr].ordersLive += (stat.orders_live || 0);
      grouped[dateStr].gmvVT += (stat.gmv_vt || 0);
      grouped[dateStr].ordersVT += (stat.orders_vt || 0);
      grouped[dateStr].gmv += (stat.total_gmv || 0);
      
      if (stat.active_creators) stat.active_creators.forEach((c: string) => grouped[dateStr].creators.add(c));
      if (stat.active_videos) stat.active_videos.forEach((v: string) => grouped[dateStr].videos.add(v));

      const monthStr = dateStr.substring(0, 7);
      if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
      
      monthlyGrouped[monthStr].gmvLive += (stat.gmv_live || 0);
      monthlyGrouped[monthStr].ordersLive += (stat.orders_live || 0);
      monthlyGrouped[monthStr].gmvVT += (stat.gmv_vt || 0);
      monthlyGrouped[monthStr].ordersVT += (stat.orders_vt || 0);
      monthlyGrouped[monthStr].gmv += (stat.total_gmv || 0);
      
      if (stat.active_creators) stat.active_creators.forEach((c: string) => monthlyGrouped[monthStr].creators.add(c));
      if (stat.active_videos) stat.active_videos.forEach((v: string) => monthlyGrouped[monthStr].videos.add(v));
    });
  }

  if (allVideosFromCreators.length > 0) {
    allVideosFromCreators.forEach(cc => {
      const username = cc.creators?.username || 'unknown';
      
      // Hitung Creator berdasarkan approved_at
      if (cc.approved_at) {
        const approvedDateStr = cc.approved_at.substring(0, 10);
        
        let countCreator = true;
        if (campaignStartStr && approvedDateStr < campaignStartStr) countCreator = false;
        if (campaignEndStr && approvedDateStr > campaignEndStr) countCreator = false;
        
        if (countCreator) {
          if (!grouped[approvedDateStr]) grouped[approvedDateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
          grouped[approvedDateStr].creators.add(username);

          const monthStr = cc.approved_at.substring(0, 7);
          if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
          monthlyGrouped[monthStr].creators.add(username);
        }
      }

      // Hitung Video berdasarkan created_at (VT saja)
      if (!cc.videos || cc.videos.length === 0) return;
      
      cc.videos.forEach((v: any) => {
        if (!v.created_at || !v.link_video) return; 
        
        const dateStr = v.created_at.substring(0, 10);
        
        if (campaignStartStr && dateStr < campaignStartStr) return;
        if (campaignEndStr && dateStr > campaignEndStr) return;
        
        if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
        grouped[dateStr].videos.add(v.id.toString());

        const monthStr = v.created_at.substring(0, 7);
        if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
        monthlyGrouped[monthStr].videos.add(v.id.toString());
      });
    });
  }

  // Hitung Sesi Live dari RPC
  if (allLiveSessions.length > 0) {
    allLiveSessions.forEach((l: any) => {
      if (!l.start_time) return;
      
      // start_time is usually ISO string or timestamp
      const dateStr = String(l.start_time).substring(0, 10);
      
      if (campaignStartStr && dateStr < campaignStartStr) return;
      if (campaignEndStr && dateStr > campaignEndStr) return;
      
      if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
      if (l.content_uid) grouped[dateStr].liveSessions.add(l.content_uid);

      const monthStr = dateStr.substring(0, 7);
      if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
      if (l.content_uid) monthlyGrouped[monthStr].liveSessions.add(l.content_uid);
    });
  }

  // Calculate Ads Delta
  if (allAds.length > 0) {
    const previousAdValues: Record<string, number> = {};
    allAds.forEach(ad => {
      if (!ad.tanggal || !ad.ad_id) return;
      const dateStr = ad.tanggal.substring(0, 10);
      
      if (campaignStartStr && dateStr < campaignStartStr) return;
      if (campaignEndStr && dateStr > campaignEndStr) return;
      
      const currentGmv = ad.gross_revenue_usd || 0;
      const prevGmv = previousAdValues[ad.ad_id] || 0;
      const deltaUsd = currentGmv - prevGmv;
      
      if (deltaUsd > 0) {
        const kurs = (ad.kurs && ad.kurs < 1000) ? ad.kurs * 1000 : (ad.kurs || 16000);
        const deltaIdr = deltaUsd * kurs;
        
        if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
        grouped[dateStr].gmvAds += deltaIdr;
        
        const monthStr = dateStr.substring(0, 7);
        if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
        monthlyGrouped[monthStr].gmvAds += deltaIdr;
      }
      
      previousAdValues[ad.ad_id] = currentGmv;
    });
  }

  const formattedDaily = Object.keys(grouped).map(date => ({
    date,
    gmvOrganic: grouped[date].gmv,
    gmvLive: grouped[date].gmvLive,
    gmvVT: grouped[date].gmvVT,
    ordersLive: grouped[date].ordersLive,
    ordersVT: grouped[date].ordersVT,
    gmvAds: grouped[date].gmvAds,
    totalCreators: grouped[date].creators.size,
    totalVideos: grouped[date].videos.size,
    totalLiveSessions: grouped[date].liveSessions.size
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formattedMonthly = Object.keys(monthlyGrouped).map(month => ({
    month,
    gmvOrganic: monthlyGrouped[month].gmv,
    gmvLive: monthlyGrouped[month].gmvLive,
    gmvVT: monthlyGrouped[month].gmvVT,
    ordersLive: monthlyGrouped[month].ordersLive,
    ordersVT: monthlyGrouped[month].ordersVT,
    gmvAds: monthlyGrouped[month].gmvAds,
    totalCreators: monthlyGrouped[month].creators.size,
    totalVideos: monthlyGrouped[month].videos.size,
    totalLiveSessions: monthlyGrouped[month].liveSessions.size
  })).sort((a, b) => new Date(b.month + '-01').getTime() - new Date(a.month + '-01').getTime());

  return {
    campaign,
    dailyData: formattedDaily,
    monthlyData: formattedMonthly
  };
}
