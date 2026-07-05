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
  
  // Fetch performa summary dari SQL View
  const { data: creatorPerformance } = await supabase
    .from('campaign_creators_performance')
    .select('*')
    .eq('campaign_id', campaignId);

  // Fetch RPC untuk Global Cards
  const { data: rpcPerformance, error: rpcError } = await supabase
    .rpc('get_campaign_performance', { p_campaign_id: campaignId });

  if (rpcError) console.error("RPC Error:", rpcError);

  // Fetch sales for videos (hanya VT, jauh lebih ringan)
  let salesForVideos: any[] = [];
  let svStart = 0;
  while (true) {
    const { data: pageSv } = await supabase
      .from('sales')
      .select('content_uid, gmv, creator_username, content_type, product_id, quantity')
      .eq('campaign_id', campaignId)
      .not('content_uid', 'is', null)
      .range(svStart, svStart + 999);
      
    if (!pageSv || pageSv.length === 0) break;
    salesForVideos = salesForVideos.concat(pageSv);
    if (pageSv.length < 1000) break;
    svStart += 1000;
  }

  const videoGmvMap = new Map();
  salesForVideos?.forEach(s => {
    let vid = s.content_uid;
    if (vid && vid.startsWith('video_')) {
       vid = vid.split('_')[1];
    }
    if (vid) {
      videoGmvMap.set(vid, (videoGmvMap.get(vid) || 0) + s.gmv);
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
      total_vt: perf?.tracked_videos_only || 0,
      total_livestreams: perf?.tracked_livestreams || 0
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

  // Ambil hanya organic_videos untuk Video tab
  let organicVideos: any[] = [];
  if (validUsernames.length > 0) {
    const startD = campaign.start_date;
    const endD = campaign.end_date;
    for (let i = 0; i < validUsernames.length; i += 100) {
      const chunk = validUsernames.slice(i, i + 100);
      let ovStart = 0;
      while(true) {
        let query = supabase.from('organic_videos')
          .select('content_uid, creator_username, video_views, video_likes, duration_str, post_time')
          .in('creator_username', chunk);
        if (startD) query = query.gte('post_time', startD);
        if (endD) query = query.lte('post_time', `${endD}T23:59:59Z`);
        const { data: ovs } = await query.range(ovStart, ovStart + 999);
        if (!ovs || ovs.length === 0) break;
        organicVideos = organicVideos.concat(ovs);
        if (ovs.length < 1000) break;
        ovStart += 1000;
      }
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
    const creatorSales = salesForVideos?.filter((s: any) => s.creator_username === username && s.content_uid) || [];
    const creatorOrganics = organicVideos?.filter((v: any) => v.creator_username === username) || [];
    
    const uniqueContentUids = new Set<string>();
    
    creatorSales.forEach((s: any) => {
       let vid = s.content_uid;
       if (vid && vid.startsWith('video_')) vid = vid.split('_')[1];
       if (vid) uniqueContentUids.add(vid);
       // Livestream sales tidak perlu diproses di sini — sudah ditangani oleh RPC get_campaign_live_stats
    });
    
    creatorOrganics.forEach((v: any) => {
       if (v.content_uid) uniqueContentUids.add(v.content_uid);
    });

    uniqueContentUids.forEach(vid => {
        const exists = creatorVideos.some(v => v.content_uid === vid || v.vt_code === vid);
        if (!exists) {
           const sObj = creatorSales.find((s: any) => s.content_uid === vid || s.content_uid === `video_${vid}`);
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
  const finalSummary = summary || {};
  if (campaign && !finalSummary.target_creator) {
     finalSummary.target_creator = campaign.target_creator;
  }

  // Aggregate sales per product_id for Top 5 SKU insight (scoped to campaign SKUs only)
  const productGmvMap = new Map<string, { product_id: string; nama_produk: string; gmv: number; items_sold: number; }>();
  const validProductIds = new Set((skusData || []).map((s: any) => s.product_id));
  
  // Use salesForVideos which already contains all sales for this campaign
  salesForVideos?.forEach((s: any) => {
    if (s.product_id && validProductIds.has(s.product_id)) {
      const existing = productGmvMap.get(s.product_id) || { 
        product_id: s.product_id, 
        nama_produk: (skusData || []).find((sk: any) => sk.product_id === s.product_id)?.nama_produk || s.product_id,
        gmv: 0, 
        items_sold: 0 
      };
      existing.gmv += (s.gmv || 0);
      existing.items_sold += (s.quantity || 0);
      productGmvMap.set(s.product_id, existing);
    }
  });
  
  const salesPerProduct = Array.from(productGmvMap.values())
    .sort((a, b) => b.gmv - a.gmv);
  
  const totalItemsSold = salesPerProduct.reduce((sum, p) => sum + p.items_sold, 0);

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
    rpcPerformance,
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
