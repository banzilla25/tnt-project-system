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

export async function getInternalVideoData(campaignId: number, searchKeyword: string = '') {
  // 1. Fetch Campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) return null;
  
  // 2. Build creator query with only necessary fields (high performance)
  let creatorsQuery = supabase
    .from('campaign_creators')
    .select('*, creators!inner(id, username, nama_asli, creator_contacts(nomor, status)), videos(*)')
    .eq('campaign_id', campaignId)
    .eq('approval', 'approved');

  if (campaign.require_client_approval) {
    creatorsQuery = creatorsQuery.in('client_approval', ['approved', 'not_required']);
  }

  if (searchKeyword && searchKeyword.trim() !== '') {
    creatorsQuery = creatorsQuery.ilike('creators.username', `%${searchKeyword.trim()}%`);
  }

  creatorsQuery = creatorsQuery.order('id', { ascending: false }).range(0, 1999);

  // 3. Fetch all dependent data concurrently in parallel
  const [skusRes, videoStatsRes, orgDataRes, creatorsRes] = await Promise.all([
    supabase.from('skus').select('*').eq('campaign_id', campaignId),
    supabase.rpc('get_campaign_video_stats', { p_campaign_id: campaignId }),
    supabase.from('organic_videos').select('content_uid, post_time').eq('campaign_id', campaignId),
    creatorsQuery
  ]);

  const skus = skusRes.data || [];
  const campaignSkuSet = new Set(skus.map((s: any) => s.product_id).filter(Boolean));
  let statsList: any[] = videoStatsRes.data || [];

  // Gatekeeper SKU rules
  if (skus.length === 0) {
    // If campaign has 0 SKUs, all video stats are strictly 0 / empty
    statsList = [];
  } else if (campaignSkuSet.size > 0) {
    // Only count stats matching campaign SKUs
    statsList = statsList.filter((s: any) => !s.product_id || campaignSkuSet.has(s.product_id));
  }

  const allResults: any[] = creatorsRes.data || [];

  // Map SKU IDs to DB videos
  const allVideosFromDb = allResults.flatMap((cc: any) => cc.videos || []).map((v: any) => {
    if (!v.sku_id && v.content_uid) {
       const matchingStat = statsList.find((s: any) => s.content_uid === v.content_uid);
       if (matchingStat && matchingStat.product_id) {
          const matchingSku = skus.find((sku: any) => sku.product_id === matchingStat.product_id && sku.campaign_id === campaignId);
          if (matchingSku) {
             return { ...v, sku_id: matchingSku.id };
          }
       }
    }
    return v;
  });

  // Auto-detect videos from sales (strictly respecting campaign SKUs)
  const autoVideos: any[] = [];
  if (skus.length > 0 && statsList.length > 0) {
    allResults.forEach((cc: any) => {
      const creator = cc.creators;
      if (!creator) return;

      const creatorStats = statsList.filter((s: any) => s.username === creator.username.toLowerCase());

      creatorStats.forEach((s: any) => {
        const vid = s.content_uid;
        if (!vid) return;

        const existsInDb = allVideosFromDb.some((v: any) => 
            v.campaign_creator_id === cc.id && 
            (v.content_uid === vid || v.vt_code === vid)
        );

        if (!existsInDb) {
            const matchingSku = skus.find((sku: any) => sku.product_id === s.product_id && sku.campaign_id === campaignId);
            if (matchingSku) {
              autoVideos.push({
                id: `auto_${vid}`,
                campaign_creator_id: cc.id,
                urutan: 999, // Re-assigned sequentially in frontend
                concept: 'Auto-detected from Sales CSV',
                link_video: `https://www.tiktok.com/@${creator.username}/video/${vid}`,
                content_uid: vid,
                sku_id: matchingSku.id,
                vt_approval: 'approved'
              });
            }
        }
      });
    });
  }

  const allVideos = [...allVideosFromDb, ...autoVideos];

  // Map post_time from organic_videos
  const orgData = orgDataRes.data || [];
  const postTimeMap = new Map<string, string>();
  orgData.forEach((o: any) => {
    if (o.content_uid && o.post_time) postTimeMap.set(o.content_uid, o.post_time);
  });

  allVideos.forEach(v => {
    if (v.content_uid && postTimeMap.has(v.content_uid)) {
      v.post_time = postTimeMap.get(v.content_uid);
    }
  });

  const listingData = allResults.map((cc: any) => ({
      ...cc,
      _videoStats: statsList.filter((s: any) => s.username === cc.creators?.username?.toLowerCase())
  }));

  return {
    campaign,
    allVideos,
    listingData
  };
}
