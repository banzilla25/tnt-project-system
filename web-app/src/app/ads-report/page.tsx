"use client";

import React, { useState, useRef, useEffect, useDeferredValue, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { createClient } from "@/utils/supabase/client";
import { Edit2, Check, X, Search, FileSpreadsheet, Loader2, Trash2, Lock, Download, DollarSign, TrendingUp, AlertCircle, BarChart3, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { exportToExcel } from "@/utils/exportToExcel";
import { Button } from "@/components/ui/Button";

// Komponen mini untuk Searchable Select (Dynamic Fetch)
function SearchableSelect({ value, initialLabel, onChange, placeholder }: { value: number | '', initialLabel?: string, onChange: (val: number | '') => void, placeholder: string }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{id: number, label: string}[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchOptions = async () => {
      const trimmed = search.trim().replace(/\s+/g, '');
      if (!trimmed) {
        setOptions([]);
        return;
      }
      
      const fuzzyPattern = '%' + trimmed.split('').join('%') + '%';
      
      const { data } = await supabase.from('creators')
        .select('id, username')
        .ilike('username', fuzzyPattern)
        .limit(20);
        
      if (data) {
        // Sort locally by length so exact/shortest match floats to the top
        const sorted = data.map(d => ({ id: d.id, label: `@${d.username}` })).sort((a, b) => a.label.length - b.label.length).slice(0, 5);
        setOptions(sorted);
      }
    };

    const handler = setTimeout(fetchOptions, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const displayValue = open ? search : (value ? (options.find(o => o.id === value)?.label || initialLabel || search) : "");

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        className="w-full p-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-indigo-500"
        placeholder={placeholder}
        value={displayValue}
        onClick={() => { setOpen(true); setSearch(""); }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-10 w-[250px] mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 text-center">
              {search.trim() ? "Tidak ditemukan" : "Ketik untuk mencari..."}
            </div>
          ) : (
            <>
              {options.map(opt => (
                <div
                  key={opt.id}
                  className="p-2 text-xs hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    onChange(opt.id);
                    setSearch(opt.label);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdsReportPage() {
  const { creators, campaigns } = useDatabaseStore();
  const [adsPerformance, setAdsPerformance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const supabase = createClient();

  // Pagination & Sorting States
  const [displayLimit, setDisplayLimit] = useState(100);
  type SortColumn = 'tanggal' | 'ad_id' | 'ad_name' | 'campaign_id' | 'creator_id' | 'kurs' | 'cost_usd' | 'gross_revenue_usd';
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
      const { data } = await supabase.from('ads_performance').select('*, creators(username)').order('tanggal', { ascending: false }).limit(2000);
      if (data) setAdsPerformance(data);
      setIsLoading(false);
    };
    fetchAds();
  }, [supabase]);
  
  // Edit States
  const [editCampaignId, setEditCampaignId] = useState<number | ''>('');
  const [editCreatorId, setEditCreatorId] = useState<number | ''>('');
  const [editKurs, setEditKurs] = useState<string>('');
  const [editAdId, setEditAdId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (ad: any) => {
    setEditingId(ad.id);
    setEditCampaignId(ad.campaign_id || '');
    setEditCreatorId(ad.creator_id || '');
    setEditKurs(ad.kurs?.toString() || '16000');
    setEditAdId(ad.ad_id || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCampaignId('');
    setEditCreatorId('');
    setEditKurs('');
    setEditAdId('');
  };

  const saveEdit = async (id: number) => {
    setIsSaving(true);
    const numKurs = Number(editKurs);
    const cId = editCampaignId === '' ? null : Number(editCampaignId);
    const crId = editCreatorId === '' ? null : Number(editCreatorId);

    let newUsername = null;
    if (crId) {
      const { data: creatorData } = await supabase.from('creators').select('username').eq('id', crId).single();
      if (creatorData) newUsername = creatorData.username;
    }

    const { error } = await supabase.from('ads_performance').update({
      campaign_id: cId,
      creator_id: crId,
      kurs: numKurs,
      ad_id: editAdId.trim() || null
    }).eq('id', id);

    if (!error) {
      setAdsPerformance(prev => prev.map(ad => ad.id === id ? { 
        ...ad, 
        campaign_id: cId, 
        creator_id: crId, 
        kurs: numKurs,
        ad_id: editAdId.trim() || null,
        creators: newUsername ? { username: newUsername } : null
      } : ad));
      cancelEdit();
    } else {
      alert("Gagal menyimpan: " + error.message);
    }
    setIsSaving(false);
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
    const summary: Record<number, { name: string, spend: number, gmv: number, unmapped: number }> = {};
    let globalUnmappedCampaigns = 0;

    searchFilteredAds.forEach(ad => {
      const kurs = ad.kurs || 16000;
      const spendIDR = (ad.cost_usd || 0) * kurs;
      const gmvIDR = (ad.gross_revenue_usd || 0) * kurs;
      
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
          unmapped: 0 
        };
      }
      
      summary[cId].spend += spendIDR;
      summary[cId].gmv += gmvIDR;
      if (!ad.creator_id) summary[cId].unmapped++;
    });

    const list = Object.entries(summary).map(([id, data]) => ({ id: Number(id), ...data }));
    list.sort((a, b) => b.gmv - a.gmv); // sort by GMV highest

    return { list, globalUnmappedCampaigns };
  }, [searchFilteredAds, campaigns]);

  // 4. Global Summary Calculation (from tableFilteredAds)
  const globalSummary = useMemo(() => {
    let totalSpend = 0;
    let totalGmv = 0;
    let totalUnmapped = 0;

    tableFilteredAds.forEach(ad => {
      const kurs = ad.kurs || 16000;
      totalSpend += (ad.cost_usd || 0) * kurs;
      totalGmv += (ad.gross_revenue_usd || 0) * kurs;
      if (!ad.campaign_id || !ad.creator_id) totalUnmapped++;
    });

    const roas = totalSpend > 0 ? totalGmv / totalSpend : 0;
    return { totalSpend, totalGmv, totalUnmapped, roas };
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Spend (IDR)</p>
                <h3 className="text-2xl font-bold text-slate-800">
                  Rp {globalSummary.totalSpend.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <DollarSign className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total GMV (IDR)</p>
                <h3 className="text-2xl font-bold text-emerald-600">
                  Rp {globalSummary.totalGmv.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                <TrendingUp className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">ROAS Keseluruhan</p>
                <h3 className={`text-2xl font-bold ${globalSummary.roas >= 2 ? 'text-emerald-600' : globalSummary.roas >= 1 ? 'text-amber-500' : 'text-red-500'}`}>
                  {globalSummary.roas.toFixed(2)}x
                </h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                <BarChart3 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-slate-200 shadow-sm ${globalSummary.totalUnmapped > 0 ? 'bg-amber-50 border-amber-200' : ''}`}>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Status Mapping</p>
                <h3 className={`text-2xl font-bold ${globalSummary.totalUnmapped > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                  {globalSummary.totalUnmapped > 0 ? `${globalSummary.totalUnmapped} Unmapped` : 'Aman (100%)'}
                </h3>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${globalSummary.totalUnmapped > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                {globalSummary.totalUnmapped > 0 ? <AlertCircle className="w-6 h-6" /> : <Check className="w-6 h-6" />}
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
                    className={`flex-shrink-0 w-64 p-4 rounded-xl border transition-all cursor-pointer snap-start ${
                      isActive 
                        ? 'border-blue-500 bg-blue-50/50 shadow-md ring-1 ring-blue-500 ring-offset-1' 
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={`font-bold truncate pr-2 ${isActive ? 'text-blue-700' : 'text-slate-800'}`} title={camp.name}>{camp.name}</h4>
                      {camp.unmapped > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1" title={`${camp.unmapped} iklan belum di-map`}>
                          <AlertCircle className="w-3 h-3" /> {camp.unmapped}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Spend:</span>
                      <span className="font-semibold text-red-600">Rp {(camp.spend / 1000000).toFixed(1)}M</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">GMV:</span>
                      <span className="font-semibold text-emerald-600">Rp {(camp.gmv / 1000000).toFixed(1)}M</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-slate-100 mt-2">
                      <span className="text-slate-500">ROAS:</span>
                      <span className={`font-bold ${roas >= 2 ? 'text-emerald-600' : roas >= 1 ? 'text-amber-500' : 'text-red-500'}`}>
                        {roas.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Card className="border-slate-200 shadow-sm mt-4">
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
          <div className="max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm select-none">
                <TableRow>
                  <TableHead className="w-[100px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('tanggal')}>
                    <div className="flex items-center gap-1">Tanggal {sortConfig?.key === 'tanggal' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[120px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('ad_id')}>
                    <div className="flex items-center gap-1">Ad ID {sortConfig?.key === 'ad_id' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="max-w-[200px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('ad_name')}>
                    <div className="flex items-center gap-1">Ad Name (Dari Vendor) {sortConfig?.key === 'ad_name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[180px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('campaign_id')}>
                    <div className="flex items-center gap-1">Campaign Tujuan {sortConfig?.key === 'campaign_id' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[180px] cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('creator_id')}>
                    <div className="flex items-center gap-1">Kreator Ter-map {sortConfig?.key === 'creator_id' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[120px] text-center cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('kurs')}>
                    <div className="flex items-center justify-center gap-1">Kurs IDR {sortConfig?.key === 'kurs' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('cost_usd')}>
                    <div className="flex items-center justify-end gap-1">Cost (USD) {sortConfig?.key === 'cost_usd' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('gross_revenue_usd')}>
                    <div className="flex items-center justify-end gap-1">Rev (USD) {sortConfig?.key === 'gross_revenue_usd' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                  </TableHead>
                  <TableHead className="w-[80px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableFilteredAds.slice(0, displayLimit).map((ad) => {
                  const isEditing = editingId === ad.id;
                  const creatorUsername = ad.creators?.username;
                  const campaign = campaigns.find(c => c.id === ad.campaign_id);

                  return (
                    <TableRow key={ad.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-xs text-slate-500">{ad.tanggal ? new Date(ad.tanggal).toLocaleDateString('id-ID') : '-'}</TableCell>
                      <TableCell className="font-medium text-xs">
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="Ad ID"
                            className="w-full p-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                            value={editAdId}
                            onChange={(e) => setEditAdId(e.target.value)}
                          />
                        ) : (
                          <div className={`font-mono truncate ${ad.ad_id ? 'text-slate-500' : 'text-red-500 font-bold'}`} title={ad.ad_id || 'KOSONG'}>
                            {ad.ad_id || 'ID KOSONG'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">
                        <div className="max-w-[200px] truncate" title={ad.ad_name}>{ad.ad_name}</div>
                      </TableCell>
                      
                      {/* Campaign Column */}
                      <TableCell>
                        {isEditing ? (
                          <select
                            className="w-full p-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-indigo-500"
                            value={editCampaignId}
                            onChange={(e) => {
                              setEditCampaignId(e.target.value ? Number(e.target.value) : '');
                              setEditCreatorId('');
                            }}
                          >
                            <option value="">Pilih Campaign</option>
                            {campaigns.filter(c => c.status === 'aktif').map(c => (
                              <option key={c.id} value={c.id}>{c.nama}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-xs ${campaign ? 'text-indigo-600 font-medium' : 'text-red-500 font-bold'}`}>
                            {campaign ? campaign.nama : 'BELUM DI-MAP'}
                          </span>
                        )}
                      </TableCell>

                      {/* Creator Column */}
                      <TableCell>
                        {isEditing ? (
                          editCampaignId ? (
                            <SearchableSelect 
                              value={editCreatorId} 
                              onChange={setEditCreatorId} 
                              placeholder="Ketik username..." 
                              initialLabel={creatorUsername ? `@${creatorUsername}` : ''}
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400">Pilih campaign dulu</span>
                          )
                        ) : (
                          <span className={`text-xs ${creatorUsername ? 'text-slate-700' : 'text-red-500 font-bold'}`}>
                            {creatorUsername ? `@${creatorUsername}` : 'BELUM DI-MAP'}
                          </span>
                        )}
                      </TableCell>

                      {/* Kurs Column */}
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">Rp</span>
                            <input
                              type="number"
                              className="w-full p-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                              value={editKurs}
                              onChange={(e) => setEditKurs(e.target.value)}
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 text-center">Rp {(ad.kurs || 16000).toLocaleString('id-ID')}</div>
                        )}
                      </TableCell>

                      <TableCell className="text-right font-medium text-xs text-slate-700">
                        ${(ad.cost_usd || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs text-green-600">
                        ${(ad.gross_revenue_usd || 0).toFixed(2)}
                      </TableCell>
                      
                      {/* Action Column */}
                      <TableCell className="text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-green-600 border-green-200 hover:bg-green-50" onClick={() => saveEdit(ad.id)} disabled={isSaving}>
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-red-500 border-red-200 hover:bg-red-50" onClick={cancelEdit} disabled={isSaving}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {isManager ? (
                              <>
                                <button onClick={() => startEdit(ad)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteAd(ad.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" disabled={deletingId === ad.id} title="Hapus">
                                  {deletingId === ad.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </>
                            ) : (
                              <span title="Hanya Manager">
                                <Lock className="w-4 h-4 text-slate-300" />
                              </span>
                            )}
                          </div>
                        )}
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
