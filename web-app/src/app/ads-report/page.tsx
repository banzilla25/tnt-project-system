"use client";

import React, { useState, useRef, useEffect, useDeferredValue, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { createClient } from "@/utils/supabase/client";
import { Edit2, Check, X, Search, FileSpreadsheet, Loader2, Trash2, Lock, Download, DollarSign, TrendingUp, AlertCircle, BarChart3, ChevronUp, ChevronDown, Eye, Activity, UploadCloud, Calendar } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { exportToExcel } from "@/utils/exportToExcel";
import { Button } from "@/components/ui/Button";

import { SearchableSelect } from "@/components/SearchableSelect";
import { StringCombobox } from "@/components/StringCombobox";

export default function AdsReportPage() {
  const { creators, campaigns } = useDatabaseStore();
  const [adsPerformance, setAdsPerformance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  // Date Filter States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const supabase = createClient();

  // Pagination & Sorting States
  const [displayLimit, setDisplayLimit] = useState(100);
  type SortColumn = 'tanggal' | 'ad_id' | 'ad_name' | 'campaign_ads_name' | 'campaign_id' | 'creator_id' | 'kurs' | 'cost_usd' | 'gross_revenue_usd' | 'impressions' | 'clicks' | 'product_page_views' | 'checkouts_initiated' | 'purchases' | 'items_purchased';
  const [sortConfig, setSortConfig] = useState<{ key: SortColumn; direction: 'asc' | 'desc' } | null>({ key: 'tanggal', direction: 'desc' });

  const handleSort = (key: SortColumn) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  useEffect(() => {
    const fetchAds = async () => {
      setIsLoading(true);
      let query = supabase.from('ads_performance').select('*, creators(username)').order('tanggal', { ascending: false }).limit(2000);
      
      if (startDate) {
        query = query.gte('tanggal', startDate);
      }
      if (endDate) {
        query = query.lte('tanggal', endDate);
      }
      
      const { data } = await query;
      if (data) setAdsPerformance(data);
      setIsLoading(false);
    };
    fetchAds();
  }, [supabase, startDate, endDate]);
  
  // Inline Auto-Save States
  type PendingAdChange = { campaign_id?: number | null; campaign_ads_name?: string | null; creator_id?: number | null; kurs?: number; ad_id?: string; original: any };
  const [pendingChanges, setPendingChanges] = useState<Map<number, PendingAdChange>>(new Map());
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [batchSaveProgress, setBatchSaveProgress] = useState(0);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // beforeunload protection
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingChanges.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingChanges.size]);

  const batchSaveAll = async () => {
    if (pendingChanges.size === 0 || isBatchSaving) return;
    setIsBatchSaving(true);
    setBatchSaveProgress(0);
    
    let processed = 0;
    const total = pendingChanges.size;
    const currentAds = [...adsPerformance];
    
    for (const [adId, change] of pendingChanges.entries()) {
      const updates: any = {};
      if (change.campaign_id !== undefined) updates.campaign_id = change.campaign_id;
      if (change.campaign_ads_name !== undefined) updates.campaign_ads_name = change.campaign_ads_name;
      if (change.creator_id !== undefined) updates.creator_id = change.creator_id;
      if (change.kurs !== undefined) updates.kurs = change.kurs;
      if (change.ad_id !== undefined) updates.ad_id = change.ad_id;
      
      let newUsername = change.original.creators?.username;
      if (updates.creator_id !== undefined && updates.creator_id !== change.original.creator_id) {
        if (updates.creator_id === null) {
          newUsername = null;
        } else {
          const { data: creatorData } = await supabase.from('creators').select('username').eq('id', updates.creator_id).single();
          if (creatorData) newUsername = creatorData.username;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('ads_performance').update(updates).eq('id', adId);
        if (!error) {
           const adIndex = currentAds.findIndex(a => a.id === adId);
           if (adIndex !== -1) {
             currentAds[adIndex] = { 
               ...currentAds[adIndex], 
               ...updates, 
               creators: newUsername !== undefined ? (newUsername ? { username: newUsername } : null) : currentAds[adIndex].creators 
             };
           }
        }
      }
      
      processed++;
      setBatchSaveProgress(Math.round((processed / total) * 100));
    }
    
    setAdsPerformance(currentAds);
    setPendingChanges(new Map());
    setIsBatchSaving(false);
  };

  useEffect(() => {
    if (pendingChanges.size > 0 && !isBatchSaving) {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => {
        batchSaveAll();
      }, 2000);
    }
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [pendingChanges, isBatchSaving]);

  const setCellChange = (adId: number, field: keyof PendingAdChange, value: any, originalAd: any) => {
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(adId) || { original: originalAd };
      
      let isDifferent = false;
      if (field === 'campaign_id') isDifferent = value !== originalAd.campaign_id;
      else if (field === 'campaign_ads_name') isDifferent = value !== originalAd.campaign_ads_name;
      else if (field === 'creator_id') isDifferent = value !== originalAd.creator_id;
      else if (field === 'kurs') isDifferent = value !== originalAd.kurs;
      else if (field === 'ad_id') isDifferent = value !== originalAd.ad_id;
      
      if (isDifferent) {
        existing[field] = value;
        newMap.set(adId, existing);
      } else {
        delete existing[field];
        if (Object.keys(existing).length <= 1) newMap.delete(adId);
        else newMap.set(adId, existing);
      }
      return newMap;
    });
  };

  const getPendingValue = (adId: number, field: keyof PendingAdChange, originalValue: any) => {
    const change = pendingChanges.get(adId);
    if (change && change[field] !== undefined) return change[field];
    return originalValue;
  };

  const deleteAd = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data iklan ini secara permanen?")) return;
    setDeletingId(id);
    
    const { error } = await supabase.from('ads_performance').delete().eq('id', id);
    if (!error) {
      setAdsPerformance(prev => prev.filter(ad => ad.id !== id));
    } else {
      alert("Gagal menghapus data: " + error.message);
    }
    setDeletingId(null);
  };

  // 1. Filter by Search Query ONLY (for Campaign Cards)
  const searchFilteredAds = useMemo(() => {
    return adsPerformance.filter(ad => {
      if (!deferredSearchQuery) return true;
      const q = deferredSearchQuery.toLowerCase();
      return (
        (ad.ad_name && ad.ad_name.toLowerCase().includes(q)) || 
        (ad.ad_id && ad.ad_id.toLowerCase().includes(q))
      );
    }).sort((a, b) => {
      if (!sortConfig) return 0;
      
      const { key, direction } = sortConfig;
      let valA = a[key];
      let valB = b[key];

      if (key === 'tanggal') {
        valA = new Date(valA || '1970-01-01').getTime();
        valB = new Date(valB || '1970-01-01').getTime();
      } else if (key === 'campaign_id') {
         valA = campaigns.find(c => c.id === valA)?.nama || '';
         valB = campaigns.find(c => c.id === valB)?.nama || '';
      } else if (key === 'creator_id') {
         valA = a.creators?.username || '';
         valB = b.creators?.username || '';
      } else if (key === 'cost_usd' || key === 'gross_revenue_usd' || key === 'kurs') {
         valA = Number(valA || 0);
         valB = Number(valB || 0);
      } else {
         valA = String(valA || '');
         valB = String(valB || '');
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [adsPerformance, deferredSearchQuery, sortConfig, campaigns]);

  // 2. Filter by Search Query AND Clicked Campaign (for Table & Global Summary)
  const tableFilteredAds = useMemo(() => {
    if (selectedCampaignId === null) return searchFilteredAds;
    return searchFilteredAds.filter(ad => ad.campaign_id === selectedCampaignId);
  }, [searchFilteredAds, selectedCampaignId]);

  // 3. Campaign Breakdown Calculation (from searchFilteredAds)
  const campaignBreakdown = useMemo(() => {
    const summary: Record<number, { name: string, spend: number, gmv: number, views: number, unmapped: number }> = {};
    let globalUnmappedCampaigns = 0;

    searchFilteredAds.forEach(ad => {
      const kurs = ad.kurs || 16000;
      const spendIDR = (ad.cost_usd || 0) * kurs;
      const gmvIDR = (ad.gross_revenue_usd || 0) * kurs;
      const views = ad.video_views || 0;
      
      const cId = ad.campaign_id;
      if (!cId) {
        globalUnmappedCampaigns++;
        return;
      }
      
      if (!summary[cId]) {
        summary[cId] = { 
          name: campaigns.find(c => c.id === cId)?.nama || 'Unknown', 
          spend: 0, 
          gmv: 0, 
          views: 0,
          unmapped: 0 
        };
      }
      
      summary[cId].spend += spendIDR;
      summary[cId].gmv += gmvIDR;
      summary[cId].views += views;
      if (!ad.creator_id) summary[cId].unmapped++;
    });

    const list = Object.entries(summary).map(([id, data]) => ({ id: Number(id), ...data }));
    list.sort((a, b) => b.gmv - a.gmv); // sort by GMV highest

    return { list, globalUnmappedCampaigns };
  }, [searchFilteredAds, campaigns]);

  const globalCampaignAdsOptions = useMemo(() => {
    return Array.from(new Set(adsPerformance.map(ad => ad.campaign_ads_name).filter(Boolean))) as string[];
  }, [adsPerformance]);

  // 4. Global Summary Calculation (from tableFilteredAds)
  const globalSummary = useMemo(() => {
    let totalSpend = 0;
    let totalGmv = 0;
    let totalViews = 0;
    let totalUnmapped = 0;

    tableFilteredAds.forEach(ad => {
      const kurs = ad.kurs || 16000;
      totalSpend += (ad.cost_usd || 0) * kurs;
      totalGmv += (ad.gross_revenue_usd || 0) * kurs;
      totalViews += (ad.video_views || 0);
      if (!ad.campaign_id || !ad.creator_id) totalUnmapped++;
    });

    const roas = totalSpend > 0 ? totalGmv / totalSpend : 0;
    const cpv = totalViews > 0 ? totalSpend / totalViews : 0;
    return { totalSpend, totalGmv, totalViews, totalUnmapped, roas, cpv };
  }, [tableFilteredAds]);

  // const creatorOptions = creators.map(c => ({ id: c.id, label: `@${c.username}` }));

  const handleExport = () => {
    const dataToExport = tableFilteredAds.map(ad => ({
      "Tanggal": ad.tanggal,
      "Campaign": campaigns.find(c => c.id === ad.campaign_id)?.nama || 'Unknown',
      "Creator": ad.creators?.username || 'Unknown',
      "Ad Name": ad.ad_name,
      "Ad ID": ad.ad_id,
      "Cost": ad.cost,
      "Kurs": ad.kurs,
      "Cost (IDR)": (ad.cost || 0) * (ad.kurs || 16000),
      "Video Views": ad.video_views,
      "GMV (VSA)": ad.vsa_gmv
    }));
    exportToExcel(dataToExport, "Laporan_Ads_Export");
  };

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-2">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Akses Ditolak</h2>
        <p className="text-slate-500 max-w-md">
          Hanya pengguna dengan role <span className="font-semibold text-slate-700">Manager</span> yang diizinkan untuk melihat Ads Report.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Laporan Ads & Performa</h1>
          <p className="text-slate-500">Pemetaan Manual Ad ID dari TikTok Ads Manager ke Creator & Campaign.</p>
        </div>
        <div className="flex items-center gap-4">

          <div className="relative w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Ad Name, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Link href="/ads-report/import-ads">
            <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <UploadCloud className="w-4 h-4" /> Import Data Iklan
            </Button>
          </Link>
          <Button onClick={handleExport} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white">
            <Download className="w-4 h-4" /> Export Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
      <>
        {/* Global Summary Cards */}
        {globalSummary.totalUnmapped > 0 && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Perhatian: {globalSummary.totalUnmapped} Iklan Belum Di-Map!</h3>
                <p className="text-amber-50 text-sm">Ada {globalSummary.totalUnmapped} data ads yang belum terhubung ke Campaign atau Kreator. Segera lengkapi agar ROAS akurat.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="border-0 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-red-500/20"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Spend (IDR)</p>
                <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
                  Rp {globalSummary.totalSpend.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                </h3>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/20"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total GMV (IDR)</p>
                <h3 className="text-2xl font-bold text-emerald-600 tracking-tight">
                  Rp {globalSummary.totalGmv.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-blue-500/20"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">ROAS Keseluruhan</p>
                <h3 className={`text-2xl font-bold tracking-tight ${globalSummary.roas >= 2 ? 'text-emerald-600' : globalSummary.roas >= 1 ? 'text-amber-500' : 'text-red-500'}`}>
                  {globalSummary.roas.toFixed(2)}x
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-purple-500/20"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                  <Eye className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Views</p>
                <h3 className="text-2xl font-bold text-purple-700 tracking-tight">
                  {globalSummary.totalViews.toLocaleString('id-ID')}
                </h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-white/60 backdrop-blur-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-orange-500/20"></div>
            <CardContent className="p-5 relative z-10">
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Cost Per View (IDR)</p>
                <h3 className="text-2xl font-bold text-orange-600 tracking-tight">
                  Rp {globalSummary.cpv.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                </h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign Breakdown Cards (Interactive Filter) */}
        {campaignBreakdown.list.length > 0 && (
          <div className="py-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Campaign Breakdown (Klik untuk Filter Tabel)</h3>
              {selectedCampaignId && (
                <button 
                  onClick={() => setSelectedCampaignId(null)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Hapus Filter
                </button>
              )}
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar snap-x">
              {campaignBreakdown.list.map(camp => {
                const roas = camp.spend > 0 ? camp.gmv / camp.spend : 0;
                const isActive = selectedCampaignId === camp.id;
                return (
                  <div 
                    key={camp.id}
                    onClick={() => setSelectedCampaignId(isActive ? null : camp.id)}
                    className={`flex-shrink-0 w-[280px] p-5 rounded-2xl transition-all cursor-pointer snap-start relative overflow-hidden group ${
                      isActive 
                        ? 'bg-blue-600 shadow-xl shadow-blue-500/30 text-white' 
                        : 'bg-white/80 backdrop-blur-md border border-slate-200/60 hover:shadow-xl hover:shadow-slate-200/50 text-slate-800'
                    }`}
                  >
                    {isActive && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>}
                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <h4 className={`font-bold truncate pr-2 text-lg ${isActive ? 'text-white' : 'text-slate-800'}`} title={camp.name}>{camp.name}</h4>
                      {camp.unmapped > 0 && (
                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 shadow-sm ${isActive ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'}`} title={`${camp.unmapped} iklan belum di-map`}>
                          <AlertCircle className="w-3 h-3" /> {camp.unmapped}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2 mb-3 relative z-10">
                      <div className="flex justify-between text-xs">
                        <span className={isActive ? 'text-blue-100' : 'text-slate-500'}>Spend:</span>
                        <span className={`font-bold ${isActive ? 'text-white' : 'text-slate-700'}`}>Rp {(camp.spend / 1000000).toFixed(1)}M</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className={isActive ? 'text-blue-100' : 'text-slate-500'}>GMV:</span>
                        <span className={`font-bold ${isActive ? 'text-emerald-300' : 'text-emerald-600'}`}>Rp {(camp.gmv / 1000000).toFixed(1)}M</span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-slate-200/50 rounded-full mb-3 overflow-hidden flex relative z-10">
                      <div className="h-full bg-red-400" style={{ width: `${Math.min((camp.spend / (camp.gmv || 1)) * 100, 100)}%` }}></div>
                      <div className="h-full bg-emerald-400 flex-1"></div>
                    </div>

                    <div className={`flex justify-between items-center text-xs pt-3 border-t ${isActive ? 'border-white/20' : 'border-slate-100'} mt-2 relative z-10`}>
                      <div className="flex flex-col">
                        <span className={isActive ? 'text-blue-100 text-[10px]' : 'text-slate-400 text-[10px]'}>ROAS</span>
                        <span className={`font-black text-sm ${isActive ? 'text-white' : (roas >= 2 ? 'text-emerald-600' : roas >= 1 ? 'text-amber-500' : 'text-red-500')}`}>
                          {roas.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className={isActive ? 'text-blue-100 text-[10px]' : 'text-slate-400 text-[10px]'}>CPV</span>
                        <span className={`font-bold text-sm ${isActive ? 'text-white' : 'text-slate-700'}`}>
                          Rp {camp.views > 0 ? (camp.spend / camp.views).toFixed(0) : '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Auto-Save Toast Banner */}
        {(pendingChanges.size > 0 || isBatchSaving) && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-none animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-slate-900/90 backdrop-blur-sm text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700/50">
              {isBatchSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                  <span className="text-sm font-medium tracking-wide">Menyimpan pemetaan... {batchSaveProgress}%</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span className="text-sm font-medium tracking-wide text-amber-100">Menunggu {pendingChanges.size} perubahan (Autosave dalam 2d)...</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6 mb-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Calendar className="w-4 h-4 text-indigo-600" /> Filter Tanggal Laporan:
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              className="p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-slate-500 text-sm">s/d</span>
            <input 
              type="date" 
              className="p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-2 text-red-500 hover:bg-red-50 rounded"
                title="Reset Filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center justify-between w-full text-lg">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              Database Iklan ({tableFilteredAds.length} baris)
              {selectedCampaignId && <span className="ml-2 text-xs font-normal px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Filtered</span>}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <Table className="whitespace-nowrap">
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm select-none">
                <TableRow>
                  <TableHead className="w-[100px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('tanggal')}>
                    <div className="flex items-center gap-1">Tanggal {sortConfig?.key === 'tanggal' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[120px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('ad_id')}>
                    <div className="flex items-center gap-1">Ad ID {sortConfig?.key === 'ad_id' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="max-w-[200px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('ad_name')}>
                    <div className="flex items-center gap-1">Ad Name {sortConfig?.key === 'ad_name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[150px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('campaign_id')}>
                    <div className="flex items-center gap-1">Campaign Sistem {sortConfig?.key === 'campaign_id' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[150px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('campaign_ads_name')}>
                    <div className="flex items-center gap-1">Campaign Ads {sortConfig?.key === 'campaign_ads_name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[150px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('creator_id')}>
                    <div className="flex items-center gap-1">Kreator {sortConfig?.key === 'creator_id' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[100px] text-center cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('kurs')}>
                    <div className="flex items-center justify-center gap-1">Kurs {sortConfig?.key === 'kurs' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('cost_usd')}>
                    <div className="flex items-center justify-end gap-1">Cost (USD) {sortConfig?.key === 'cost_usd' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('impressions')}>
                    <div className="flex items-center justify-end gap-1">Impressions {sortConfig?.key === 'impressions' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('clicks')}>
                    <div className="flex items-center justify-end gap-1">Clicks {sortConfig?.key === 'clicks' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('product_page_views')}>
                    <div className="flex items-center justify-end gap-1">PP Views {sortConfig?.key === 'product_page_views' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right">PP View Rate</TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('checkouts_initiated')}>
                    <div className="flex items-center justify-end gap-1">Checkouts {sortConfig?.key === 'checkouts_initiated' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('purchases')}>
                    <div className="flex items-center justify-end gap-1">Purchases {sortConfig?.key === 'purchases' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('items_purchased')}>
                    <div className="flex items-center justify-end gap-1">Items {sortConfig?.key === 'items_purchased' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('gross_revenue_usd')}>
                    <div className="flex items-center justify-end gap-1">Gross Rev (USD) {sortConfig?.key === 'gross_revenue_usd' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">Cost/Purchase</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Purchase Rate</TableHead>
                  <TableHead className="text-right">AOV</TableHead>
                  <TableHead className="w-[80px] text-center sticky right-0 bg-slate-50 z-20">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableFilteredAds.slice(0, displayLimit).map((ad) => {
                  const pendingCampaignId = getPendingValue(ad.id, 'campaign_id', ad.campaign_id);
                  const pendingCreatorId = getPendingValue(ad.id, 'creator_id', ad.creator_id);
                  const pendingKurs = getPendingValue(ad.id, 'kurs', ad.kurs);
                  const pendingAdId = getPendingValue(ad.id, 'ad_id', ad.ad_id);
                  const pendingCampaignAdsName = getPendingValue(ad.id, 'campaign_ads_name', ad.campaign_ads_name);
                  const hasPending = pendingChanges.has(ad.id);
                  
                  const creatorUsername = ad.creators?.username;
                  const originalCampaign = campaigns.find(c => c.id === ad.campaign_id);

                  const cost = ad.cost_usd || 0;
                  const impr = ad.impressions || 0;
                  const clicks = ad.clicks || 0;
                  const ppv = ad.product_page_views || 0;
                  const checkouts = ad.checkouts_initiated || 0;
                  const purchases = ad.purchases || 0;
                  const items = ad.items_purchased || 0;
                  const rev = ad.gross_revenue_usd || 0;

                  const ppvRate = clicks > 0 ? (ppv / clicks) * 100 : 0;
                  const roas = cost > 0 ? (rev / cost) : 0;
                  const cpm = impr > 0 ? (cost / impr) * 1000 : 0;
                  const cpc = clicks > 0 ? (cost / clicks) : 0;
                  const cpp = purchases > 0 ? (cost / purchases) : 0;
                  const ctr = impr > 0 ? (clicks / impr) * 100 : 0;
                  const purchaseRate = clicks > 0 ? (purchases / clicks) * 100 : 0;
                  const aov = purchases > 0 ? (rev / purchases) : 0;

                  return (
                    <TableRow key={ad.id} className={`hover:bg-slate-50/50 transition-colors ${hasPending ? 'bg-amber-50/30' : ''}`}>
                      <TableCell className="text-xs text-slate-500">{ad.tanggal ? new Date(ad.tanggal).toLocaleDateString('id-ID') : '-'}</TableCell>
                      
                      <TableCell className="font-medium text-xs">
                        <input
                          type="text"
                          placeholder="Ad ID"
                          className={`w-full p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 bg-transparent ${!pendingAdId ? 'border-red-300 outline-red-300' : 'border-transparent hover:border-slate-300'}`}
                          value={pendingAdId || ''}
                          onChange={(e) => setCellChange(ad.id, 'ad_id', e.target.value, ad)}
                        />
                      </TableCell>
                      
                      <TableCell className="text-xs font-medium text-slate-700">
                        <div className="max-w-[200px] truncate" title={ad.ad_name}>{ad.ad_name}</div>
                      </TableCell>
                      
                      {/* Campaign Column */}
                      <TableCell>
                        <select
                          className={`w-full p-1.5 border rounded text-xs focus:outline-none focus:border-indigo-500 bg-transparent ${!pendingCampaignId ? 'border-red-300 text-red-600 font-semibold' : 'border-transparent hover:border-slate-300 text-indigo-700 font-medium'}`}
                          value={pendingCampaignId || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            setCellChange(ad.id, 'campaign_id', val, ad);
                            if (val !== ad.campaign_id) {
                               setCellChange(ad.id, 'creator_id', null, ad); // reset creator if campaign changes
                            }
                          }}
                        >
                          <option value="">PILIH CAMPAIGN</option>
                          {campaigns.filter(c => c.status === 'aktif' || c.id === ad.campaign_id).map(c => (
                            <option key={c.id} value={c.id}>{c.nama}</option>
                          ))}
                        </select>
                      </TableCell>

                      {/* Campaign Ads Column */}
                      <TableCell className="text-xs font-medium text-slate-700 min-w-[200px]">
                        <StringCombobox
                          value={pendingCampaignAdsName || ''}
                          onChange={(val) => setCellChange(ad.id, 'campaign_ads_name', val, ad)}
                          options={globalCampaignAdsOptions}
                          placeholder="Campaign Ads"
                          className="w-full p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 bg-transparent border-transparent hover:border-slate-300"
                        />
                      </TableCell>

                      {/* Creator Column */}
                      <TableCell>
                        {pendingCampaignId ? (
                          <div className={!pendingCreatorId ? 'ring-1 ring-red-300 rounded' : ''}>
                            <SearchableSelect 
                              value={pendingCreatorId || ''} 
                              onChange={(val) => setCellChange(ad.id, 'creator_id', val === '' ? null : val, ad)} 
                              placeholder="Ketik username..." 
                              initialLabel={creatorUsername ? `@${creatorUsername}` : ''}
                            />
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">Pilih campaign dulu</span>
                        )}
                      </TableCell>

                      {/* Kurs Column */}
                      <TableCell>
                        <div className="flex items-center gap-1 group">
                          <span className="text-xs text-slate-400 group-hover:text-slate-600">Rp</span>
                          <input
                            type="number"
                            className="w-full p-1 border border-transparent hover:border-slate-300 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 bg-transparent"
                            value={pendingKurs || ''}
                            onChange={(e) => setCellChange(ad.id, 'kurs', Number(e.target.value), ad)}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        ${cost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        {impr.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        {clicks.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        {ppv.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        {ppvRate.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        {checkouts.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        {purchases.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        {items.toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-green-600">
                        ${rev.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        {roas.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        ${cpm.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        ${cpc.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        ${cpp.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        {ctr.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        {purchaseRate.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        ${aov.toFixed(2)}
                      </TableCell>
                      
                      {/* Action Column */}
                      <TableCell className="text-center sticky right-0 bg-slate-50 z-10 border-l border-slate-100 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => deleteAd(ad.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" disabled={deletingId === ad.id} title="Hapus Permanen">
                            {deletingId === ad.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {tableFilteredAds.length > displayLimit && (
              <div className="flex justify-center p-4 border-t border-slate-100">
                <Button variant="outline" onClick={() => setDisplayLimit(prev => prev + 100)}>
                  Tampilkan Lainnya ({tableFilteredAds.length - displayLimit} lagi)
                </Button>
              </div>
            )}
            {tableFilteredAds.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                Tidak ada data iklan yang ditemukan.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
