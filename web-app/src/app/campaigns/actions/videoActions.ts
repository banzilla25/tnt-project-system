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
  
  // 2. Fetch SKUs
  const { data: skus } = await supabase
    .from('skus')
    .select('*')
    .eq('campaign_id', campaignId);

  // 3. Fetch creators (Approved & Pending based on client_approval)
  let baseQuery = supabase
    .from('campaign_creators')
    .select('*, creators!inner(*, creator_contacts(nomor, status), creator_snapshots(id, level, followers, gmv_30d, tanggal_update, created_at)), videos(*)')
    .eq('campaign_id', campaignId)
    .eq('approval', 'approved');
    
  let countQuery = supabase
    .from('campaign_creators')
    .select('id, creators!inner(username)', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('approval', 'approved');

  if (campaign.require_client_approval) {
    baseQuery = baseQuery.in('client_approval', ['approved', 'not_required']);
    countQuery = countQuery.in('client_approval', ['approved', 'not_required']);
  }

  if (searchKeyword) {
    baseQuery = baseQuery.ilike('creators.username', `%${searchKeyword}%`);
    countQuery = countQuery.ilike('creators.username', `%${searchKeyword}%`);
  }

  const { count } = await countQuery;
  let allResults: any[] = [];
  
  if (count && count > 0) {
    const promises = [];
    for (let i = 0; i < count; i += 1000) {
      promises.push(
         supabase
          .from('campaign_creators')
          .select('*, creators!inner(*, creator_contacts(nomor, status), creator_snapshots(id, level, followers, gmv_30d, tanggal_update, created_at)), videos(*)')
          .eq('campaign_id', campaignId)
          .eq('approval', 'approved')
          // apply filters again since we create new query instances
          .in('client_approval', campaign.require_client_approval ? ['approved', 'not_required'] : ['approved', 'not_required', 'pending', 'rejected'])
          // searchKeyword ilike
          .ilike('creators.username', searchKeyword ? `%${searchKeyword}%` : '%')
          .order('id', { ascending: false })
          .range(i, i + 999)
      );
    }
    const results = await Promise.all(promises);
    results.forEach(res => {
      if (res.data) allResults = allResults.concat(res.data);
    });
  }

  const { data: videoStats } = await supabase.rpc('get_campaign_video_stats', { p_campaign_id: campaignId });
  const statsList = videoStats || [];

  const allVideosFromDb = allResults.flatMap((cc: any) => cc.videos || []).map((v: any) => {
    if (!v.sku_id && v.content_uid) {
       const matchingStat = statsList.find((s: any) => s.content_uid === v.content_uid);
       if (matchingStat && matchingStat.product_id) {
          const matchingSku = skus?.find(sku => sku.product_id === matchingStat.product_id && sku.campaign_id === campaignId);
          if (matchingSku) {
             return { ...v, sku_id: matchingSku.id };
          }
       }
    }
    return v;
  });
  
  // Auto-detect videos from sales
  const autoVideos: any[] = [];
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
          const matchingSku = skus?.find(sku => sku.product_id === s.product_id && sku.campaign_id === campaignId);
          
          autoVideos.push({
            id: `auto_${vid}`,
            campaign_creator_id: cc.id,
            urutan: 999, // Will be re-assigned later
            concept: 'Auto-detected from Sales CSV',
            link_video: `https://www.tiktok.com/@${creator.username}/video/${vid}`,
            content_uid: vid,
            sku_id: matchingSku ? matchingSku.id : null,
            vt_approval: 'approved'
          });
      }
    });
  });

  const allVideos = [...allVideosFromDb, ...autoVideos];

  // Fetch post_time from organic_videos
  const { data: orgData } = await supabase
    .from('organic_videos')
    .select('content_uid, post_time')
    .eq('campaign_id', campaignId);
    
  const postTimeMap = new Map();
  (orgData || []).forEach((o: any) => {
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
