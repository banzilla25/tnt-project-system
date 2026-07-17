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
      .in('approval', ['approved', 'pending'])
      .range(start, start + pageSize - 1);

    if (error || !data || data.length === 0) break;
    ccData = ccData.concat(data);
    if (data.length < pageSize) break;
    start += pageSize;
  }
  
  // Apply Global Creator Filter from Database
  if (campaign.creator_filter_type === 'include' || campaign.creator_filter_type === 'exclude') {
    const filteredUsernames = (campaign.creator_filter_usernames || '').split(/[\s,]+/).map((u: string) => u.trim().toLowerCase()).filter((u: string) => u);
    if (filteredUsernames.length > 0) {
      ccData = ccData.filter((cc: any) => {
        const creator = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
        const username = (creator?.username || '').toLowerCase();
        const match = filteredUsernames.includes(username);
        return campaign.creator_filter_type === 'include' ? match : !match;
      });
    }
  }
  
  // Fetch performa summary dari SQL View (Paginated to avoid timeout)
  let creatorPerformance: any[] = [];
  let cpStart = 0;
  const cpPageSize = 500;
  while (true) {
    const { data, error } = await supabase
      .from('campaign_creators_performance')
      .select('*')
      .eq('campaign_id', campaignId)
      .range(cpStart, cpStart + cpPageSize - 1);
    
    if (error || !data || data.length === 0) break;
    creatorPerformance = creatorPerformance.concat(data);
    if (data.length < cpPageSize) break;
    cpStart += cpPageSize;
  }

  // Fetch RPC untuk Global Cards
  const { data: rpcPerformance, error: rpcError } = await supabase
    .rpc('get_campaign_performance', { p_campaign_id: campaignId });

  if (rpcError) console.error("RPC Error:", rpcError);

  // Fetch sales for videos via new RPC (much faster than fetching all sales rows)
  const { data: videoGmvData } = await supabase
    .rpc('get_campaign_video_gmv', { p_campaign_id: campaignId });
    
  const videoGmvMap = new Map();
  videoGmvData?.forEach((s: any) => {
    if (s.content_uid) {
      videoGmvMap.set(s.content_uid, s.total_gmv);
    }
  });

  // Fetch SKUs for dropdown and filtering
  const { data: skusData } = await supabase
    .from('skus')
    .select('id, product_id, nama_produk')
    .eq('campaign_id', campaignId);

  // Hapus mapping rawSales dan adsPerf karena sudah dihandle oleh View
  const enrichedCcData = ccData?.map((cc: any) => {
    const creator = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
    const snap = creator?.creator_snapshots 
      ? (Array.isArray(creator.creator_snapshots) ? creator.creator_snapshots[0] : creator.creator_snapshots)
      : null;
    const username = creator?.username || '';
    const creatorId = cc.creator_id;
    const contacts = Array.isArray(creator?.creator_contacts) ? creator.creator_contacts : (creator?.creator_contacts ? [creator.creator_contacts] : []);
    const activeContact = contacts.find((c: any) => c.status === 'aktif') || contacts[0];

    const perf = creatorPerformance?.find(p => p.campaign_creator_id === cc.id);

    // Calculate Total VT and Total Live mimicking the Internal Dashboard logic
    const autoSalesVideos = videoGmvData?.filter((v: any) => v.creator_username === username) || [];
    const dbVideos = cc.videos || [];
    const uniqueVideoIds = new Map<string, string>(); 
    const uniqueLiveIds = new Set<string>();

    dbVideos.forEach((v: any) => {
      const id = v.vt_code || v.content_uid;
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
        pendingVtCount = Math.max(perf?.tracked_videos || 0, uniqueVideoIds.size);
    } else {
        approvedVtCount = Math.max(perf?.tracked_videos || 0, uniqueVideoIds.size);
        pendingVtCount = 0;
    }

    const totalVt = approvedVtCount + pendingVtCount;
    const totalLive = uniqueLiveIds.size;

    return {
      ...cc,
      followers: snap?.followers || 0,
      level: snap?.level || '-',
      tier: snap?.tier || cc.tier,
      no_whatsapp: activeContact?.nomor || '',
      gmv_organic: perf?.gmv_organic || 0,
      items_sold: perf?.items_sold || 0,
      gmv_ads: perf?.gmv_ads || 0,
      video_views: perf?.video_views || 0,
      video_likes: perf?.video_likes || 0,
      total_vt: totalVt,
      total_livestreams: totalLive
    };
  }) || [];

  // Fetch creator addresses (Pengiriman sampel)
  // Strict filter: only show if client_approval is 'approved' (if required) or 'NOT_REQUIRED' (if not required)
  // Also internal approval must be 'approved' (we fetched 'approved' and 'alternate', but for samples only 'approved' makes sense).
  // Wait, let's keep internal 'approved' or 'alternate' since they are in ccData, but strictly check client_approval.
  const ccIdsForSamples = campaign.require_client_approval 
    ? enrichedCcData.filter((cc: any) => cc.approval === 'approved' && cc.client_approval === 'approved').map((cc: any) => cc.id)
    : enrichedCcData.filter((cc: any) => cc.approval === 'approved').map((cc: any) => cc.id);

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
      is_cancel,
      resi_updated_at,
      resi_updated_by
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

  const validUsernames = enrichedCcData.filter((cc: any) => cc.client_approval === 'approved' || cc.approval === 'approved').map((cc: any) => cc.creators?.username).filter(Boolean);

  // Ambil semua sesi Live via RPC — jauh lebih efisien dari loop ribuan baris
  // RPC melakukan JOIN sales + organic_videos langsung di server DB
  const { data: rpcLives } = await supabase.rpc('get_campaign_live_stats', {
    p_campaign_id: campaignId,
  });
  const actualLives: any[] = Array.isArray(rpcLives) ? rpcLives : [];

  // videoViewsMap dan videoLikesMap masih diperlukan untuk Video tab (non-live)
  const videoViewsMap = new Map();
  const videoLikesMap = new Map();
  const organicVideoMap = new Map();

  // Ambil hanya organic_videos untuk Video tab (filter strict menggunakan campaign_id)
  let organicVideos: any[] = [];
  if (validUsernames.length > 0) {
    let query = supabase.from('organic_videos')
      .select('content_uid, creator_username, video_views, video_likes, duration_str, post_time')
      .eq('campaign_id', campaignId);
      
    if (campaign.start_date) query = query.gte('post_time', campaign.start_date);
    if (campaign.end_date) query = query.lte('post_time', `${campaign.end_date}T23:59:59Z`);
    
    // Pagination is usually not needed for a single campaign's organic videos, 
    // but just in case, PostgREST will return up to 1000 rows.
    // If a campaign has > 1000 organic videos, we might need pagination, but this is much safer than the N+1 chunk loop.
    const { data: ovs } = await query.limit(5000);
    
    // Filter by validUsernames in memory to ensure no leakage from unapproved creators
    if (ovs) {
      organicVideos = ovs.filter(v => validUsernames.includes(v.creator_username));
    }
  }

  const liveUids = new Set(actualLives.map((l: any) => l.content_uid).filter(Boolean));

  organicVideos.forEach(v => {
    if (v.content_uid) {
      videoViewsMap.set(v.content_uid, v.video_views || 0);
      videoLikesMap.set(v.content_uid, v.video_likes || 0);
      const isLive = liveUids.has(v.content_uid);
      organicVideoMap.set(v.content_uid, { ...v, isLive });
    }
  });

  const ordersMap = new Map<string, number>();
  actualLives.forEach((l: any) => {
    if (l.content_uid) ordersMap.set(l.content_uid, l.orders || 0);
  });

  // Extract videos and attach GMV (merging DB videos + organic auto-detected videos + sales videos)
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

    // 2. Add Auto-detected videos from organic_videos and sales
    const creatorSales = videoGmvData?.filter((s: any) => s.creator_username === username && s.content_uid) || [];
    const creatorOrganics = organicVideos?.filter((v: any) => v.creator_username === username) || [];
    
    const uniqueContentUids = new Set<string>();
    
    creatorSales.forEach((s: any) => {
       if (s.content_uid) uniqueContentUids.add(s.content_uid);
       // Livestream sales tidak perlu diproses di sini — sudah ditangani oleh RPC get_campaign_live_stats
    });
    
    creatorOrganics.forEach((v: any) => {
       if (v.content_uid) uniqueContentUids.add(v.content_uid);
    });

    uniqueContentUids.forEach(vid => {
        const exists = creatorVideos.some(v => v.content_uid === vid || v.vt_code === vid);
        if (!exists) {
           const sObj = creatorSales.find((s: any) => s.content_uid === vid);
           const ovObj = organicVideoMap.get(vid);
           
           const isLive = ovObj ? !!ovObj.isLive : (sObj ? sObj.content_type === 'Livestream' : false);
           
           // Exclude livestream dari daftar Video & Konten
           if (isLive) return;
           
           creatorVideos.push({
              id: `auto_${vid}`,
              content_uid: vid,
              link_video: `https://www.tiktok.com/@${username}/video/${vid}`,
              creator_username: username,
              gmv: videoGmvMap.get(vid) || 0,
              views: videoViewsMap.get(vid) || 0,
              likes: videoLikesMap.get(vid) || 0,
              isAuto: true,
              isLive: false
           });
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
  const finalSummary: any = summary || {};
  if (campaign && !finalSummary.target_creator) {
     finalSummary.target_creator = campaign.target_creator;
  }

  // Aggregate sales per product_id for Top 5 SKU insight via RPC
  const { data: topSkusData } = await supabase
    .rpc('get_campaign_top_skus', { p_campaign_id: campaignId });
    
  const salesPerProduct = topSkusData || [];
  const totalItemsSold = salesPerProduct.reduce((sum: number, p: any) => sum + Number(p.items_sold || 0), 0);

  // Fallback if rpcPerformance fails or returns empty (e.g. database function issue)
  let finalRpcPerf = Array.isArray(rpcPerformance) ? rpcPerformance[0] : rpcPerformance;
  
  if (!finalRpcPerf || Object.keys(finalRpcPerf || {}).length === 0 || !finalRpcPerf.totalAllGmv) {
    let fbViews = 0, fbVideos = 0, fbLivestreams = 0, fbAllGmv = 0, fbWithVideo = 0, fbWithLive = 0, fbApprovedCreators = 0;

    enrichedCcData.forEach((cc: any) => {
      if (campaign?.require_client_approval && cc.client_approval !== 'approved' && cc.client_approval !== 'not_required') return;
      if (cc.approval !== 'approved' && cc.approval !== 'pending') return;
      
      if (cc.approval === 'approved') fbApprovedCreators++;
      
      fbAllGmv += (Number(cc.gmv_organic) || 0) + (Number(cc.gmv_ads) || 0);
      fbViews += Number(cc.video_views) || 0;
      
      const trackedVideos = cc.total_vt || 0;
      const dbVideos = cc.videos || [];
      const uniqueVideoIds = new Set<string>();
      const uniqueLiveIds = new Set<string>();
      
      dbVideos.forEach((v: any) => {
        const id = v.vt_code || v.content_uid;
        if (id) uniqueVideoIds.add(id);
      });
      
      const creatorSales = videoGmvData?.filter((s: any) => s.creator_username === (cc.creators?.username || '') && s.content_uid) || [];
      creatorSales.forEach((s: any) => {
         let vid = s.content_uid;
         if (vid && vid.startsWith('video_')) vid = vid.split('_')[1] || vid;
         if (vid) {
            if (s.content_type === 'Livestream') uniqueLiveIds.add(vid);
            else uniqueVideoIds.add(vid);
         }
      });
      
      const totalVt = Math.max(trackedVideos, uniqueVideoIds.size);
      const totalLive = uniqueLiveIds.size;
      
      fbVideos += totalVt;
      fbLivestreams += totalLive;
      if (totalVt > 0) fbWithVideo++;
      if (totalLive > 0) fbWithLive++;
    });

    finalRpcPerf = {
      totalAllGmv: fbAllGmv,
      totalViews: fbViews,
      totalVideos: fbVideos,
      totalLivestreams: fbLivestreams,
      creatorsWithVideo: fbWithVideo,
      creatorsWithLive: fbWithLive,
      approvedCreators: fbApprovedCreators
    };
  }

  return { 
    authenticated: true, 
    campaign, 
    summary: finalSummary, 
    totalSales: null,
    totalAwareness: null,
    dailyPerf: [], 
    ccData: enrichedCcData, 
    samples,
    schedules,
    videos: portalVideos,
    skus: skusData || [],
    liveHistory: [],
    rpcPerformance: finalRpcPerf,
    topSkus: salesPerProduct,
    actualLives,
    salesPerProduct,
    totalItemsSold
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
    tanggal_kirim: proses === 'Dikirim' ? new Date().toISOString() : undefined,
    resi_updated_at: new Date().toISOString(),
    resi_updated_by: 'Brand'
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
    if (update.resi !== undefined) {
      updatePayload.resi = update.resi;
      updatePayload.resi_updated_at = new Date().toISOString();
      updatePayload.resi_updated_by = 'Brand';
    }
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
