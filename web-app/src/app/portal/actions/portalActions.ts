'use server'

import { createClient } from "@supabase/supabase-js";
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  const { data: ccData } = await supabase
    .from('campaign_creators')
    .select(`
      id, 
      creator_id,
      client_approval, 
      notes_pic, 
      tier,
      content_type,
      sample_progress,
      sample_progress,
      creators(username, nama_asli, link_account, creator_snapshots(followers, level, tier), creator_contacts(nomor, status)),
      videos(id, link_video, content_uid, vt_approval, urutan)
    `)
    .eq('campaign_id', campaignId)
    .in('approval', ['approved', 'alternate']);

  // Fetch sales summary and ads performance for GMV calculation
  const { data: salesSummary } = await supabase
    .from('campaign_sales_summary')
    .select('creator_username, gmv_organic, items_sold')
    .eq('campaign_id', campaignId);

  const { data: adsPerf } = await supabase
    .from('ads_performance')
    .select('creator_id, gross_revenue_usd, kurs')
    .eq('campaign_id', campaignId);

  const { data: salesForVideos } = await supabase
    .from('sales')
    .select('content_uid, gmv, creator_username, raw_data')
    .eq('campaign_id', campaignId)
    .not('content_uid', 'is', null);

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

  const salesMap = new Map();
  const itemsMap = new Map();
  salesSummary?.forEach(s => {
    salesMap.set(s.creator_username, s.gmv_organic);
    itemsMap.set(s.creator_username, s.items_sold);
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

  // Fetch SKUs for dropdown
  const { data: skusData } = await supabase
    .from('skus')
    .select('id, product_id, nama_produk')
    .eq('campaign_id', campaignId);

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

  return { 
    authenticated: true, 
    campaign, 
    summary: summary || {}, 
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
