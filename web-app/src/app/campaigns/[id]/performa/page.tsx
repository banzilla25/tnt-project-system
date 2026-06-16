"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import { TrendingUp, BarChart3, Activity, ArrowUpDown, ChevronDown, ChevronRight, Edit2, Check, X, Loader2, Eye, Users, PlaySquare, Download, Search } from "lucide-react";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { exportToCSV } from "@/utils/exportCsv";
import { Button } from "@/components/ui/Button";

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
  
  const { campaigns, campaign_creators, creators, videos } = useDatabaseStore();
  const campaign = campaigns.find(c => c.id === campaignId);

  const [salesSummary, setSalesSummary] = useState<any[]>([]);
  const [totalSales, setTotalSales] = useState<any>(null);
  
  const [awarenessSummary, setAwarenessSummary] = useState<any[]>([]);
  const [totalAwareness, setTotalAwareness] = useState<any>(null);

  const [adsPerf, setAdsPerf] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdsDetail, setShowAdsDetail] = useState(false);
  
  const [editingKursId, setEditingKursId] = useState<number | null>(null);
  const [editKursValue, setEditKursValue] = useState<string>('');

  const [localCreators, setLocalCreators] = useState<any[]>([]);

  const fetchPerformanceData = useCallback(async () => {
    try {
      const isAwareness = campaign?.tipe_campaign === 'awareness' || campaign?.tipe_campaign === 'gmv_awareness';

      // 1. Fetch Summaries
      const queries = [
        supabase.from('campaign_sales_summary').select('*').eq('campaign_id', campaignId),
        supabase.from('campaign_total_sales').select('*').eq('campaign_id', campaignId).maybeSingle(),
        supabase.from('ads_performance').select('*').eq('campaign_id', campaignId)
      ];

      if (isAwareness) {
        queries.push(supabase.from('campaign_awareness_summary').select('*').eq('campaign_id', campaignId));
        queries.push(supabase.from('campaign_total_awareness').select('*').eq('campaign_id', campaignId).maybeSingle());
      }

      const results = await Promise.all(queries);

      if (results[0].data) setSalesSummary(results[0].data);
      if (results[1].data) setTotalSales(results[1].data);
      if (results[2].data) setAdsPerf(results[2].data);

      if (isAwareness) {
        if (results[3]?.data) setAwarenessSummary(results[3].data);
        if (results[4]?.data) setTotalAwareness(results[4].data);
      }

      // 2. Fetch Approved Creators (Paginated to handle >1000)
      let allApproved: any[] = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('campaign_creators')
          .select('*, creators(*), videos(id)')
          .eq('campaign_id', campaignId)
          .eq('approval', 'approved');

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
          if (ccData.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
            to += 1000;
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

  // Aggregate per creator using local data
  const creatorStats = localCreators.map(cc => {
    const creator = cc.creators;
    const username = creator?.username || 'Unknown';
    
    // Organic GMV: from SQL View
    const ccSales = salesSummary.find(s => s.creator_username === username);
    const gmvOrganic = ccSales?.gmv_organic || 0;
    const itemsSold = ccSales?.items_sold || 0;
    
    // Awareness: from SQL View
    const ccAwareness = awarenessSummary.find(a => a.creator_username === username);
    const videoViews = Number(ccAwareness?.total_views || 0);
    const videoLikes = Number(ccAwareness?.total_likes || 0);
    const trackedVideos = Number(ccAwareness?.total_videos || 0);

    // Ads GMV and Cost: ads_performance matched by creator_id
    const ccAds = adsPerf.filter(a => a.creator_id === creator?.id);
    const gmvAds = ccAds.reduce((sum, row) => sum + (row.gross_revenue_usd * row.kurs), 0);
    const costAds = ccAds.reduce((sum, row) => sum + (row.cost_usd * row.kurs), 0);
    
    const totalGmv = gmvOrganic + gmvAds;
    const roas = costAds > 0 ? (gmvAds / costAds).toFixed(2) : '-';
    const totalVt = cc.videos?.length || 0;

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
      totalVt
    };
  });

  const [sortField, setSortField] = useState<'username' | 'gmvOrganic' | 'gmvAds' | 'totalGmv' | 'totalVt' | 'videoViews'>('totalGmv');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'username' | 'gmvOrganic' | 'gmvAds' | 'totalGmv' | 'totalVt' | 'videoViews') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  let filteredCreatorStats = creatorStats.filter(c => c.username.toLowerCase().includes(searchQuery.toLowerCase()));

  filteredCreatorStats = filteredCreatorStats.sort((a, b) => {
    let comparison = 0;
    if (sortField === 'username') comparison = a.username.localeCompare(b.username);
    else if (sortField === 'gmvOrganic') comparison = a.gmvOrganic - b.gmvOrganic;
    else if (sortField === 'gmvAds') comparison = a.gmvAds - b.gmvAds;
    else if (sortField === 'totalGmv') comparison = a.totalGmv - b.totalGmv;
    else if (sortField === 'totalVt') comparison = a.totalVt - b.totalVt;
    else if (sortField === 'videoViews') comparison = a.videoViews - b.videoViews;

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Sales Metrics
  const totalOrganic = totalSales?.total_organic_gmv || 0;
  const totalAdsGmv = creatorStats.reduce((sum, c) => sum + c.gmvAds, 0);
  const totalAllGmv = totalOrganic + totalAdsGmv;
  const percentCapai = campaign.target_gmv ? Math.round((totalAllGmv / campaign.target_gmv) * 100) : 0;
  const trackedOrganic = creatorStats.reduce((sum, c) => sum + c.gmvOrganic, 0);
  const attributionGap = Math.max(0, totalOrganic - trackedOrganic);
  const gapPercentage = totalOrganic > 0 ? Math.round((attributionGap / totalOrganic) * 100) : 0;

  // Awareness Metrics
  const totalCampaignViews = Number(totalAwareness?.campaign_total_views || 0);
  const totalCampaignLikes = Number(totalAwareness?.campaign_total_likes || 0);
  const totalCampaignVideos = Number(totalAwareness?.campaign_total_videos || 0);
  
  const targetVideo = campaign.target_video || 0;
  const percentCapaiVideo = targetVideo > 0 ? Math.round((totalCampaignVideos / targetVideo) * 100) : 0;
  
  const targetCreator = campaign.target_creator || 0;
  const percentCapaiCreator = targetCreator > 0 ? Math.round((creatorStats.length / targetCreator) * 100) : 0;

  // Render format currency
  const formatCompactNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">
            {isAwareness ? "Performa Awareness Campaign" : "Performa Sales Campaign"}
          </h2>
          <p className="text-sm text-slate-500">Analitik 100% otomatis dari data impor secara <span className="font-bold text-green-600 border-b border-green-600">Real-Time</span>.</p>
        </div>
        <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {isAwareness ? (
        // ================= AWARENESS DASHBOARD =================
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-50 to-blue-100/50 border-indigo-100 shadow-sm relative overflow-hidden md:col-span-2">
            {loading && (
               <div className="absolute top-2 right-2 flex items-center justify-center bg-white/80 p-1.5 rounded-full shadow-sm">
                  <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />
               </div>
            )}
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-indigo-800">Total Keseluruhan Views</p>
                  <h3 className="text-4xl font-bold mt-2 text-indigo-900">{totalCampaignViews.toLocaleString()}</h3>
                  <p className="text-xs font-semibold text-indigo-700/80 mt-1">Dihitung dari {totalCampaignVideos} video unik</p>
                </div>
                <div className="p-4 bg-white rounded-xl shadow-sm text-indigo-600"><Eye className="w-8 h-8" /></div>
              </div>
              <div className="mt-6 pt-4 border-t border-indigo-200/50 flex gap-6">
                <div>
                  <p className="text-xs text-indigo-600 font-medium">Total Likes</p>
                  <p className="font-bold text-indigo-900">{totalCampaignLikes.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-600 font-medium">Rata-rata Views / Video</p>
                  <p className="font-bold text-indigo-900">
                    {totalCampaignVideos > 0 ? Math.round(totalCampaignViews / totalCampaignVideos).toLocaleString() : 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">Pencapaian Target Creator</p>
                  <h3 className="text-2xl font-bold mt-2 text-slate-800">{creatorStats.length} <span className="text-sm text-slate-500 font-normal">kreator</span></h3>
                </div>
                <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Users className="w-5 h-5" /></div>
              </div>
              {targetCreator > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-xs text-slate-500 mb-1 font-medium">
                    <span>Target: {targetCreator}</span>
                    <span>{percentCapaiCreator}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 flex overflow-hidden">
                    <div className="bg-orange-500 h-1.5 transition-all duration-1000" style={{ width: `${Math.min(percentCapaiCreator, 100)}%` }}></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">Pencapaian Target Video</p>
                  <h3 className="text-2xl font-bold mt-2 text-slate-800">{totalCampaignVideos} <span className="text-sm text-slate-500 font-normal">video</span></h3>
                </div>
                <div className="p-2 bg-rose-50 rounded-lg text-rose-600"><PlaySquare className="w-5 h-5" /></div>
              </div>
              {targetVideo > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-xs text-slate-500 mb-1 font-medium">
                    <span>Target: {targetVideo}</span>
                    <span>{percentCapaiVideo}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 flex overflow-hidden">
                    <div className="bg-rose-500 h-1.5 transition-all duration-1000" style={{ width: `${Math.min(percentCapaiVideo, 100)}%` }}></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        // ================= SALES DASHBOARD =================
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-100/50 border-green-100 shadow-sm relative overflow-hidden">
            {loading && (
               <div className="absolute top-2 right-2 flex items-center justify-center bg-white/80 p-1.5 rounded-full shadow-sm">
                  <Loader2 className="w-3 h-3 text-green-600 animate-spin" />
               </div>
            )}
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-green-800">Total Achievement (All)</p>
                  <h3 className="text-3xl font-bold mt-2 text-green-900">Rp {(totalAllGmv / 1000000).toFixed(1)}M</h3>
                  <p className="text-xs font-semibold text-green-700/80 mt-1">Rp {totalAllGmv.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-white rounded-xl shadow-sm text-green-600"><TrendingUp className="w-6 h-6" /></div>
              </div>
              {campaign.target_gmv && (
                <div className="mt-4 pt-4 border-t border-green-200/50">
                  <div className="flex justify-between text-xs text-green-800 mb-1 font-medium">
                    <span>Target: Rp {(campaign.target_gmv / 1000000).toFixed(1)}M</span>
                    <span>{percentCapai}%</span>
                  </div>
                  <div className="w-full bg-green-200/50 rounded-full h-1.5">
                    <div className="bg-green-600 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${Math.min(percentCapai, 100)}%` }}></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">GMV Organik</p>
                  <h3 className="text-2xl font-bold mt-2 text-slate-800">Rp {(totalOrganic / 1000000).toFixed(1)}M</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Rp {totalOrganic.toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-1">Total dari CSV Penjualan</p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Activity className="w-5 h-5" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">GMV Ads</p>
                  <h3 className="text-2xl font-bold mt-2 text-slate-800">Rp {(totalAdsGmv / 1000000).toFixed(1)}M</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Rp {totalAdsGmv.toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-1">Total dari Impor Iklan</p>
                </div>
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><BarChart3 className="w-5 h-5" /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">Unattributed GMV (Gap)</p>
                  <h3 className={`text-2xl font-bold mt-2 ${attributionGap > 0 ? 'text-red-600' : 'text-green-600'}`}>Rp {(attributionGap / 1000000).toFixed(1)}M</h3>
                  <p className={`text-xs font-semibold mt-1 ${attributionGap > 0 ? 'text-red-500/80' : 'text-green-600/80'}`}>Rp {attributionGap.toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-1">{gapPercentage}% nyangkut di kreator Pending</p>
                </div>
                <div className={`p-2 rounded-lg ${attributionGap > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              {totalOrganic > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Tracked (Approved): Rp {(trackedOrganic / 1000000).toFixed(1)}M</span>
                    <span>{100 - gapPercentage}%</span>
                  </div>
                  <div className="w-full bg-red-100 rounded-full h-1.5 flex overflow-hidden">
                    <div className="bg-green-500 h-1.5 transition-all duration-1000" style={{ width: `${100 - gapPercentage}%` }}></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accordion Detail Ads Performance */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
        <div 
          className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
          onClick={() => setShowAdsDetail(!showAdsDetail)}
        >
          <div className="flex items-center gap-3">
            {showAdsDetail ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
            <div>
              <h3 className="font-bold text-slate-800">Laporan Detail Iklan (Ads Performance)</h3>
              <p className="text-xs text-slate-500 font-medium">Berdasarkan file yang diimpor dari TikTok Ads Manager</p>
            </div>
          </div>
          <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
            {adsPerf.length} Data Iklan
          </div>
        </div>
        
        {showAdsDetail && (
          <div className="overflow-x-auto">
            {adsPerf.length > 0 ? (
              <Table>
                <TableHeader className="bg-white">
                  <TableRow>
                    <TableHead className="w-[200px]">Ad Name</TableHead>
                    <TableHead>Ad ID</TableHead>
                    <TableHead>Kreator (Mapped)</TableHead>
                    <TableHead className="text-right">Cost (USD)</TableHead>
                    <TableHead className="text-right">Revenue (USD)</TableHead>
                    <TableHead className="text-center w-[150px]">Kurs (IDR)</TableHead>
                    <TableHead className="text-center">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adsPerf.map((ad, i) => {
                    const creator = creators.find(c => c.id === ad.creator_id);
                    const costIdr = ad.cost_usd * ad.kurs;
                    const revenueIdr = ad.gross_revenue_usd * ad.kurs;
                    const roas = costIdr > 0 ? (revenueIdr / costIdr).toFixed(2) : '-';
                    const isEditing = editingKursId === ad.id;

                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-slate-700 truncate max-w-[200px]" title={ad.ad_name}>{ad.ad_name}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">{ad.ad_id}</TableCell>
                        <TableCell>
                          {creator ? <span className="font-medium text-indigo-600">@{creator.username}</span> : <span className="text-amber-500 italic text-xs">Belum di-map</span>}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-medium">${ad.cost_usd.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-bold">${ad.gross_revenue_usd.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input 
                                type="number" 
                                className="w-20 p-1 border rounded text-xs text-center" 
                                value={editKursValue} 
                                onChange={e => setEditKursValue(e.target.value)} 
                              />
                              <button onClick={() => handleUpdateKurs(ad.id)} className="text-green-600 hover:text-green-800"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingKursId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2 group">
                              <span className="font-medium">Rp {ad.kurs.toLocaleString()}</span>
                              <button 
                                onClick={() => { setEditingKursId(ad.id); setEditKursValue(ad.kurs.toString()); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-indigo-600">{roas}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                Belum ada data iklan diimpor untuk campaign ini.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-3">
          <Card className="shadow-sm border-slate-200 h-full">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 flex flex-row justify-between items-center">
              <CardTitle className="text-base flex items-center gap-2">
                Performa per Kreator (Approved)
                {loading && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
              </CardTitle>
              <input 
                type="text" 
                placeholder="Cari username..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="p-2 border border-slate-300 rounded-md text-sm min-w-[200px]"
              />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-4 cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('username')}>Creator <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                    
                    {isAwareness && (
                      <TableHead className="py-4 text-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('videoViews')}>Views <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                    )}
                    
                    <TableHead className="py-4 text-center cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('totalVt')}>Total VT <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                    
                    {!isAwareness && (
                      <TableHead className="py-4 text-center cursor-pointer hover:bg-slate-50 transition-colors select-none">Item Sold</TableHead>
                    )}
                    
                    <TableHead className="py-4 text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('gmvOrganic')}>GMV Organik <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                    
                    {/* Hide Ads for Awareness or keep them? Keep them but maybe less prominent. Wait, keeping them is good for GMV Awareness. */}
                    <TableHead className="py-4 text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('gmvAds')}>GMV Ads <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                    <TableHead className="py-4 text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('totalGmv')}>Total GMV <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && filteredCreatorStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAwareness ? 7 : 6} className="text-center py-8 text-slate-400">Memuat data performa...</TableCell>
                    </TableRow>
                  ) : filteredCreatorStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAwareness ? 7 : 6} className="text-center py-8 text-slate-400">Belum ada data kreator yang di-approve atau cocok dengan pencarian.</TableCell>
                    </TableRow>
                  ) : (
                    filteredCreatorStats.map((c) => (
                      <TableRow key={c.ccId} className="transition-all duration-300">
                        <TableCell>
                          <Link href={`/creator-pool/${c.creatorId}`} className="font-semibold text-blue-600 hover:underline">
                            @{c.username}
                          </Link>
                        </TableCell>
                        
                        {isAwareness && (
                          <TableCell className="text-center font-bold text-indigo-700 bg-indigo-50/30">
                            {formatCompactNumber(c.videoViews)}
                          </TableCell>
                        )}
                        
                        <TableCell className="text-center text-slate-600 font-medium">
                          {c.totalVt}
                        </TableCell>
                        
                        {!isAwareness && (
                          <TableCell className="text-center font-bold text-slate-700">
                            {c.itemsSold} pcs
                          </TableCell>
                        )}
                        
                        <TableCell className="text-right text-slate-600">
                          Rp {c.gmvOrganic.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-slate-600">
                          Rp {c.gmvAds.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          Rp {c.totalGmv.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
