'use server'

import { createClient } from "@supabase/supabase-js";
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, cache: 'no-store' });
    }
  }
});

export async function loginPortal(campaignId: number, pin: string) {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, pin')
    .eq('id', campaignId)
    .single();

  if (error || !campaign) {
    return { success: false, message: 'Campaign tidak ditemukan.' };
  }

  if (!campaign.pin) {
    return { success: false, message: 'Campaign ini belum dikonfigurasi dengan PIN akses Klien.' };
  }

  if (campaign.pin !== pin) {
    return { success: false, message: 'PIN salah.' };
  }

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set(`portal_pin_${campaignId}`, pin, {
    httpOnly: true,
    secure: false, // Set to false to support HTTP/Not Secure connections temporarily
    maxAge: 60 * 60 * 24 * 7, // 1 minggu
    path: '/'
  });

  return { success: true };
}

export async function logoutPortal(campaignId: number) {
  const cookieStore = await cookies();
  cookieStore.delete(`portal_pin_${campaignId}`);
  return { success: true };
}

export async function getPortalData(campaignId: number) {
  const cookieStore = await cookies();
  const pin = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  
  if (!pin) return { authenticated: false };

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign || campaign.pin !== pin) return { authenticated: false };

  // Fetch vw_campaign_summary (Tanpa financial internal)
  const { data: summary } = await supabase
    .from('vw_campaign_summary')
    .select('target_gmv, target_video, total_daily_organic, total_daily_vsa, total_gmv_achievement, achievement_video')
    .eq('campaign_id', campaignId)
    .single();

  // Fetch modern sales/awareness data from CSV imports
  const { data: totalSales } = await supabase
    .from('campaign_total_sales')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle();

  const { data: totalAwareness } = await supabase
    .from('campaign_total_awareness')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle();

  // Fetch daily performance
  const { data: dailyPerf } = await supabase
    .from('daily_performance')
    .select('date, organic_sales, vsa_sales')
    .eq('campaign_id', campaignId)
    .order('date', { ascending: true });

  // Fetch creators for Client Approval (hanya yang sudah disetujui internal TNT)
  let ccData: any[] = [];
  let start = 0;
  const pageSize = 500; // Reduce page size to avoid PostgREST join row explosion limit
  
  while (true) {
    const { data, error } = await supabase
      .from('campaign_creators')
      .select(`
        id, 
        creator_id,
        approval,
        client_approval, 
        notes_pic, 
        tier,
        content_type,
        sample_progress,
        creators(username, nama_asli, link_account, creator_snapshots(followers, level, tier), creator_contacts(nomor, status)),
        videos(id, link_video, content_uid, vt_approval, urutan)
      `)
      .eq('campaign_id', campaignId)
      .in('approval', ['approved', 'alternate'])
      .range(start, start + pageSize - 1);

    if (error || !data || data.length === 0) break;
    ccData = ccData.concat(data);
    if (data.length < pageSize) break;
    start += pageSize;
  }

  // Fetch raw sales for accurate GMV calculation with strict SKU and Date filtering (Paginated)
  let rawSales: any[] = [];
  let salesStart = 0;
  while (true) {
    let salesQuery = supabase
      .from('sales')
      .select('creator_username, gmv, quantity, product_id, is_refund, tanggal')
      .eq('campaign_id', campaignId)
      .eq('is_refund', false)
      .range(salesStart, salesStart + 999);
      
    if (campaign?.start_date) salesQuery = salesQuery.gte('tanggal', campaign.start_date);
    if (campaign?.end_date) salesQuery = salesQuery.lte('tanggal', campaign.end_date);
    
    const { data: pageSales } = await salesQuery;
    if (!pageSales || pageSales.length === 0) break;
    rawSales = rawSales.concat(pageSales);
    if (pageSales.length < 1000) break;
    salesStart += 1000;
  }

  // Fetch ads performance (Paginated)
  let adsPerf: any[] = [];
  let adsStart = 0;
  while (true) {
    const { data: pageAds } = await supabase
      .from('ads_performance')
      .select('creator_id, gross_revenue_usd, kurs')
      .eq('campaign_id', campaignId)
      .range(adsStart, adsStart + 999);
      
    if (!pageAds || pageAds.length === 0) break;
    adsPerf = adsPerf.concat(pageAds);
    if (pageAds.length < 1000) break;
    adsStart += 1000;
  }

  // Fetch sales for videos (Paginated)
  let salesForVideos: any[] = [];
  let svStart = 0;
  while (true) {
    const { data: pageSv } = await supabase
      .from('sales')
      .select('content_uid, gmv, creator_username, raw_data')
      .eq('campaign_id', campaignId)
      .not('content_uid', 'is', null)
      .range(svStart, svStart + 999);
      
    if (!pageSv || pageSv.length === 0) break;
    salesForVideos = salesForVideos.concat(pageSv);
    if (pageSv.length < 1000) break;
    svStart += 1000;
  }

  const videoGmvMap = new Map();
  const videoViewsMap = new Map();
  const videoLikesMap = new Map();

  salesForVideos?.forEach(s => {
    let vid = s.content_uid;
    if (vid && vid.startsWith('video_')) {
       vid = vid.split('_')[1];
    }
    if (vid) {
      videoGmvMap.set(vid, (videoGmvMap.get(vid) || 0) + s.gmv);
      
      const views = parseInt(s.raw_data?.['Video views']?.toString().replace(/[^0-9]/g, '')) || 0;
      const likes = parseInt(s.raw_data?.['Likes']?.toString().replace(/[^0-9]/g, '')) || parseInt(s.raw_data?.['Like']?.toString().replace(/[^0-9]/g, '')) || 0;
      
      if (views > (videoViewsMap.get(vid) || 0)) videoViewsMap.set(vid, views);
      if (likes > (videoLikesMap.get(vid) || 0)) videoLikesMap.set(vid, likes);
    }
  });

  // Fetch SKUs for dropdown and filtering
  const { data: skusData } = await supabase
    .from('skus')
    .select('id, product_id, nama_produk')
    .eq('campaign_id', campaignId);

  const salesMap = new Map();
  const itemsMap = new Map();
  
  rawSales?.forEach(s => {
    // Strict SKU filter sama seperti internal app
    if (s.product_id) {
       const matchingSku = skusData?.find((sku: any) => sku.product_id === s.product_id);
       if (!matchingSku) return; // Skip if product is not part of campaign SKUs
    } else {
       return; // Strict require product ID
    }

    if (!salesMap.has(s.creator_username)) {
      salesMap.set(s.creator_username, 0);
      itemsMap.set(s.creator_username, 0);
    }
    salesMap.set(s.creator_username, salesMap.get(s.creator_username) + (s.gmv || 0));
    itemsMap.set(s.creator_username, itemsMap.get(s.creator_username) + (s.quantity || 0));
  });

  const adsMap = new Map();
  adsPerf?.forEach(a => {
    if (!adsMap.has(a.creator_id)) adsMap.set(a.creator_id, 0);
    const rev = (a.gross_revenue_usd || 0) * (a.kurs || 0);
    adsMap.set(a.creator_id, adsMap.get(a.creator_id) + rev);
  });

  const enrichedCcData = ccData?.map((cc: any) => {
    const creator = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
    const snap = creator?.creator_snapshots 
      ? (Array.isArray(creator.creator_snapshots) ? creator.creator_snapshots[0] : creator.creator_snapshots)
      : null;
    const username = creator?.username || '';
    const creatorId = cc.creator_id;
    const contacts = Array.isArray(creator?.creator_contacts) ? creator.creator_contacts : (creator?.creator_contacts ? [creator.creator_contacts] : []);
    const activeContact = contacts.find((c: any) => c.status === 'aktif') || contacts[0];

    return {
      ...cc,
      followers: snap?.followers || 0,
      level: snap?.level || '-',
      tier: snap?.tier || cc.tier,
      no_whatsapp: activeContact?.nomor || '',
      gmv_organic: salesMap.get(username) || 0,
      items_sold: itemsMap.get(username) || 0,
      gmv_ads: adsMap.get(creatorId) || 0
    };
  }) || [];

  // Fetch creator addresses (Pengiriman sampel)
  // Karena tidak ada direct relation dari creator_addresses ke campaigns, kita ambil via campaign_creators
  const ccIdsForSamples = campaign.require_client_approval 
    ? enrichedCcData.filter((cc: any) => cc.client_approval === 'approved').map((cc: any) => cc.id)
    : enrichedCcData.map((cc: any) => cc.id);

  const { data: addrData } = await supabase
    .from('creator_addresses')
    .select(`
      id,
      campaign_creator_id,
      nama_penerima,
      nama_jalan,
      provinsi,
      kabupaten_kota,
      kecamatan,
      kelurahan,
      kode_pos,
      notes,
      resi,
      proses,
      produk_dikirim,
      tanggal_kirim,
      is_cancel
    `)
    .in('campaign_creator_id', ccIdsForSamples.length > 0 ? ccIdsForSamples : [0]);
  const samples = addrData?.filter((addr: any) => ccIdsForSamples.includes(addr.campaign_creator_id)).map((addr: any) => {
    const cc = enrichedCcData.find((c: any) => c.id === addr.campaign_creator_id);
    const creatorInfo = Array.isArray(cc?.creators) ? cc.creators[0] : cc?.creators;
    return {
      ...addr,
      creator_username: creatorInfo?.username || 'Unknown'
    };
  }) || [];

  const { data: liveData } = await supabase
    .from('live_schedules')
    .select(`
      id,
      campaign_creator_id,
      tanggal_live
    `)
    .in('campaign_creator_id', ccIdsForSamples.length > 0 ? ccIdsForSamples : [0]);
  
  const schedules = liveData?.filter((l: any) => ccIdsForSamples.includes(l.campaign_creator_id)).map((l: any) => {
    const cc = enrichedCcData.find((c: any) => c.id === l.campaign_creator_id);
    const creatorInfo = Array.isArray(cc?.creators) ? cc.creators[0] : cc?.creators;
    return {
      ...l,
      creator_username: creatorInfo?.username || 'Unknown'
    };
  }) || [];

  // Fetch SKUs for dropdown already done above

  // Extract videos and attach GMV (merging DB videos + organic auto-detected videos)
  const portalVideos: any[] = [];
  enrichedCcData.forEach((cc: any) => {
    const username = cc.creators?.username || 'Unknown';
    const creatorVideos: any[] = [];
    
    // 1. Add DB videos
    if (cc.videos && Array.isArray(cc.videos)) {
      cc.videos.forEach((v: any) => {
        let vid = v.content_uid;
        if (v.link_video && !vid) {
            const match = v.link_video.match(/video\/(\d+)/);
            if (match) vid = match[1];
        }
        creatorVideos.push({
          ...v,
          content_uid: vid,
          creator_username: username,
          gmv: videoGmvMap.get(vid) || 0,
          views: videoViewsMap.get(vid) || 0,
          likes: videoLikesMap.get(vid) || 0,
          isAuto: false
        });
      });
    }

    // 2. Add Auto-detected videos from sales
    const creatorSales = salesForVideos?.filter((s: any) => s.creator_username === username && s.content_uid) || [];
    const uniqueContentUids = new Set<string>();
    creatorSales.forEach((s: any) => {
       let vid = s.content_uid;
       if (vid && vid.startsWith('video_')) {
          vid = vid.split('_')[1];
       }
       if (vid && !uniqueContentUids.has(vid)) {
          uniqueContentUids.add(vid);
          // check if exists
          const exists = creatorVideos.some(v => v.content_uid === vid || v.vt_code === vid);
          if (!exists) {
             creatorVideos.push({
                id: `auto_${vid}`,
                content_uid: vid,
                link_video: `https://www.tiktok.com/@${username}/video/${vid}`,
                creator_username: username,
                gmv: videoGmvMap.get(vid) || 0,
                views: videoViewsMap.get(vid) || 0,
                likes: videoLikesMap.get(vid) || 0,
                isAuto: true
             });
          }
       }
    });

    if (creatorVideos.length > 0) {
      portalVideos.push({
        creator_username: username,
        total_videos: creatorVideos.length,
        total_gmv: creatorVideos.reduce((sum, v) => sum + (v.gmv || 0), 0),
        total_views: creatorVideos.reduce((sum, v) => sum + (v.views || 0), 0),
        total_likes: creatorVideos.reduce((sum, v) => sum + (v.likes || 0), 0),
        videos: creatorVideos
      });
    }
  });

  // Also attach campaign's target_creator to summary if missing, so progress bar shows up
  const finalSummary = summary || {};
  if (campaign && !finalSummary.target_creator) {
     finalSummary.target_creator = campaign.target_creator;
  }

  return { 
    authenticated: true, 
    campaign, 
    summary: finalSummary, 
    totalSales: totalSales || null,
    totalAwareness: totalAwareness || null,
    dailyPerf: dailyPerf || [], 
    approvalList: enrichedCcData, 
    samples,
    schedules,
    videos: portalVideos,
    skus: skusData || []
  };
}

