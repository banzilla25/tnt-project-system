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
  // 1. Fetch Campaign, RPCs, and counts concurrently
  const [
    campaignRes,
    rpcPerfRes,
    creatorPerfRes,
    videoGmvRes,
    rawAdsRes,
    ccCountRes,
    vidCountRes
  ] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', campaignId).single(),
    supabase.rpc('get_campaign_performance', { p_campaign_id: campaignId }),
    supabase.rpc('get_campaign_creator_performance', { p_campaign_id: campaignId }),
    supabase.rpc('get_campaign_video_gmv', { p_campaign_id: campaignId }),
    supabase.from('ads_performance').select('*, creators(username)').eq('campaign_id', campaignId),
    supabase.from('campaign_creators').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).in('approval', ['approved', 'pending']),
    supabase.from('videos').select('id, campaign_creators!inner(campaign_id)', { count: 'exact', head: true }).eq('campaign_creators.campaign_id', campaignId)
  ]);

  const campaign = campaignRes.data;
  if (!campaign) return null;

  const rpcPerformance = rpcPerfRes.data;
  const creatorPerformance = creatorPerfRes.data;
  const videoGmvData = videoGmvRes.data;
  const rawAdsData = rawAdsRes.data;

  // 2. Fetch creators and videos in parallel batches (pageSize = 1000)
  const ccCount = ccCountRes.count || 0;
  const vidCount = vidCountRes.count || 0;
  const pageSize = 1000;

  const ccPromises = [];
  for (let i = 0; i < ccCount; i += pageSize) {
    ccPromises.push(
      supabase
        .from('campaign_creators')
        .select('id, creator_id, approval, created_at, approved_at, content_type, qty_vt, qty_live, creators(id, username, nama_asli, link_account)')
        .eq('campaign_id', campaignId)
        .in('approval', ['approved', 'pending'])
        .order('id', { ascending: true })
        .range(i, i + pageSize - 1)
    );
  }

  const vidPromises = [];
  for (let i = 0; i < vidCount; i += pageSize) {
    vidPromises.push(
      supabase
        .from('videos')
        .select('id, campaign_creator_id, content_uid, vt_approval, urutan, concept, link_video, campaign_creators!inner(campaign_id)')
        .eq('campaign_creators.campaign_id', campaignId)
        .order('id', { ascending: true })
        .range(i, i + pageSize - 1)
    );
  }

  const [ccResults, vidResults] = await Promise.all([
    Promise.all(ccPromises),
    Promise.all(vidPromises)
  ]);

  let ccData: any[] = [];
  ccResults.forEach(res => {
    if (res.data) ccData = ccData.concat(res.data);
  });

  let vidsData: any[] = [];
  vidResults.forEach(res => {
    if (res.data) vidsData = vidsData.concat(res.data);
  });

  // Map videos back to creators
  const videosByCcId = new Map<number, any[]>();
  for (const v of vidsData) {
    const list = videosByCcId.get(v.campaign_creator_id);
    if (list) list.push(v);
    else videosByCcId.set(v.campaign_creator_id, [v]);
  }
  for (const cc of ccData) {
    cc.videos = videosByCcId.get(cc.id) || [];
  }
    
  const latestAdsMap = new Map();
  if (rawAdsData) {
    for (const row of rawAdsData) {
      const existing = latestAdsMap.get(row.ad_id);
      if (!existing || new Date(row.tanggal) > new Date(existing.tanggal)) {
        latestAdsMap.set(row.ad_id, row);
      }
    }
  }
  
  // Aggregate cost and gmv per creator_id and global
  const adsStatsByCreator: Record<number, { gmvAds: number, costAds: number, itemsSoldAds: number }> = {};
  let globalAdsGmv = 0;
  let globalAdsGmvUsd = 0;
  let globalAdsSpend = 0;

  for (const ad of latestAdsMap.values()) {
    let kurs = ad.kurs || 16000;
    if (kurs < 1000) kurs = kurs * 1000;
    
    globalAdsGmv += (ad.gross_revenue_usd || 0) * kurs;
    globalAdsGmvUsd += (ad.gross_revenue_usd || 0);
    globalAdsSpend += (ad.cost_usd || 0);

    if (ad.creator_id) {
      if (!adsStatsByCreator[ad.creator_id]) {
        adsStatsByCreator[ad.creator_id] = { gmvAds: 0, costAds: 0, itemsSoldAds: 0 };
      }
      adsStatsByCreator[ad.creator_id].gmvAds += (ad.gross_revenue_usd || 0) * kurs;
      adsStatsByCreator[ad.creator_id].costAds += (ad.cost_usd || 0) * kurs;
      adsStatsByCreator[ad.creator_id].itemsSoldAds += (ad.purchases || 0);
    }
  }

  // 6. Enrichment
  const baseCreatorStats = ccData.map((cc: any) => {
    const creator = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
    const snap = creator?.creator_snapshots 
      ? (Array.isArray(creator.creator_snapshots) ? creator.creator_snapshots[0] : creator.creator_snapshots)
      : null;
    const username = creator?.username || 'Unknown';

    const perf = creatorPerformance?.find((p: any) => p.username === username.toLowerCase());

    const gmvOrganic = perf?.gmv_organic || 0;
    const itemsSold = perf?.items_sold || 0;
    const videoViews = perf?.video_views || 0;
    const videoLikes = perf?.video_likes || 0;
    const trackedVideos = perf?.video_count || 0;
    
    // Use the correctly aggregated Ads Stats instead of the SQL View's inaccurate sum
    const aggregatedAds = adsStatsByCreator[creator?.id] || { gmvAds: 0, costAds: 0, itemsSoldAds: 0 };
    const gmvAds = aggregatedAds.gmvAds;
    const costAds = aggregatedAds.costAds;
    const itemsSoldAds = aggregatedAds.itemsSoldAds || 0;
    
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
         if ((s.content_type || '').toLowerCase() === 'livestream' || (s.content_type || '').toLowerCase() === 'live') {
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
        pendingVtCount = Math.max(trackedVideos || 0, uniqueVideoIds.size);
    } else {
        approvedVtCount = Math.max(trackedVideos || 0, uniqueVideoIds.size);
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
      itemsSoldAds,
      videoViews,
      videoLikes,
      totalVt,
      totalLive
    };
  });

  return {
    campaign,
    rpcPerformance: Array.isArray(rpcPerformance) ? rpcPerformance[0] : rpcPerformance,
    baseCreatorStats,
    totalAdsGmv: globalAdsGmv,
    totalAdsGmvUsd: globalAdsGmvUsd,
    totalAdsSpend: globalAdsSpend,
    adsData: Array.from(latestAdsMap.values()),
  };
}
