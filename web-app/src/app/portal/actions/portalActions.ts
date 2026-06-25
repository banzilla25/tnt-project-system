'use server'

import { createClient } from "@supabase/supabase-js";
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
      creators(username, nama_asli, link_account),
      creator_snapshots(followers, level, tier),
      videos(id, link_video, content_uid, vt_approval, urutan)
    `)
    .eq('campaign_id', campaignId)
    .in('approval', ['approved', 'alternate']);

  // Fetch sales summary and ads performance for GMV calculation
  const { data: salesSummary } = await supabase
    .from('campaign_sales_summary')
    .select('creator_username, gmv_organic')
    .eq('campaign_id', campaignId);

  const { data: adsPerf } = await supabase
    .from('ads_performance')
    .select('creator_id, gross_revenue_usd, kurs')
    .eq('campaign_id', campaignId);

  const { data: salesForVideos } = await supabase
    .from('sales')
    .select('content_uid, gmv')
    .eq('campaign_id', campaignId)
    .not('content_uid', 'is', null);

  const videoGmvMap = new Map();
  salesForVideos?.forEach(s => {
    if (s.content_uid) {
      videoGmvMap.set(s.content_uid, (videoGmvMap.get(s.content_uid) || 0) + s.gmv);
    }
  });

  const salesMap = new Map();
  salesSummary?.forEach(s => salesMap.set(s.creator_username, s.gmv_organic));

  const adsMap = new Map();
  adsPerf?.forEach(a => {
    if (!adsMap.has(a.creator_id)) adsMap.set(a.creator_id, 0);
    const rev = (a.gross_revenue_usd || 0) * (a.kurs || 0);
    adsMap.set(a.creator_id, adsMap.get(a.creator_id) + rev);
  });

  const enrichedCcData = ccData?.map((cc: any) => {
    const creator = Array.isArray(cc.creators) ? cc.creators[0] : cc.creators;
    const snap = Array.isArray(cc.creator_snapshots) ? cc.creator_snapshots[0] : cc.creator_snapshots;
    const username = creator?.username || '';
    const creatorId = cc.creator_id;
    return {
      ...cc,
      followers: snap?.followers || 0,
      level: snap?.level || '-',
      tier: snap?.tier || cc.tier,
      gmv_organic: salesMap.get(username) || 0,
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
      nohp_penerima,
      nama_jalan,
      provinsi,
      kabupaten_kota,
      kecamatan,
      kelurahan,
      kode_pos,
      catatan,
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

  // Extract videos and attach GMV
  const portalVideos: any[] = [];
  enrichedCcData.forEach((cc: any) => {
    if (cc.videos && Array.isArray(cc.videos)) {
      cc.videos.forEach((v: any) => {
        portalVideos.push({
          ...v,
          creator_username: cc.creators?.username || 'Unknown',
          gmv: videoGmvMap.get(v.content_uid) || 0
        });
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