export async function submitClientApproval(campaignId: number, campaignCreatorId: number, status: 'approved' | 'rejected') {
  const cookieStore = await cookies();
  const pin = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  if (!pin) throw new Error('Not authenticated');

  // Cek otorisasi
  const { data: campaign } = await supabase.from('campaigns').select('pin').eq('id', campaignId).single();
  if (!campaign || campaign.pin !== pin) throw new Error('Unauthorized');

  // Update
  const { error } = await supabase
    .from('campaign_creators')
    .update({ client_approval: status })
    .eq('id', campaignCreatorId)
    .eq('campaign_id', campaignId); // Proteksi tambahan

  if (error) throw error;
  return { success: true };
}

export async function updateResiByClient(campaignId: number, addressId: number, resi: string, proses: string, produk_dikirim?: string, notes?: string) {
  const cookieStore = await cookies();
  const pin = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  if (!pin) throw new Error('Not authenticated');

  // Cek otorisasi
  const { data: campaign } = await supabase.from('campaigns').select('pin').eq('id', campaignId).single();
  if (!campaign || campaign.pin !== pin) throw new Error('Unauthorized');

  // Verifikasi bahwa addressId ini benar-benar milik campaignId ini
  // (mencegah eksploitasi jika brand menginput addressId milik brand lain)
  const { data: addr } = await supabase
    .from('creator_addresses')
    .select('campaign_creators(campaign_id)')
    .eq('id', addressId)
    .single() as any;

  if (!addr || addr.campaign_creators?.campaign_id !== campaignId) {
    throw new Error('Unauthorized address modification');
  }

  const updatePayload: any = { 
    resi: resi, 
    proses: proses,
    tanggal_kirim: proses === 'Dikirim' ? new Date().toISOString() : undefined
  };
  
  if (produk_dikirim !== undefined) {
    updatePayload.produk_dikirim = produk_dikirim;
  }
  if (notes !== undefined) {
    updatePayload.notes = notes;
  }

  // Update
  const { error } = await supabase
    .from('creator_addresses')
    .update(updatePayload)
    .eq('id', addressId);

  if (error) throw error;
  return { success: true };
}

