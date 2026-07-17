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

export async function getInternalPerformaData(campaignId: number) {
  // 1. Fetch Campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) return null;

  // 2. Fetch RPC untuk Global Cards
  const { data: rpcPerformance } = await supabase
    .rpc('get_campaign_performance', { p_campaign_id: campaignId });

  // 3. Fetch creators (Approved & Pending) paginated
  let ccData: any[] = [];
  let start = 0;
  const pageSize = 500;
  
  while (true) {
    const { data, error } = await supabase
      .from('campaign_creators')
      .select(`
        *,
        creators(username, nama_asli, link_account, creator_snapshots(followers, level, tier)),
        videos(id, link_video, content_uid, vt_approval, urutan)
      `)
      .eq('campaign_id', campaignId)
      .in('approval', ['approved', 'pending'])
      .range(start, start + pageSize - 1);

    if (error || !data || data.length === 0) break;
    ccData = ccData.concat(data);
    if (data.length < pageSize) break;
    start += pageSize;
  }
  
  // 4. Fetch performa summary dari SQL View
  let creatorPerformance: any[] = [];
  let cpStart = 0;
  while (true) {
    const { data, error } = await supabase
      .from('campaign_creators_performance')
      .select('*')
      .eq('campaign_id', campaignId)
      .range(cpStart, cpStart + pageSize - 1);
    
    if (error || !data || data.length === 0) break;
    creatorPerformance = creatorPerformance.concat(data);
    if (data.length < pageSize) break;
    cpStart += pageSize;
  }

  // 5. Fetch video GMV for accurate VT/Live count
  const { data: videoGmvData } = await supabase
    .rpc('get_campaign_video_gmv', { p_campaign_id: campaignId });

  // 5.5 Fetch Ads Performance and aggregate by latest date per ad_id
  const { data: rawAdsData } = await supabase
    .from('ads_performance')
    .select('*')
    .eq('campaign_id', campaignId);
    
  const latestAdsMap = new Map();
  if (rawAdsData) {
    for (const row of rawAdsData) {
      const existing = latestAdsMap.get(row.ad_id);
      if (!existing || new Date(row.tanggal) > new Date(existing.tanggal)) {
        latestAdsMap.set(row.ad_id, row);
      }
    }
  }
  
  // Aggregate cost and gmv per creator_id
  const adsStatsByCreator: Record<number, { gmvAds: number, costAds: number }> = {};
  for (const ad of latestAdsMap.values()) {
    if (ad.creator_id) {
      if (!adsStatsByCreator[ad.creator_id]) {
        adsStatsByCreator[ad.creator_id] = { gmvAds: 0, costAds: 0 };
      }
      const kurs = ad.kurs || 16000;
      adsStatsByCreator[ad.creator_id].gmvAds += (ad.gross_revenue_usd || 0) * kurs;
      adsStatsByCreator[ad.creator_id].costAds += (ad.cost_usd || 0) * kurs;
    }
  }

  // 6. Enrichment
  const baseCreatorStats = ccData.map((cc: any) => {
    const creator = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
    const snap = creator?.creator_snapshots 
      ? (Array.isArray(creator.creator_snapshots) ? creator.creator_snapshots[0] : creator.creator_snapshots)
      : null;
    const username = creator?.username || 'Unknown';

    const perf = creatorPerformance?.find(p => p.campaign_creator_id === cc.id);

    const gmvOrganic = perf?.gmv_organic || 0;
    const itemsSold = perf?.items_sold || 0;
    const videoViews = perf?.video_views || 0;
    const videoLikes = perf?.video_likes || 0;
    const trackedVideos = perf?.tracked_videos || 0;
    
    // Use the correctly aggregated Ads Stats instead of the SQL View's inaccurate sum
    const aggregatedAds = adsStatsByCreator[creator?.id] || { gmvAds: 0, costAds: 0 };
    const gmvAds = aggregatedAds.gmvAds;
    const costAds = aggregatedAds.costAds;
    
    const totalGmv = gmvOrganic + gmvAds;
    const roas = costAds > 0 ? (gmvAds / costAds).toFixed(2) : '-';

    // Calculate Total VT and Total Live mimicking the Internal Dashboard logic
    const autoSalesVideos = videoGmvData?.filter((v: any) => v.creator_username === username) || [];
    const dbVideos = cc.videos || [];
    const uniqueVideoIds = new Map<string, string>(); 
    const uniqueLiveIds = new Set<string>();

    dbVideos.forEach((v: any) => {
      const id = v.content_uid;
      if (id) {
          uniqueVideoIds.set(id, v.vt_approval || 'approved');
      }
    });

    autoSalesVideos.forEach((s: any) => {
       let vid = s.content_uid;
       if (vid && vid.startsWith('video_')) {
         const parts = vid.split('_');
         if (parts.length >= 2) {
           vid = parts[1];
         }
       }
       if (vid) {
         if (s.content_type === 'Livestream') {
           uniqueLiveIds.add(vid);
         } else {
           if (!uniqueVideoIds.has(vid)) {
               uniqueVideoIds.set(vid, 'approved');
           }
         }
       }
    });

    let approvedVtCount = 0;
    let pendingVtCount = 0;
    
    if (cc.approval === 'pending') {
        pendingVtCount = Math.max(trackedVideos, uniqueVideoIds.size);
    } else {
        approvedVtCount = Math.max(trackedVideos, uniqueVideoIds.size);
        pendingVtCount = 0;
    }

    const totalVt = approvedVtCount + pendingVtCount;
    const totalLive = uniqueLiveIds.size;

    return {
      ...cc,
      username,
      followers: snap?.followers || 0,
      gmvOrganic,
      gmvAds,
      costAds,
      roas,
      totalGmv,
      itemsSold,
      videoViews,
      videoLikes,
      totalVt,
      totalLive
    };
  });

  return {
    campaign,
    rpcPerformance: Array.isArray(rpcPerformance) ? rpcPerformance[0] : rpcPerformance,
    baseCreatorStats
  };
}
