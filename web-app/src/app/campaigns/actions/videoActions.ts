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

  const creatorUsernames = allResults.map((cc: any) => cc.creators?.username).filter(Boolean);
  let localSalesData: any[] = [];
  let localOrganicVideos: any[] = [];

  const CHUNK_SIZE = 300;
  for (let i = 0; i < creatorUsernames.length; i += CHUNK_SIZE) {
    const chunk = creatorUsernames.slice(i, i + CHUNK_SIZE);
    
    if (chunk.length > 0) {
      let sQuery = supabase
        .from('sales')
        .select('id, campaign_id, creator_username, content_uid, gmv, quantity, raw_data, product_id, tanggal')
        .eq('campaign_id', campaignId)
        .in('creator_username', chunk);

      if (campaign.start_date) sQuery = sQuery.gte('tanggal', campaign.start_date);
      if (campaign.end_date && campaign.status === 'selesai') sQuery = sQuery.lte('tanggal', campaign.end_date);

      const { data: sData } = await sQuery;
      if (sData) localSalesData.push(...sData);

      let oQuery = supabase
        .from('organic_videos')
        .select('*')
        .in('creator_username', chunk);
        
      if (campaign.start_date) oQuery = oQuery.gte('post_time', campaign.start_date);
      if (campaign.end_date && campaign.status === 'selesai') oQuery = oQuery.lte('post_time', campaign.end_date);

      const { data: oData } = await oQuery;
      if (oData) localOrganicVideos.push(...oData);
    }
  }

  const allVideosFromDb = allResults.flatMap((cc: any) => cc.videos || []).map((v: any) => {
    if (!v.sku_id && v.content_uid) {
       const matchingSale = localSalesData.find(s => 
          (s.content_uid === v.content_uid || s.content_uid === `video_${v.content_uid}`) && s.product_id
       );
       if (matchingSale) {
          const matchingSku = skus?.find(sku => sku.product_id === matchingSale.product_id && sku.campaign_id === campaignId);
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
    
    const creatorSales = localSalesData.filter((s: any) => s.creator_username === creator.username && s.content_uid);
    const uniqueVideoIds = new Set<string>();
    
    creatorSales.forEach((s: any) => {
      let vid = s.content_uid;
      if (vid && vid.startsWith('video_')) {
        const parts = vid.split('_');
        if (parts.length >= 2) vid = parts[1];
      }

      if (vid && !uniqueVideoIds.has(vid)) {
        uniqueVideoIds.add(vid);
        
        // Check if exists in db using the true video ID or vt_code
        const existsInDb = allVideosFromDb.some((v: any) => 
           v.campaign_creator_id === cc.id && 
           (v.content_uid === vid || v.vt_code === vid || v.content_uid === s.content_uid)
        );
        
        if (!existsInDb) {
           // Try to match product_id from sales to skus table
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
      }
    });
  });

  const allVideos = [...allVideosFromDb, ...autoVideos];

  const listingData = allResults.map((cc: any) => ({
      ...cc,
      _localSales: localSalesData.filter((s: any) => s.creator_username === cc.creators?.username),
      _localOrganicVideos: localOrganicVideos.filter((v: any) => v.creator_username === cc.creators?.username)
  }));

  return {
    campaign,
    allVideos,
    listingData
  };
}