export type BatchUpdateData = {
  addressId: number;
  resi?: string;
  proses?: string;
  produk_dikirim?: string;
  notes?: string;
};

export async function batchUpdateResiByClient(campaignId: number, updates: BatchUpdateData[]) {
  if (!updates || updates.length === 0) return { success: true };

  const cookieStore = await cookies();
  const pin = cookieStore.get(`portal_pin_${campaignId}`)?.value;
  if (!pin) throw new Error('Not authenticated');

  // Cek otorisasi
  const { data: campaign } = await supabase.from('campaigns').select('pin').eq('id', campaignId).single();
  if (!campaign || campaign.pin !== pin) throw new Error('Unauthorized');

  // Ambil semua addressIds yang akan diupdate
  const addressIds = updates.map(u => u.addressId);

  // Verifikasi bahwa semua addressId ini benar-benar milik campaignId ini
  const { data: addrs } = await supabase
    .from('creator_addresses')
    .select('id, campaign_creators(campaign_id)')
    .in('id', addressIds);

  const invalidAddrs = addrs?.filter((a: any) => a.campaign_creators?.campaign_id !== campaignId) || [];
  if (invalidAddrs.length > 0 || (addrs && addrs.length !== addressIds.length)) {
    throw new Error('Unauthorized address modification detected in batch');
  }

  // Update batch sequentially
  // Supabase JS tidak punya upsert multiple fields gampang kecuali semua fields lengkap
  // Jadi kita loop dan update satu-satu secara berurutan. Karena jalan di server action (backend), latency db sangat kecil.
  for (const update of updates) {
    const updatePayload: any = {};
    if (update.resi !== undefined) updatePayload.resi = update.resi;
    if (update.proses !== undefined) {
      updatePayload.proses = update.proses;
      if (update.proses === 'Dikirim') {
        updatePayload.tanggal_kirim = new Date().toISOString();
      }
    }
    if (update.produk_dikirim !== undefined) updatePayload.produk_dikirim = update.produk_dikirim;
    if (update.notes !== undefined) updatePayload.notes = update.notes;

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from('creator_addresses')
        .update(updatePayload)
        .eq('id', update.addressId);
        
      if (error) throw error;
    }
  }

  return { success: true };
}
