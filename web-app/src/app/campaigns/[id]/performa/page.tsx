"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import { TrendingUp, BarChart3, Activity, ArrowUpDown, ChevronDown, ChevronRight, Edit2, Check, X, Loader2, Eye, Users, PlaySquare, Download, Search } from "lucide-react";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { exportToCSV } from "@/utils/exportCsv";
import { useAuth } from "@/providers/AuthProvider";
import { useCampaignFilter } from "@/providers/CampaignFilterProvider";

const supabase = createClient();

export default function CampaignPerformaPage() {
  return (
    <ErrorBoundary>
      <CampaignPerformaContent />
    </ErrorBoundary>
  );
}

function CampaignPerformaContent() {
  const { id } = useParams();
  const campaignId = Number(id);
  
  const { campaigns, campaign_creators, creators, videos, skus } = useDatabaseStore();
  const campaign = campaigns.find(c => c.id === campaignId);

  const { canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);

  const [salesSummary, setSalesSummary] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState<any>(null);
  
  const [awarenessSummary, setAwarenessSummary] = useState<any[]>([]);
  const [totalAwareness, setTotalAwareness] = useState<any>(null);

  const [salesDataForVt, setSalesDataForVt] = useState<any[]>([]);
  const [manualVideos, setManualVideos] = useState<any[]>([]);

  const [adsPerf, setAdsPerf] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdsDetail, setShowAdsDetail] = useState(false);
  
  const [editingKursId, setEditingKursId] = useState<number | null>(null);
  const [editKursValue, setEditKursValue] = useState<string>('');

  const [localCreators, setLocalCreators] = useState<any[]>([]);

  // Filter Creator State from Global Context
  const { appliedFilterType, appliedFilterUsernames, isCreatorVisible } = useCampaignFilter();

  const fetchPerformanceData = useCallback(async () => {
    try {
      const isAwareness = campaign?.tipe_campaign === 'awareness' || campaign?.tipe_campaign === 'gmv_awareness';

      // Helper to fetch all rows paginated
      const fetchAll = async (baseQuery: any) => {
        let all: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await baseQuery.range(from, from + 999);
          if (error || !data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < 1000) break;
          from += 1000;
        }
        return all;
      };

      // 1. Fetch RPC and View
      let salesVtQuery = supabase.from('sales').select('creator_username, content_uid, tanggal, content_type').eq('campaign_id', campaignId).not('content_uid', 'is', null);
      if (campaign?.start_date) salesVtQuery = salesVtQuery.gte('tanggal', campaign.start_date);
      if (campaign?.end_date && campaign?.status === 'selesai') salesVtQuery = salesVtQuery.lte('tanggal', campaign.end_date);

      const [
        rpcRes,
        viewRes,
        allSalesVt
      ] = await Promise.all([
        supabase.rpc('get_campaign_performance', { p_campaign_id: campaignId }),
        fetchAll(supabase.from('campaign_creators_performance').select('*').eq('campaign_id', campaignId)),
        fetchAll(salesVtQuery)
      ]);

      if (rpcRes.error) console.error("RPC Error:", rpcRes.error);

      setSalesSummary(viewRes || []); 
      if (rpcRes.data) setTotalSales(rpcRes.data); 
      setSalesDataForVt(allSalesVt);
      setManualVideos([]); // manualVideos no longer needed since videos are joined in the view

      // 2. Fetch Approved Creators (Paginated to handle >500 limits on joins)
      let allApproved: any[] = [];
      let from = 0;
      let to = 499; 
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('campaign_creators')
          .select('*, creators(*), videos(id, content_uid, vt_approval)')
          .eq('campaign_id', campaignId)
          .in('approval', ['approved', 'pending']);

        if (campaign?.require_client_approval) {
          query = query.eq('client_approval', 'approved');
        }

        const { data: ccData, error } = await query.range(from, to);

        if (error) {
          console.error("Error fetching creators for performa:", error);
          break;
        }

        if (ccData && ccData.length > 0) {
          allApproved = [...allApproved, ...ccData];
          if (ccData.length < 500) {
            hasMore = false;
          } else {
            from += 500;
            to += 500;
          }
        } else {
          hasMore = false;
        }
      }
      setLocalCreators(allApproved);

    } catch (error) {
      console.error("Error fetching performance data", error);
    } finally {
      setLoading(false);
    }
  }, [campaignId, campaign?.tipe_campaign, campaign?.require_client_approval]);

  useEffect(() => {
    if (campaignId && campaign) {
      fetchPerformanceData();
    }
  }, [campaignId, campaign, fetchPerformanceData]);

  // Real-time subscription to 'sales' table
  useEffect(() => {
    if (!campaignId) return;
    
    const channel = supabase.channel('realtime_sales_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'sales', 
        filter: `campaign_id=eq.${campaignId}` 
      }, () => {
        // Refetch whenever sales data changes
        fetchPerformanceData();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, fetchPerformanceData]);

  const handleUpdateKurs = async (id: number) => {
    const numKurs = Number(editKursValue);
    if (!numKurs || numKurs <= 0) {
      alert("Kurs tidak valid!");
      return;
    }
    const { error } = await supabase.from('ads_performance').update({ kurs: numKurs }).eq('id', id);
    if (error) {
      alert("Gagal update kurs: " + error.message);
    } else {
      setAdsPerf(adsPerf.map(a => a.id === id ? { ...a, kurs: numKurs } : a));
    }
    setEditingKursId(null);
  };

  const handleExport = () => {
    const exportData = creatorStats.map(c => ({
      'Username': c.username,
      'GMV Organic': c.gmvOrganic,
      'GMV Ads': c.gmvAds,
      'Total GMV': c.totalGmv,
      'Total Views': c.videoViews,
      'Total VT': c.totalVt
    }));
    exportToCSV(exportData, `campaign_${campaignId}_performance`);
  };

  if (!campaign) return null;

  const isAwareness = campaign.tipe_campaign === 'awareness' || campaign.tipe_campaign === 'gmv_awareness';
  const totalApprovedCreators = localCreators.filter(c => c.approval === 'approved').length;
  const totalPendingCreators = localCreators.filter(c => c.approval === 'pending').length;

  // Aggregate per creator using SQL VIEW data
  const baseCreatorStats = React.useMemo(() => {
    const perfMap = new Map();
    salesSummary.forEach((p: any) => perfMap.set(p.campaign_creator_id, p));

    const autoSalesMap = new Map();
    salesDataForVt.forEach(s => {
      if (!autoSalesMap.has(s.creator_username)) autoSalesMap.set(s.creator_username, []);
      autoSalesMap.get(s.creator_username).push(s);
    });

    return localCreators.map(cc => {
      const creator = cc.creators;
      const username = creator?.username || 'Unknown';
      
      const perf = perfMap.get(cc.id);
      
      const gmvOrganic = perf?.gmv_organic || 0;
      const itemsSold = perf?.items_sold || 0;
      
      const videoViews = perf?.video_views || 0;
      const videoLikes = perf?.video_likes || 0;
      const trackedVideos = perf?.tracked_videos || 0;

      const gmvAds = perf?.gmv_ads || 0;
      const costAds = perf?.cost_ads || 0;
      
      const totalGmv = gmvOrganic + gmvAds;
      const roas = costAds > 0 ? (gmvAds / costAds).toFixed(2) : '-';
      
      const dbVideos = cc.videos || [];
      const autoSalesVideos = autoSalesMap.get(username) || [];
      const uniqueVideoIds = new Map<string, string>(); // content_uid -> status
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
          pendingVtCount = Math.max(trackedVideos, uniqueVideoIds.size);
      } else {
          let mapApproved = 0;
          let mapPending = 0;
          uniqueVideoIds.forEach((status) => {
             if (status === 'pending') mapPending++;
             else mapApproved++;
          });
          approvedVtCount = Math.max(trackedVideos, mapApproved);
          pendingVtCount = mapPending;
      }

      const totalVt = approvedVtCount + pendingVtCount;
      const totalLive = uniqueLiveIds.size;

      return {
        ccId: cc.id,
        creatorId: creator?.id,
        username,
        tier: cc.tier,
        price: cc.price,
        gmvOrganic,
        itemsSold,
        videoViews,
        videoLikes,
        trackedVideos,
        gmvAds,
        totalGmv,
        costAds,
        roas,
        totalVt,
        approvedVtCount,
        pendingVtCount,
        totalLive,
        isPendingCreator: cc.approval === 'pending'
      };
    });
  }, [localCreators, salesSummary, awarenessSummary, adsPerf, salesDataForVt]);

  const creatorStats = React.useMemo(() => {
    if (appliedFilterType === 'none' || appliedFilterUsernames.length === 0) return baseCreatorStats;
    return baseCreatorStats.filter(c => {
      const match = appliedFilterUsernames.includes(c.username.toLowerCase());
      return appliedFilterType === 'include' ? match : !match;
    });
  }, [baseCreatorStats, appliedFilterType, appliedFilterUsernames]);

  const [sortField, setSortField] = useState<'username' | 'gmvOrganic' | 'gmvAds' | 'totalGmv' | 'totalVt' | 'totalLive' | 'videoViews'>('totalGmv');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortOrder]);

  let filteredCreatorStats = creatorStats.filter(c => c.username.toLowerCase().includes(searchQuery.toLowerCase()));

  filteredCreatorStats = filteredCreatorStats.sort((a, b) => {
    let comparison = 0;
    if (sortField === 'username') comparison = a.username.localeCompare(b.username);
    else if (sortField === 'gmvOrganic') comparison = a.gmvOrganic - b.gmvOrganic;
    else if (sortField === 'gmvAds') comparison = a.gmvAds - b.gmvAds;
    else if (sortField === 'totalGmv') {
       comparison = a.totalGmv - b.totalGmv;
       if (comparison === 0) {
          comparison = a.totalVt - b.totalVt;
          if (comparison === 0) {
             comparison = a.totalLive - b.totalLive;
          }
       }
    }
    else if (sortField === 'totalVt') comparison = a.totalVt - b.totalVt;
    else if (sortField === 'totalLive') comparison = a.totalLive - b.totalLive;
    else if (sortField === 'videoViews') comparison = a.videoViews - b.videoViews;

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.ceil(filteredCreatorStats.length / pageSize);
  const paginatedStats = filteredCreatorStats.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  let fbViews = 0, fbLikes = 0, fbVideos = 0, fbLivestreams = 0, fbOrganic = 0, fbAds = 0, fbAllGmv = 0, fbWithVideo = 0, fbWithLive = 0;
  let fbApprovedVideos = 0, fbPendingVideos = 0, pendingCreatorsWithVideosCount = 0;

  creatorStats.forEach(c => {
    fbViews += c.videoViews || 0;
    fbLikes += c.videoLikes || 0;
    fbVideos += c.totalVt || 0;
    fbLivestreams += c.totalLive || 0;
    fbOrganic += c.gmvOrganic || 0;
    fbAds += c.gmvAds || 0;
    fbAllGmv += c.totalGmv || 0;
    if (c.totalVt > 0) fbWithVideo++;
    if (c.totalLive > 0) fbWithLive++;
    
    fbApprovedVideos += c.approvedVtCount || 0;
    fbPendingVideos += c.pendingVtCount || 0;
    if (c.pendingVtCount > 0) pendingCreatorsWithVideosCount++;
  });

  const isFiltered = appliedFilterType !== 'none' && appliedFilterUsernames.length > 0;

  const totalOrganic = isFiltered ? fbOrganic : (totalSales?.totalOrganic || fbOrganic);
  const totalAdsGmv = isFiltered ? fbAds : (totalSales?.totalAdsGmv || fbAds);
  const totalAllGmv = isFiltered ? fbAllGmv : (totalSales?.totalAllGmv || fbAllGmv);
  const percentCapai = campaign?.target_gmv ? Math.round((totalAllGmv / campaign.target_gmv) * 100) : 0;
  const trackedOrganic = isFiltered ? fbOrganic : (totalSales?.trackedOrganic || fbOrganic);
  const attributionGap = isFiltered ? 0 : (totalSales?.attributionGap || 0);
  const gapPercentage = totalOrganic > 0 ? Math.round((attributionGap / totalOrganic) * 100) : 0;

  const totalCampaignViews = isFiltered ? fbViews : Number(totalSales?.totalViews || fbViews);
  const totalCampaignLikes = isFiltered ? fbLikes : Number(totalSales?.totalLikes || fbLikes);
  const totalCampaignVideos = isFiltered ? fbVideos : Number(totalSales?.totalVideos || fbVideos);
  const totalCampaignLivestreams = isFiltered ? fbLivestreams : Number(totalSales?.totalLivestreams || fbLivestreams);
  const creatorsWithVideo = isFiltered ? fbWithVideo : Number(totalSales?.creatorsWithVideo || fbWithVideo);
  const creatorsWithLive = isFiltered ? fbWithLive : Number(totalSales?.creatorsWithLive || fbWithLive);
  
  const targetVideo = campaign.target_video || 0;
  const percentCapaiVideo = targetVideo > 0 ? Math.round((totalCampaignVideos / targetVideo) * 100) : 0;
  
  const targetCreator = campaign.target_creator || 0;
  const percentCapaiCreator = targetCreator > 0 ? Math.round((localCreators.length / targetCreator) * 100) : 0;

  // Render format currency
  const formatCompactNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  return (
    <div className="space-y-[32px]">
      <div className="flex justify-between items-center mb-[24px] gap-[16px] flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold">
            {isAwareness ? "Performa Awareness Campaign" : "Performa Sales Campaign"}
          </h2>
          <p className="text-[13px] text-text-soft">Analitik 100% otomatis dari data impor secara <span className="font-bold text-green-600 border-b border-green-600">Real-Time</span>.</p>
        </div>
        <button className="btn btn-outline" onClick={handleExport}>
          <Download className="ico" /> Export CSV
        </button>
      </div>

      <div className="flex flex-col gap-[24px]">
        {/* === SECTION: AWARENESS METRICS === */}
        <div className={`grid grid-cols-1 md:grid-cols-4 gap-[24px] ${!isAwareness ? 'order-2' : 'order-1'}`}>
          <div className={`ccard relative overflow-hidden md:col-span-2 ${isAwareness ? 'bg-gradient-to-br from-indigo-50 to-blue-100/50 border-indigo-100' : 'bg-white border-line'}`}>
            {loading && (
               <div className="absolute top-[8px] right-[8px] flex items-center justify-center bg-white/80 p-[6px] rounded-full shadow-sm">
                  <Loader2 className={`w-3 h-3 animate-spin ${isAwareness ? 'text-indigo-600' : 'text-slate-500'}`} />
               </div>
            )}
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-[13px] font-medium ${isAwareness ? 'text-indigo-800' : 'text-text-soft'}`}>Total Keseluruhan Views</p>
                  <h3 className={`text-[32px] font-bold mt-[8px] ${isAwareness ? 'text-indigo-900' : 'text-text'}`}>{totalCampaignViews.toLocaleString()}</h3>
                  <p className={`text-[11px] font-semibold mt-[4px] ${isAwareness ? 'text-indigo-700/80' : 'text-text-soft'}`}>Dihitung dari {totalCampaignVideos} video unik</p>
                </div>
                <div className={`p-[16px] rounded-[12px] shadow-sm ${isAwareness ? 'bg-white text-indigo-600' : 'bg-slate-50 text-slate-500'}`}><Eye className="w-8 h-8" /></div>
              </div>
              <div className={`mt-[24px] pt-[16px] border-t flex gap-[24px] ${isAwareness ? 'border-indigo-200/50' : 'border-line'}`}>
                <div>
                  <p className={`text-[11px] font-medium ${isAwareness ? 'text-indigo-600' : 'text-text-soft'}`}>Total Likes</p>
                  <p className={`font-bold ${isAwareness ? 'text-indigo-900' : 'text-text'}`}>{totalCampaignLikes.toLocaleString()}</p>
                </div>
                <div>
                  <p className={`text-[11px] font-medium ${isAwareness ? 'text-indigo-600' : 'text-text-soft'}`}>Rata-rata Views / Video</p>
                  <p className={`font-bold ${isAwareness ? 'text-indigo-900' : 'text-text'}`}>
                    {totalCampaignVideos > 0 ? Math.round(totalCampaignViews / totalCampaignVideos).toLocaleString() : 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="ccard">
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium text-text-soft">Pencapaian Target Creator</p>
                  <h3 className="text-[24px] font-bold mt-[8px] text-text">{localCreators.length} <span className="text-[13px] text-text-soft font-normal">kreator</span></h3>
                  <div className="flex items-center gap-3 text-[11px] mt-[4px]">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>{totalApprovedCreators} appv</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{totalPendingCreators} pend</span>
                  </div>
                </div>
                <div className="p-[8px] bg-orange-50 rounded-[8px] text-orange-600"><Users className="w-5 h-5" /></div>
              </div>
              {targetCreator > 0 && (
                <div className="mt-[16px] pt-[16px] border-t border-line">
                  <div className="flex justify-between text-[11px] text-text-soft mb-[4px] font-medium">
                    <span>Target Total Kreator: {targetCreator}</span>
                    <span>{percentCapaiCreator}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-[6px] flex overflow-hidden">
                    <div className="bg-orange-500 h-[6px] transition-all duration-1000" style={{ width: `${Math.min(percentCapaiCreator, 100)}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ccard">
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium text-text-soft">Pencapaian Target Video</p>
                  <h3 className="text-[24px] font-bold mt-[8px] text-text">{fbApprovedVideos} <span className="text-[13px] text-text-soft font-normal">video approved</span></h3>
                  <div className="flex items-center gap-3 text-[11px] mt-[4px] text-text-soft">
                    <span>{fbPendingVideos} video pending dari {pendingCreatorsWithVideosCount} kreator</span>
                  </div>
                  <p className="text-[11px] font-semibold text-text-soft mt-[4px]">{totalCampaignLivestreams} <span className="font-normal">livestream</span></p>
                </div>
                <div className="p-[8px] bg-rose-50 rounded-[8px] text-rose-600"><PlaySquare className="w-5 h-5" /></div>
              </div>
              {targetVideo > 0 && (
                <div className="mt-[16px] pt-[16px] border-t border-line">
                  <div className="flex justify-between text-[11px] text-text-soft mb-[4px] font-medium">
                    <span>Target: {targetVideo} Video</span>
                    <span>{percentCapaiVideo}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-[6px] flex overflow-hidden">
                    <div className="bg-rose-500 h-[6px] transition-all duration-1000" style={{ width: `${Math.min(percentCapaiVideo, 100)}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === SECTION: SALES METRICS === */}
        <div className={`grid grid-cols-1 md:grid-cols-4 gap-[24px] ${!isAwareness ? 'order-1' : 'order-2'}`}>
          <div className={`ccard relative overflow-hidden ${!isAwareness ? 'bg-gradient-to-br from-green-50 to-emerald-100/50 border-green-100' : 'bg-white border-line'}`}>
            {loading && (
               <div className="absolute top-[8px] right-[8px] flex items-center justify-center bg-white/80 p-[6px] rounded-full shadow-sm">
                  <Loader2 className={`w-3 h-3 animate-spin ${!isAwareness ? 'text-green-600' : 'text-slate-500'}`} />
               </div>
            )}
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-[13px] font-medium ${!isAwareness ? 'text-green-800' : 'text-text-soft'}`}>Total Achievement (All)</p>
                  <h3 className={`text-[24px] font-bold mt-[8px] ${!isAwareness ? 'text-green-900' : 'text-text'}`}>Rp {(totalAllGmv / 1000000).toFixed(1)}M</h3>
                  <p className={`text-[11px] font-semibold mt-[4px] ${!isAwareness ? 'text-green-700/80' : 'text-text-soft'}`}>Rp {totalAllGmv.toLocaleString()}</p>
                </div>
                <div className={`p-[12px] rounded-[12px] shadow-sm ${!isAwareness ? 'bg-white text-green-600' : 'bg-slate-50 text-slate-500'}`}><TrendingUp className="w-6 h-6" /></div>
              </div>
              {campaign.target_gmv && (
                <div className={`mt-[16px] pt-[16px] border-t ${!isAwareness ? 'border-green-200/50' : 'border-line'}`}>
                  <div className={`flex justify-between text-[11px] mb-[4px] font-medium ${!isAwareness ? 'text-green-800' : 'text-text-soft'}`}>
                    <span>Target: Rp {(campaign.target_gmv / 1000000).toFixed(1)}M</span>
                    <span>{percentCapai}%</span>
                  </div>
                  <div className={`w-full rounded-full h-[6px] ${!isAwareness ? 'bg-green-200/50' : 'bg-slate-100'}`}>
                    <div className="bg-green-600 h-[6px] rounded-full transition-all duration-1000" style={{ width: `${Math.min(percentCapai, 100)}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ccard">
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium text-text-soft">GMV Organik</p>
                  <h3 className="text-[24px] font-bold mt-[8px] text-text">Rp {(totalOrganic / 1000000).toFixed(1)}M</h3>
                  <p className="text-[11px] font-semibold text-text-soft mt-[4px]">Rp {totalOrganic.toLocaleString()}</p>
                  <p className="text-[11px] text-text-soft mt-[4px]">Total dari CSV Penjualan</p>
                </div>
                <div className="p-[8px] bg-blue-50 rounded-[8px] text-blue-600"><Activity className="w-5 h-5" /></div>
              </div>
            </div>
          </div>

          <div className="ccard">
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium text-text-soft">GMV Ads</p>
                  <h3 className="text-[24px] font-bold mt-[8px] text-text">Rp {(totalAdsGmv / 1000000).toFixed(1)}M</h3>
                  <p className="text-[11px] font-semibold text-text-soft mt-[4px]">Rp {totalAdsGmv.toLocaleString()}</p>
                  <p className="text-[11px] text-text-soft mt-[4px]">Total dari Impor Iklan</p>
                </div>
                <div className="p-[8px] bg-purple-50 rounded-[8px] text-purple-600"><BarChart3 className="w-5 h-5" /></div>
              </div>
            </div>
          </div>

          <div className="ccard">
            <div className="p-[24px]">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[13px] font-medium text-text-soft">Unattributed GMV (Gap)</p>
                  <h3 className={`text-[24px] font-bold mt-[8px] ${attributionGap > 0 ? 'text-red-600' : 'text-green-600'}`}>Rp {(attributionGap / 1000000).toFixed(1)}M</h3>
                  <p className={`text-[11px] font-semibold mt-[4px] ${attributionGap > 0 ? 'text-red-500/80' : 'text-green-600/80'}`}>Rp {attributionGap.toLocaleString()}</p>
                  <p className="text-[11px] text-text-soft mt-[4px]">{gapPercentage}% nyangkut di kreator Pending</p>
                </div>
                <div className={`p-[8px] rounded-[8px] ${attributionGap > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              {totalOrganic > 0 && (
                <div className="mt-[16px] pt-[16px] border-t border-line">
                  <div className="flex justify-between text-[11px] text-text-soft mb-[4px]">
                    <span>Tracked (Approved): Rp {(trackedOrganic / 1000000).toFixed(1)}M</span>
                    <span>{100 - gapPercentage}%</span>
                  </div>
                  <div className="w-full bg-red-100 rounded-full h-[6px] flex overflow-hidden">
                    <div className="bg-green-500 h-[6px] transition-all duration-1000" style={{ width: `${100 - gapPercentage}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Detail Ads Performance */}
      <div className="ccard overflow-hidden !p-0">
        <div 
          className="p-[16px] bg-slate-50 border-b border-line flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
          onClick={() => setShowAdsDetail(!showAdsDetail)}
        >
          <div className="flex items-center gap-[12px]">
            {showAdsDetail ? <ChevronDown className="w-5 h-5 text-text-soft" /> : <ChevronRight className="w-5 h-5 text-text-soft" />}
            <div>
              <h3 className="font-bold text-text">Laporan Detail Iklan (Ads Performance)</h3>
              <p className="text-[12px] text-text-soft font-medium">Berdasarkan file yang diimpor dari TikTok Ads Manager</p>
            </div>
          </div>
          <div className="bg-indigo-50 text-indigo-700 px-[12px] py-[4px] rounded-full text-[12px] font-bold border border-indigo-100">
            {adsPerf.length} Data Iklan
          </div>
        </div>
        
        {showAdsDetail && (
          <div className="tbl-wrap !border-0 !rounded-none">
            {adsPerf.length > 0 ? (
              <table className="w-full">
                <thead className="bg-white border-b border-line">
                  <tr>
                    <th className="w-[200px]">Ad Name</th>
                    <th>Ad ID</th>
                    <th>Kreator (Mapped)</th>
                    <th className="text-right">Cost (USD)</th>
                    <th className="text-right">Revenue (USD)</th>
                    <th className="text-center w-[150px]">Kurs (IDR)</th>
                    <th className="text-center">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {adsPerf.map((ad, i) => {
                    const creatorUsername = ad.creators?.username;
                    const costIdr = ad.cost_usd * ad.kurs;
                    const revenueIdr = ad.gross_revenue_usd * ad.kurs;
                    const roas = costIdr > 0 ? (revenueIdr / costIdr).toFixed(2) : '-';
                    const isEditing = editingKursId === ad.id;

                    return (
                      <tr key={i} className="border-b border-line">
                        <td className="font-medium text-text truncate max-w-[200px]" title={ad.ad_name}>{ad.ad_name}</td>
                        <td className="font-mono text-[12px] text-text-soft">{ad.ad_id}</td>
                        <td>
                          {creatorUsername ? <span className="font-medium text-indigo-600">@{creatorUsername}</span> : <span className="text-amber-500 italic text-[12px]">Belum di-map</span>}
                        </td>
                        <td className="text-right text-red-600 font-medium">${ad.cost_usd.toFixed(2)}</td>
                        <td className="text-right text-emerald-600 font-bold">${ad.gross_revenue_usd.toFixed(2)}</td>
                        <td className="text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-[4px]">
                              <input 
                                type="number" 
                                className="input w-20 text-center !py-[4px]" 
                                value={editKursValue} 
                                onChange={e => setEditKursValue(e.target.value)} 
                                disabled={!hasAccess}
                              />
                              {hasAccess && (
                                <>
                                  <button onClick={() => handleUpdateKurs(ad.id)} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => setEditingKursId(null)} className="text-text-soft hover:text-text"><X className="w-4 h-4" /></button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-[8px] group">
                              <span className="font-medium">Rp {ad.kurs.toLocaleString()}</span>
                              {hasAccess && (
                                <button 
                                  onClick={() => { setEditingKursId(ad.id); setEditKursValue(ad.kurs.toString()); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-text-soft hover:text-indigo-600"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="text-center font-bold text-indigo-600">{roas}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-[32px] text-center text-text-soft text-[13px]">
                Belum ada data iklan diimpor untuk campaign ini.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ccard !p-0">
        <div className="border-b border-line bg-slate-50/50 p-[16px] flex flex-row justify-between items-center flex-wrap gap-[16px]">
          <h3 className="font-bold flex items-center gap-[8px]">
            Performa per Kreator (Approved)
            {loading && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
          </h3>
          <input 
            type="text" 
            placeholder="Cari username..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="input min-w-[200px]"
          />
        </div>
        <div className="tbl-wrap !border-0 !rounded-none">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr className="hover:bg-transparent">
                <th className="py-[16px] cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('username')}>Creator <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                
                {isAwareness && (
                  <th className="py-[16px] text-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('videoViews')}>Views <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                )}
                
                <th className="py-[16px] text-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('totalVt')}>Total VT <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                <th className="py-[16px] text-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('totalLive')}>Total Live <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                
                {!isAwareness && (
                  <th className="py-[16px] text-center cursor-pointer hover:bg-slate-50 transition-colors select-none">Item Sold</th>
                )}
                
                <th className="py-[16px] text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('gmvOrganic')}>GMV Organik <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                
                <th className="py-[16px] text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('gmvAds')}>GMV Ads <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
                <th className="py-[16px] text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('totalGmv')}>Total GMV <ArrowUpDown className="w-3 h-3 inline ml-[4px]"/></th>
              </tr>
            </thead>
            <tbody>
              {loading && filteredCreatorStats.length === 0 ? (
                <tr>
                  <td colSpan={isAwareness ? 8 : 7} className="text-center py-[32px] text-text-soft">Memuat data performa...</td>
                </tr>
              ) : filteredCreatorStats.length === 0 ? (
                <tr>
                  <td colSpan={isAwareness ? 8 : 7} className="text-center py-[32px] text-text-soft">Belum ada data kreator yang di-approve atau cocok dengan pencarian.</td>
                </tr>
              ) : (
                paginatedStats.map((c) => (
                  <tr key={c.ccId} className="transition-all duration-300 border-b border-line">
                    <td>
                      <Link href={`/creator-pool/${c.creatorId}`} className="font-semibold text-blue-600 hover:underline">
                        @{c.username}
                      </Link>
                    </td>
                    
                    {isAwareness && (
                      <td className="text-center font-bold text-indigo-700 bg-indigo-50/30">
                        {formatCompactNumber(c.videoViews)}
                      </td>
                    )}
                    
                    <td className="text-center text-text font-medium">
                      {c.totalVt}
                    </td>
                    <td className="text-center text-rose-500 font-medium">
                      {c.totalLive}
                    </td>
                    
                    {!isAwareness && (
                      <td className="text-center font-bold text-text">
                        {c.itemsSold} pcs
                      </td>
                    )}
                    
                    <td className="text-right text-text-soft">
                      Rp {c.gmvOrganic.toLocaleString()}
                    </td>
                    <td className="text-right text-text-soft">
                      Rp {c.gmvAds.toLocaleString()}
                    </td>
                    <td className="text-right font-bold text-text">
                      Rp {c.totalGmv.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-[16px] border-t border-line flex items-center justify-between bg-white text-[13px]">
            <div className="text-text-soft">
              Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredCreatorStats.length)} dari {filteredCreatorStats.length} kreator
            </div>
            <div className="flex items-center gap-[8px]">
              <button 
                className="px-[12px] py-[6px] border border-line rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >Sebelumnya</button>
              <span className="font-bold px-[8px] text-indigo-600">Hal {currentPage} / {totalPages}</span>
              <button 
                className="px-[12px] py-[6px] border border-line rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >Selanjutnya</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
