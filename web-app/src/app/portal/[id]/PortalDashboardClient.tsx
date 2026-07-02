"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TrendingUp, Video, Users, Package, Calendar, CheckCircle, Activity, BarChart3, ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight, Filter, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { submitClientApproval, updateResiByClient, batchUpdateResiByClient, type BatchUpdateData } from "../actions/portalActions";
import { formatAbbreviated } from "@/utils/formatters";
import { useRouter } from "next/navigation";

const SortableHeader = ({ label, sortKey, currentSort, onSort, className = "" }: { label: string, sortKey: string, currentSort: {key: string, direction: 'asc'|'desc'}, onSort: (k: string) => void, className?: string }) => {
  return (
    <TableHead className={`py-[16px] cursor-pointer hover:bg-slate-50 transition-colors select-none group ${className}`} onClick={() => onSort(sortKey)}>
      <div className={`flex items-center gap-2 ${className.includes('text-right') ? 'justify-end' : className.includes('text-center') ? 'justify-center' : 'justify-start'}`}>
        {label}
        {currentSort.key === sortKey ? (
          currentSort.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600" /> : <ArrowDown className="w-4 h-4 text-blue-600" />
        ) : (
          <ArrowUpDown className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
    </TableHead>
  );
};

export default function PortalDashboardClient({ data, campaignId }: { data: any, campaignId: number }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'performa' | 'approval' | 'sampel' | 'live' | 'video'>('performa');
  const [expandedVideos, setExpandedVideos] = useState<Record<string, boolean>>({});
  const [isApproving, setIsApproving] = useState<number | null>(null);
  const [editedSamples, setEditedSamples] = useState<Record<number, BatchUpdateData>>({});
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  
  // Filter, Sort, & Pagination States
  const PAGE_SIZE = 50;
  
  type SortDirection = 'asc' | 'desc';
  const [performaSort, setPerformaSort] = useState<{key: string, direction: SortDirection}>({ key: 'total_gmv', direction: 'desc' });
  const [listingSort, setListingSort] = useState<{key: string, direction: SortDirection}>({ key: 'username', direction: 'asc' });
  const [sampleSort, setSampleSort] = useState<{key: string, direction: SortDirection}>({ key: 'tanggal_kirim', direction: 'desc' });
  const [liveSort, setLiveSort] = useState<{key: string, direction: SortDirection}>({ key: 'tanggal_live', direction: 'asc' });
  const [videoSort, setVideoSort] = useState<{key: string, direction: SortDirection}>({ key: 'total_views', direction: 'desc' });

  const handleSort = (tab: 'performa' | 'listing' | 'sample' | 'live' | 'video', key: string) => {
    const setterMap = { performa: setPerformaSort, listing: setListingSort, sample: setSampleSort, live: setLiveSort, video: setVideoSort };
    const stateMap = { performa: performaSort, listing: listingSort, sample: sampleSort, live: liveSort, video: videoSort };
    const setter = setterMap[tab];
    const currentState = stateMap[tab];
    if (currentState.key === key) {
      setter({ key, direction: currentState.direction === 'asc' ? 'desc' : 'asc' });
    } else {
      setter({ key, direction: 'desc' });
    }
  };
  const [performaSearch, setPerformaSearch] = useState('');
  const [performaPage, setPerformaPage] = useState(0);

  const [listingSearch, setListingSearch] = useState('');
  const [listingTypeFilter, setListingTypeFilter] = useState('all');
  const [listingPage, setListingPage] = useState(0);

  const [sampleSearch, setSampleSearch] = useState('');
  const [sampleStatusFilter, setSampleStatusFilter] = useState('all');
  const [samplePage, setSamplePage] = useState(0);

  const [liveSearch, setLiveSearch] = useState('');
  const [livePage, setLivePage] = useState(0);

  const [videoSearch, setVideoSearch] = useState('');
  const [videoPage, setVideoPage] = useState(0);

  // Reset page when tab changes
  React.useEffect(() => {
    setPerformaPage(0);
    setListingPage(0);
    setSamplePage(0);
    setLivePage(0);
    setVideoPage(0);
  }, [activeTab]);

  // Mencegah user close tab/refresh saat ada data belum disave
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(editedSamples).length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Standard untuk memunculkan prompt browser
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editedSamples]);

  const { campaign, summary, dailyPerf, approvalList, samples, schedules, videos, skus, totalSales, totalAwareness } = data;
  
  // Filter data untuk hanya mengambil yang Approved (jika campaign menggunakan sistem approval)
  const validApprovalList = campaign?.require_client_approval 
    ? approvalList.filter((cc: any) => cc.client_approval === 'approved')
    : approvalList;

  // Calculate display values based on campaign type and modern tracking data
  const isAwareness = campaign?.tipe_campaign === 'awareness' || campaign?.tipe_campaign === 'gmv_awareness';
  
  // Ambil perhitungan GMV Organik & Ads langsung dari list kreator yang valid (approved)
  const displayOrganic = validApprovalList.reduce((sum: number, c: any) => sum + (c.gmv_organic || 0), 0);
  const displayAds = validApprovalList.reduce((sum: number, c: any) => sum + (c.gmv_ads || 0), 0);
  const displayTotalGmv = displayOrganic + displayAds;
  
  const validCreatorUsernames = new Set(validApprovalList.map((cc: any) => cc.creators?.username));
  const validVideos = campaign?.require_client_approval 
    ? (videos || []).filter((v: any) => validCreatorUsernames.has(v.creator_username))
    : (videos || []);

  const displayTotalVideo = validVideos.reduce((sum: number, v: any) => sum + (v.total_videos || 0), 0) || (isAwareness ? (totalAwareness?.total_video || summary.achievement_video || 0) : (summary.achievement_video || 0));
  const displayTotalViews = validVideos.reduce((sum: number, v: any) => sum + (v.total_views || 0), 0);

  const percentGmv = summary.target_gmv ? Math.round((displayTotalGmv / summary.target_gmv) * 100) : 0;
  const percentVideo = summary.target_video ? Math.round((displayTotalVideo / summary.target_video) * 100) : 0;

  const handleApproval = async (ccId: number, status: 'approved' | 'rejected') => {
    setIsApproving(ccId);
    try {
      await submitClientApproval(campaignId, ccId, status);
      router.refresh();
    } catch (err) {
      alert("Gagal menyimpan persetujuan. Silakan coba lagi.");
    } finally {
      setIsApproving(null);
    }
  };

  const handleQueueUpdate = (addrId: number, field: keyof BatchUpdateData, value: string) => {
    setEditedSamples(prev => ({
      ...prev,
      [addrId]: {
        ...prev[addrId],
        addressId: addrId,
        [field]: value
      }
    }));
  };

  const handleBatchSave = async () => {
    const updates = Object.values(editedSamples);
    if (updates.length === 0) return;

    setIsSavingBatch(true);
    try {
      await batchUpdateResiByClient(campaignId, updates);
      setEditedSamples({});
      router.refresh();
      alert("Semua perubahan berhasil disimpan!");
    } catch (err) {
      alert("Gagal menyimpan perubahan. Silakan coba lagi.");
    } finally {
      setIsSavingBatch(false);
    }
  };

  // ============================
  // DERIVED DATA FOR PAGINATION & SORTING
  // ============================

  const genericSort = (arr: any[], sortConfig: {key: string, direction: SortDirection}, getValue: (item: any) => any) => {
    return [...arr].sort((a, b) => {
      let valA = getValue(a);
      let valB = getValue(b);
      // Handle string comparison gracefully
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA === valB) return 0;
      // Handle undefined/null (push them to the end)
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      
      const comparison = valA > valB ? 1 : -1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  // 1. Performa
  let filteredPerforma = validApprovalList.filter((cc: any) => {
    if (performaSearch && !cc.creators?.username?.toLowerCase().includes(performaSearch.toLowerCase())) return false;
    return true;
  });
  filteredPerforma = genericSort(filteredPerforma, performaSort, (c) => {
    if (performaSort.key === 'username') return c.creators?.username;
    if (performaSort.key === 'total_vt') return c.videos?.length || 0;
    if (performaSort.key === 'items_sold') return c.items_sold || 0;
    if (performaSort.key === 'gmv_organic') return c.gmv_organic || 0;
    if (performaSort.key === 'gmv_ads') return c.gmv_ads || 0;
    if (performaSort.key === 'total_gmv') return (c.gmv_organic || 0) + (c.gmv_ads || 0);
    return 0;
  });
  const performaTotalPages = Math.ceil(filteredPerforma.length / PAGE_SIZE) || 1;
  const paginatedPerforma = filteredPerforma.slice(performaPage * PAGE_SIZE, (performaPage + 1) * PAGE_SIZE);

  // 2. Listing
  let filteredListing = approvalList.filter((cc: any) => {
    if (listingSearch && !cc.creators?.username?.toLowerCase().includes(listingSearch.toLowerCase())) return false;
    if (listingTypeFilter !== 'all' && cc.content_type?.toLowerCase() !== listingTypeFilter.toLowerCase()) return false;
    return true;
  });
  filteredListing = genericSort(filteredListing, listingSort, (c) => {
    if (listingSort.key === 'username') return c.creators?.username;
    if (listingSort.key === 'followers') return c.followers || 0;
    if (listingSort.key === 'level') return c.level;
    if (listingSort.key === 'tier') return c.tier;
    if (listingSort.key === 'content_type') return c.content_type;
    if (listingSort.key === 'sample_progress') return c.sample_progress;
    if (listingSort.key === 'status_approval') return c.client_approval;
    return 0;
  });
  const listingTotalPages = Math.ceil(filteredListing.length / PAGE_SIZE) || 1;
  const paginatedListing = filteredListing.slice(listingPage * PAGE_SIZE, (listingPage + 1) * PAGE_SIZE);

  // 3. Sampel
  let filteredSamples = samples.filter((addr: any) => {
    const cc = approvalList.find((c: any) => c.id === addr.campaign_creator_id);
    const username = cc?.creators?.username || '';
    if (sampleSearch && !username.toLowerCase().includes(sampleSearch.toLowerCase()) && !(addr.resi || '').toLowerCase().includes(sampleSearch.toLowerCase())) return false;
    if (sampleStatusFilter !== 'all' && (addr.proses || 'Diproses').toLowerCase() !== sampleStatusFilter.toLowerCase()) return false;
    return true;
  });
  filteredSamples = genericSort(filteredSamples, sampleSort, (addr) => {
    const cc = approvalList.find((c: any) => c.id === addr.campaign_creator_id);
    if (sampleSort.key === 'username') return cc?.creators?.username;
    if (sampleSort.key === 'proses') return addr.proses;
    if (sampleSort.key === 'tanggal_kirim') return new Date(addr.tanggal_kirim || 0).getTime();
    if (sampleSort.key === 'resi') return addr.resi;
    return 0;
  });
  const sampleTotalPages = Math.ceil(filteredSamples.length / PAGE_SIZE) || 1;
  const paginatedSamples = filteredSamples.slice(samplePage * PAGE_SIZE, (samplePage + 1) * PAGE_SIZE);

  // 4. Live
  let filteredLive = schedules.filter((l: any) => {
    if (liveSearch && !l.creator_username?.toLowerCase().includes(liveSearch.toLowerCase())) return false;
    return true;
  });
  filteredLive = genericSort(filteredLive, liveSort, (l) => {
    if (liveSort.key === 'username') return l.creator_username;
    if (liveSort.key === 'tanggal_live') return new Date(l.tanggal_live || 0).getTime();
    return 0;
  });
  const liveTotalPages = Math.ceil(filteredLive.length / PAGE_SIZE) || 1;
  const paginatedLive = filteredLive.slice(livePage * PAGE_SIZE, (livePage + 1) * PAGE_SIZE);

  // 5. Video
  let filteredVideo = validVideos.filter((v: any) => {
    if (videoSearch && !v.creator_username?.toLowerCase().includes(videoSearch.toLowerCase())) return false;
    return true;
  });
  filteredVideo = genericSort(filteredVideo, videoSort, (v) => {
    if (videoSort.key === 'username') return v.creator_username;
    if (videoSort.key === 'total_videos') return v.total_videos || 0;
    if (videoSort.key === 'total_views') return v.total_views || 0;
    if (videoSort.key === 'total_likes') return v.total_likes || 0;
    if (videoSort.key === 'total_gmv') return v.total_gmv || 0;
    return 0;
  });
  const videoTotalPages = Math.ceil(filteredVideo.length / PAGE_SIZE) || 1;
  const paginatedVideo = filteredVideo.slice(videoPage * PAGE_SIZE, (videoPage + 1) * PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Badge variant="outline" className="mb-2 border-blue-200 bg-blue-50 text-blue-700">Portal Brand Khusus</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{campaign.nama}</h1>
          <p className="text-slate-500 mt-1">
            Periode: {new Date(campaign.start_date).toLocaleDateString('id-ID')} - {new Date(campaign.end_date).toLocaleDateString('id-ID')}
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-sm text-slate-500">Status</p>
          <Badge variant={campaign.status === 'aktif' ? 'success' : 'secondary'} className="uppercase mt-1 text-sm">
            {campaign.status}
          </Badge>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap space-x-2 border-b border-slate-200">
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'performa' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('performa')}
        >
          <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Performa</div>
        </button>
        
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'approval' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('approval')}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4"/> Listing Kreator
            {campaign.require_client_approval && approvalList.filter((cc: any) => cc.client_approval === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                {approvalList.filter((cc: any) => cc.client_approval === 'pending').length}
              </span>
            )}
          </div>
        </button>

        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sampel' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('sampel')}
        >
          <div className="flex items-center gap-2"><Package className="w-4 h-4"/> Sampel & Resi</div>
        </button>
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'live' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('live')}
        >
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4"/> Jadwal Live</div>
        </button>
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'video' as any ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('video' as any)}
        >
          <div className="flex items-center gap-2"><Video className="w-4 h-4"/> Video & Konten</div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-4">
        {activeTab === 'performa' && (
          <div className="space-y-[32px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center flex-wrap gap-[16px]">
              <div>
                <h2 className="text-[20px] font-bold">
                  {campaign.tipe_campaign === 'awareness' || campaign.tipe_campaign === 'gmv_awareness' ? "Performa Awareness Campaign" : "Performa Sales Campaign"}
                </h2>
                <p className="text-[13px] text-slate-500">Analitik pencapaian campaign secara <span className="font-bold text-green-600 border-b border-green-600">Real-Time</span>.</p>
              </div>
            </div>

            <div className="flex flex-col gap-[24px]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-[24px]">
                {/* Total Achievement Card */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-100/50 border border-green-100 rounded-xl overflow-hidden p-[24px] shadow-sm relative">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[13px] font-medium text-green-800">Total Achievement (All)</p>
                      <h3 className="text-[24px] font-bold mt-[8px] text-green-900">Rp {(displayTotalGmv / 1000000).toFixed(1)}M</h3>
                      <p className="text-[11px] font-semibold mt-[4px] text-green-700/80">Rp {displayTotalGmv.toLocaleString()}</p>
                    </div>
                    <div className="p-[12px] bg-white text-green-600 rounded-[12px] shadow-sm"><TrendingUp className="w-6 h-6" /></div>
                  </div>
                  {summary.target_gmv && (
                    <div className="mt-[16px] pt-[16px] border-t border-green-200/50">
                      <div className="flex justify-between text-[11px] mb-[4px] font-medium text-green-800">
                        <span>Target: Rp {(summary.target_gmv / 1000000).toFixed(1)}M</span>
                        <span>{percentGmv}%</span>
                      </div>
                      <div className="w-full bg-green-200/50 rounded-full h-[6px]">
                        <div className="bg-green-600 h-[6px] rounded-full transition-all duration-1000" style={{ width: `${Math.min(percentGmv, 100)}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Total Views Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-[24px] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[13px] font-medium text-slate-500">Total Views</p>
                      <h3 className="text-[24px] font-bold mt-[8px] text-slate-800">{displayTotalViews >= 1000000 ? (displayTotalViews / 1000000).toFixed(1) + 'M' : displayTotalViews.toLocaleString()}</h3>
                      <p className="text-[11px] font-semibold text-slate-500 mt-[4px]">{displayTotalViews.toLocaleString()} views</p>
                      <p className="text-[11px] text-slate-400 mt-[4px]">Akumulasi seluruh video</p>
                    </div>
                    <div className="p-[8px] bg-blue-50 text-blue-600 rounded-[8px]"><Activity className="w-5 h-5" /></div>
                  </div>
                </div>

                {/* Total Videos Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-[24px] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[13px] font-medium text-slate-500">Total Video</p>
                      <h3 className="text-[24px] font-bold mt-[8px] text-slate-800">{displayTotalVideo} <span className="text-[13px] text-slate-500 font-normal">video</span></h3>
                    </div>
                    <div className="p-[8px] bg-purple-50 text-purple-600 rounded-[8px]"><Video className="w-5 h-5" /></div>
                  </div>
                  {summary.target_video && (
                    <div className="mt-[16px] pt-[16px] border-t border-slate-100">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-[4px] font-medium">
                        <span>Target: {summary.target_video}</span>
                        <span>{percentVideo}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-[6px] flex overflow-hidden">
                        <div className="bg-purple-500 h-[6px] transition-all duration-1000" style={{ width: `${Math.min(percentVideo, 100)}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Target Creator Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-[24px] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[13px] font-medium text-slate-500">Target Creator</p>
                      <h3 className="text-[24px] font-bold mt-[8px] text-slate-800">{validApprovalList.length} <span className="text-[13px] text-slate-500 font-normal">kreator</span></h3>
                    </div>
                    <div className="p-[8px] bg-orange-50 text-orange-600 rounded-[8px]"><Users className="w-5 h-5" /></div>
                  </div>
                  {summary.target_creator && (
                    <div className="mt-[16px] pt-[16px] border-t border-slate-100">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-[4px] font-medium">
                        <span>Target: {summary.target_creator}</span>
                        <span>{Math.round((validApprovalList.length / summary.target_creator) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-[6px] flex overflow-hidden">
                        <div className="bg-orange-500 h-[6px] transition-all duration-1000" style={{ width: `${Math.min(Math.round((validApprovalList.length / summary.target_creator) * 100), 100)}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Table Performa Kreator */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50/50 p-[16px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="font-bold flex items-center gap-[8px] text-slate-800">
                    Performa per Kreator (Approved)
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari username..." 
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={performaSearch}
                      onChange={(e) => { setPerformaSearch(e.target.value); setPerformaPage(0); }}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table className="w-full text-[13px] whitespace-nowrap">
                    <TableHeader className="bg-white border-b border-slate-200">
                      <TableRow className="hover:bg-transparent">
                        <SortableHeader label="Creator" sortKey="username" currentSort={performaSort} onSort={(k) => handleSort('performa', k)} />
                        <SortableHeader label="Total VT" sortKey="total_vt" currentSort={performaSort} onSort={(k) => handleSort('performa', k)} className="text-center" />
                        <SortableHeader label="Item Sold" sortKey="items_sold" currentSort={performaSort} onSort={(k) => handleSort('performa', k)} className="text-center" />
                        <SortableHeader label="Total GMV" sortKey="total_gmv" currentSort={performaSort} onSort={(k) => handleSort('performa', k)} className="text-right" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPerforma.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-[32px] text-slate-500">Belum ada data kreator yang sesuai.</TableCell>
                        </TableRow>
                      ) : (
                        paginatedPerforma.map((c: any) => {
                          const username = c.creators?.username || 'Unknown';
                          const totalVt = c.videos?.length || 0;
                          const itemsSold = c.items_sold || 0;
                          const gmvOrganic = c.gmv_organic || 0;
                          const gmvAds = c.gmv_ads || 0;
                          const totalGmv = gmvOrganic + gmvAds;

                          return (
                            <TableRow key={c.id} className="transition-all duration-300 hover:bg-slate-50">
                              <TableCell className="font-semibold text-blue-600">
                                @{username}
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                {totalVt}
                              </TableCell>
                              <TableCell className="text-center font-bold">
                                {itemsSold} pcs
                              </TableCell>
                              <TableCell className="text-right font-bold text-slate-800">
                                Rp {totalGmv.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Performa */}
                {performaTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                    <span className="text-xs text-slate-500">
                      Menampilkan {performaPage * PAGE_SIZE + 1}-{Math.min((performaPage + 1) * PAGE_SIZE, filteredPerforma.length)} dari {filteredPerforma.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setPerformaPage(p => Math.max(0, p - 1))}
                        disabled={performaPage === 0}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                      </button>
                      <span className="text-xs font-medium text-slate-700">Hal {performaPage + 1} / {performaTotalPages}</span>
                      <button 
                        onClick={() => setPerformaPage(p => Math.min(performaTotalPages - 1, p + 1))}
                        disabled={performaPage === performaTotalPages - 1}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'approval' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="bg-blue-50 border-b border-blue-100 rounded-t-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-blue-900">Daftar Listing Kreator</CardTitle>
                  <p className="text-sm text-blue-700 mt-1">
                    Berikut adalah daftar kreator yang diajukan untuk campaign ini. 
                    {campaign.require_client_approval && " Silakan tentukan apakah Anda setuju untuk bekerja sama dengan mereka."}
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-48">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari username..." 
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={listingSearch}
                      onChange={(e) => { setListingSearch(e.target.value); setListingPage(0); }}
                    />
                  </div>
                  <div className="relative">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      className="pl-9 pr-8 py-1.5 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-white transition-all cursor-pointer"
                      value={listingTypeFilter}
                      onChange={(e) => { setListingTypeFilter(e.target.value); setListingPage(0); }}
                    >
                      <option value="all">Semua Konten</option>
                      <option value="video">Video</option>
                      <option value="live">Live</option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white">
                      <TableRow>
                        <SortableHeader label="Kreator" sortKey="username" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} className="w-48" />
                        <SortableHeader label="Followers" sortKey="followers" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} />
                        <SortableHeader label="Level" sortKey="level" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} />
                        <SortableHeader label="Tier" sortKey="tier" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} />
                        <SortableHeader label="Tipe Konten" sortKey="content_type" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} />
                        <SortableHeader label="Progres Sampel" sortKey="sample_progress" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} />
                        {campaign.require_client_approval && <SortableHeader label="Status Approval" sortKey="status_approval" currentSort={listingSort} onSort={(k) => handleSort('listing', k)} className="w-48 text-center" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedListing.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={campaign.require_client_approval ? 7 : 6} className="text-center py-8 text-slate-500">Belum ada kreator yang sesuai pencarian.</TableCell>
                        </TableRow>
                      ) : (
                        paginatedListing.map((cc: any) => (
                          <TableRow key={cc.id}>
                            <TableCell className="align-top">
                              <div className="font-semibold text-slate-900">@{cc.creators?.username}</div>
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {formatAbbreviated(cc.followers, false)}
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {cc.level || '-'}
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline" className="capitalize text-xs">{cc.tier || '-'}</Badge>
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {cc.content_type || '-'}
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {cc.sample_progress || 'Belum dikirim'}
                            </TableCell>
                            {campaign.require_client_approval && (
                              <TableCell className="align-top text-center">
                                {cc.client_approval === 'pending' ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => handleApproval(cc.id, 'approved')}
                                      disabled={isApproving === cc.id}
                                      className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 text-xs font-semibold rounded-md transition-colors"
                                    >
                                      SETUJUI
                                    </button>
                                    <button 
                                      onClick={() => handleApproval(cc.id, 'rejected')}
                                      disabled={isApproving === cc.id}
                                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-md transition-colors"
                                    >
                                      TOLAK
                                    </button>
                                  </div>
                                ) : cc.client_approval === 'rejected' ? (
                                  <Badge variant="destructive" className="uppercase shadow-sm">
                                    DITOLAK
                                  </Badge>
                                ) : (
                                  <Badge variant="success" className="uppercase shadow-sm">
                                    DISETUJUI
                                  </Badge>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Listing */}
                {listingTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-blue-100 bg-blue-50/30 rounded-b-xl">
                    <span className="text-xs text-slate-500">
                      Menampilkan {listingPage * PAGE_SIZE + 1}-{Math.min((listingPage + 1) * PAGE_SIZE, filteredListing.length)} dari {filteredListing.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setListingPage(p => Math.max(0, p - 1))}
                        disabled={listingPage === 0}
                        className="p-1 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-blue-700" />
                      </button>
                      <span className="text-xs font-medium text-slate-700">Hal {listingPage + 1} / {listingTotalPages}</span>
                      <button 
                        onClick={() => setListingPage(p => Math.min(listingTotalPages - 1, p + 1))}
                        disabled={listingPage === listingTotalPages - 1}
                        className="p-1 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-blue-700" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'sampel' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Status Pengiriman Sampel</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Pantau resi dan status pengiriman produk ke kreator yang telah disetujui.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-48">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Cari username/resi..." 
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={sampleSearch}
                      onChange={(e) => { setSampleSearch(e.target.value); setSamplePage(0); }}
                    />
                  </div>
                  <div className="relative">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      className="pl-9 pr-8 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none bg-white transition-all cursor-pointer"
                      value={sampleStatusFilter}
                      onChange={(e) => { setSampleStatusFilter(e.target.value); setSamplePage(0); }}
                    >
                      <option value="all">Semua Status</option>
                      <option value="diproses">Diproses</option>
                      <option value="dikirim">Dikirim</option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto pb-4">
                  <Table className="w-full whitespace-nowrap text-[13px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="py-[16px] px-3">No</TableHead>
                        <TableHead className="py-[16px] px-3 min-w-[150px]">Product</TableHead>
                        <SortableHeader label="Username" sortKey="username" currentSort={sampleSort} onSort={(k) => handleSort('sample', k)} className="px-3" />
                        <TableHead className="py-[16px] px-3">No Whatsapp</TableHead>
                        <TableHead className="py-[16px] px-3 min-w-[150px]">Nama Penerima</TableHead>
                        <TableHead className="py-[16px] px-3 min-w-[200px]">Nama Jalan</TableHead>
                        <TableHead className="py-[16px] px-3">Provinsi</TableHead>
                        <TableHead className="py-[16px] px-3">Kabupaten/Kota</TableHead>
                        <TableHead className="py-[16px] px-3">Kecamatan</TableHead>
                        <TableHead className="py-[16px] px-3">Kelurahan</TableHead>
                        <TableHead className="py-[16px] px-3">Kode Pos</TableHead>
                        <SortableHeader label="Proses" sortKey="proses" currentSort={sampleSort} onSort={(k) => handleSort('sample', k)} className="px-3 min-w-[120px]" />
                        <SortableHeader label="Tanggal Kirim" sortKey="tanggal_kirim" currentSort={sampleSort} onSort={(k) => handleSort('sample', k)} className="px-3" />
                        <SortableHeader label="Resi" sortKey="resi" currentSort={sampleSort} onSort={(k) => handleSort('sample', k)} className="px-3" />
                        <TableHead className="py-[16px] px-3 min-w-[150px]">Notes</TableHead>
                        <TableHead className="py-[16px] px-3">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSamples.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={16} className="text-center py-8 text-slate-500">Belum ada data pengiriman sampel yang sesuai.</TableCell>
                        </TableRow>
                      ) : (
                        paginatedSamples.map((addr: any, idx: number) => {
                          const cc = approvalList.find((c: any) => c.id === addr.campaign_creator_id);
                          const skuNames = (cc?.assigned_sku_ids || []).map((id: number) => {
                            const sku = skus?.find((s: any) => s.id === id);
                            return sku ? sku.nama_produk : '';
                          }).filter(Boolean);
                          const noWhatsapp = cc?.no_whatsapp || '-';

                          return (
                            <TableRow key={addr.id} className="hover:bg-slate-50/50">
                              <TableCell className="px-3 py-3 text-center">{samplePage * PAGE_SIZE + idx + 1}</TableCell>
                              <TableCell className="px-3 py-3 whitespace-normal">
                                <div className="flex flex-col gap-1 w-[200px]">
                                  {skuNames.length > 0 ? (
                                    skuNames.map((name: string, i: number) => (
                                      <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded border border-blue-100">{name}</span>
                                    ))
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">Belum dipilih</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-3 font-medium">@{addr.creator_username}</TableCell>
                              <TableCell className="px-3 py-3">{noWhatsapp}</TableCell>
                              <TableCell className="px-3 py-3">{addr.nama_penerima || '-'}</TableCell>
                              <TableCell className="px-3 py-3 whitespace-normal">{addr.nama_jalan || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.provinsi || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kabupaten_kota || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kecamatan || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kelurahan || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kode_pos || '-'}</TableCell>
                              <TableCell className="px-3 py-3">
                                <select 
                                  className="w-full text-[12px] p-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white" 
                                  value={editedSamples[addr.id]?.proses ?? (addr.proses || 'Diproses')} 
                                  onChange={e => handleQueueUpdate(addr.id, 'proses', e.target.value)}
                                >
                                  <option value="Diproses">Diproses</option>
                                  <option value="Dikirim">Dikirim</option>
                                  <option value="Diterima">Diterima</option>
                                  <option value="Kendala [FUI]">Kendala [FUI]</option>
                                  <option value="Batal">Batal</option>
                                </select>
                              </TableCell>
                              <TableCell className="px-3 py-3">
                                {editedSamples[addr.id]?.proses === 'Dikirim' ? 'Akan set hari ini' : (addr.tanggal_kirim || '-')}
                              </TableCell>
                              <TableCell className="px-3 py-3 font-mono">
                                <input 
                                  type="text" 
                                  className="w-full text-[12px] p-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[120px]" 
                                  placeholder="Input resi..." 
                                  value={editedSamples[addr.id]?.resi ?? (addr.resi || '')} 
                                  onChange={e => handleQueueUpdate(addr.id, 'resi', e.target.value)} 
                                />
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-normal">
                                <input 
                                  type="text" 
                                  className="w-full text-[12px] p-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[150px]" 
                                  placeholder="Notes..." 
                                  value={editedSamples[addr.id]?.notes ?? (addr.notes || '')} 
                                  onChange={e => handleQueueUpdate(addr.id, 'notes', e.target.value)} 
                                />
                              </TableCell>
                              <TableCell className="px-3 py-3 text-center">
                                <span className="inline-block px-[8px] py-[2px] border border-slate-200 rounded-[4px] text-[10px] font-semibold text-slate-500 uppercase bg-slate-100">
                                  {cc?.client_approval === 'NOT_REQUIRED' ? 'APPROVED' : (cc?.client_approval || 'pending')}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Sampel */}
                {sampleTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 -mx-6 -mb-6 mt-4">
                    <span className="text-xs text-slate-500">
                      Menampilkan {samplePage * PAGE_SIZE + 1}-{Math.min((samplePage + 1) * PAGE_SIZE, filteredSamples.length)} dari {filteredSamples.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSamplePage(p => Math.max(0, p - 1))}
                        disabled={samplePage === 0}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                      </button>
                      <span className="text-xs font-medium text-slate-700">Hal {samplePage + 1} / {sampleTotalPages}</span>
                      <button 
                        onClick={() => setSamplePage(p => Math.min(sampleTotalPages - 1, p + 1))}
                        disabled={samplePage === sampleTotalPages - 1}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Jadwal Live Kreator</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">Jadwal sesi live streaming yang telah disepakati.</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cari username..." 
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={liveSearch}
                    onChange={(e) => { setLiveSearch(e.target.value); setLivePage(0); }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <SortableHeader label="Kreator" sortKey="username" currentSort={liveSort} onSort={(k) => handleSort('live', k)} className="w-48" />
                        <SortableHeader label="Tanggal Live" sortKey="tanggal_live" currentSort={liveSort} onSort={(k) => handleSort('live', k)} />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLive.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-8 text-slate-500">Belum ada jadwal live yang sesuai pencarian.</TableCell>
                        </TableRow>
                      ) : (
                        paginatedLive.map((l: any) => (
                          <TableRow key={l.id}>
                            <TableCell className="align-top">
                              <div className="font-medium text-slate-800">@{l.creator_username}</div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline" className="px-3 py-1 text-blue-700 bg-blue-50 border-blue-200 text-sm">
                                {new Date(l.tanggal_live).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Live */}
                {liveTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 mt-4 -mx-6 -mb-6">
                    <span className="text-xs text-slate-500">
                      Menampilkan {livePage * PAGE_SIZE + 1}-{Math.min((livePage + 1) * PAGE_SIZE, filteredLive.length)} dari {filteredLive.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setLivePage(p => Math.max(0, p - 1))}
                        disabled={livePage === 0}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                      </button>
                      <span className="text-xs font-medium text-slate-700">Hal {livePage + 1} / {liveTotalPages}</span>
                      <button 
                        onClick={() => setLivePage(p => Math.min(liveTotalPages - 1, p + 1))}
                        disabled={livePage === liveTotalPages - 1}
                        className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'video' as any && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="bg-blue-50 border-b border-blue-100 rounded-t-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-blue-900">Daftar Video Konten</CardTitle>
                  <p className="text-sm text-blue-700 mt-1">
                    Berikut adalah daftar video TikTok yang telah dibuat dan diposting oleh kreator.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cari username..." 
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={videoSearch}
                    onChange={(e) => { setVideoSearch(e.target.value); setVideoPage(0); }}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white">
                      <TableRow>
                        <TableHead className="w-16 text-center">No</TableHead>
                        <SortableHeader label="Kreator" sortKey="username" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="w-48" />
                        <SortableHeader label="Total Video" sortKey="total_videos" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="w-32 text-center" />
                        <SortableHeader label="Total Views" sortKey="total_views" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="text-right" />
                        <SortableHeader label="Total Likes" sortKey="total_likes" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="text-right" />
                        <SortableHeader label="Total Sales GMV" sortKey="total_gmv" currentSort={videoSort} onSort={(k) => handleSort('video', k)} className="text-right" />
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedVideo.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-slate-500">Belum ada video yang sesuai pencarian.</TableCell>
                        </TableRow>
                      ) : (
                        paginatedVideo.map((creatorGroup: any, index: number) => (
                          <React.Fragment key={creatorGroup.creator_username || index}>
                            <TableRow 
                              className="hover:bg-slate-50 transition-colors cursor-pointer group"
                              onClick={() => setExpandedVideos(prev => ({...prev, [creatorGroup.creator_username]: !prev[creatorGroup.creator_username]}))}
                            >
                              <TableCell className="text-center font-medium text-slate-500">{videoPage * PAGE_SIZE + index + 1}</TableCell>
                              <TableCell>
                                <a 
                                  href={`https://www.tiktok.com/@${creatorGroup.creator_username}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  @{creatorGroup.creator_username}
                                </a>
                              </TableCell>
                              <TableCell className="text-center font-semibold text-slate-700">
                                {creatorGroup.total_videos} Video
                              </TableCell>
                              <TableCell className="text-right font-medium text-slate-700">{creatorGroup.total_views > 0 ? creatorGroup.total_views.toLocaleString() : '-'}</TableCell>
                              <TableCell className="text-right font-medium text-slate-700">{creatorGroup.total_likes > 0 ? creatorGroup.total_likes.toLocaleString() : '-'}</TableCell>
                              <TableCell className="text-right font-bold text-green-700">
                                Rp {creatorGroup.total_gmv.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-center">
                                {expandedVideos[creatorGroup.creator_username] ? (
                                  <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-blue-500 mx-auto" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-blue-500 mx-auto" />
                                )}
                              </TableCell>
                            </TableRow>
                            {expandedVideos[creatorGroup.creator_username] && (
                              <TableRow className="bg-slate-50/50">
                                <TableCell colSpan={7} className="p-0 border-b-2 border-slate-200">
                                  <div className="px-16 py-4">
                                    <Table className="w-full text-sm bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                      <TableHeader className="bg-slate-100/50">
                                        <TableRow>
                                          <TableHead className="w-12 text-center text-slate-500">No</TableHead>
                                          <TableHead>Link Video</TableHead>
                                          <TableHead className="text-right text-slate-500">Views</TableHead>
                                          <TableHead className="text-right text-slate-500">Likes</TableHead>
                                          <TableHead className="text-right text-slate-500">Sales GMV</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {creatorGroup.videos.map((v: any, vIdx: number) => (
                                          <TableRow key={v.id || vIdx}>
                                            <TableCell className="text-center text-slate-400">{vIdx + 1}</TableCell>
                                            <TableCell>
                                              {v.link_video ? (
                                                <a href={v.link_video} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 font-medium">
                                                  <Video className="w-4 h-4" /> Nonton di TikTok
                                                </a>
                                              ) : (
                                                <span className="text-slate-400 italic">Belum ada link</span>
                                              )}
                                              {v.isAuto && (
                                                <span className="inline-block mt-1 bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold">Auto Tracked</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-slate-600">{v.views > 0 ? v.views.toLocaleString() : '-'}</TableCell>
                                            <TableCell className="text-right font-medium text-slate-600">{v.likes > 0 ? v.likes.toLocaleString() : '-'}</TableCell>
                                            <TableCell className="text-right font-semibold text-green-700">Rp {(v.gmv || 0).toLocaleString()}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Video */}
                {videoTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-blue-100 bg-blue-50/30 rounded-b-xl">
                    <span className="text-xs text-slate-500">
                      Menampilkan {videoPage * PAGE_SIZE + 1}-{Math.min((videoPage + 1) * PAGE_SIZE, filteredVideo.length)} dari {filteredVideo.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setVideoPage(p => Math.max(0, p - 1))}
                        disabled={videoPage === 0}
                        className="p-1 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-blue-700" />
                      </button>
                      <span className="text-xs font-medium text-slate-700">Hal {videoPage + 1} / {videoTotalPages}</span>
                      <button 
                        onClick={() => setVideoPage(p => Math.min(videoTotalPages - 1, p + 1))}
                        disabled={videoPage === videoTotalPages - 1}
                        className="p-1 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-blue-700" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
