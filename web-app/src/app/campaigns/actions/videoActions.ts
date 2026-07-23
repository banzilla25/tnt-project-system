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
  let query = supabase
    .from('campaign_creators')
    .select('*, creators!inner(*), videos(*)')
    .eq('campaign_id', campaignId)
    .eq('approval', 'approved');

  if (campaign.require_client_approval) {
    query = query.in('client_approval', ['approved', 'not_required']);
  }

  if (searchKeyword) {
    query = query.ilike('creators.username', `%${searchKeyword}%`);
  }

  let allResults: any[] = [];
  let currentFrom = 0;
  
  while (true) {
     const { data, error } = await query.order('id', { ascending: false }).range(currentFrom, currentFrom + 999);
     if (error || !data || data.length === 0) break;
     
     allResults = allResults.concat(data);
     if (data.length < 1000) break;
     currentFrom += 1000;
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
