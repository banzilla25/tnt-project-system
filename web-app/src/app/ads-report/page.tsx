"use client";

import React, { useState, useRef, useEffect, useDeferredValue } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { createClient } from "@/utils/supabase/client";
import { Edit2, Check, X, Search, FileSpreadsheet, Loader2, Trash2, Lock, Download } from "lucide-react";
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager';

  const supabase = createClient();

  useEffect(() => {
    if (!isManager) return;
    const fetchAds = async () => {
      setIsLoading(true);
      const { data } = await supabase.from('ads_performance').select('*, creators(username)').order('tanggal', { ascending: false }).limit(2000);
      if (data) setAdsPerformance(data);
      setIsLoading(false);
    };
    fetchAds();
  }, [supabase, isManager]);
  
  // Edit States
  const [editCampaignId, setEditCampaignId] = useState<number | ''>('');
  const [editCreatorId, setEditCreatorId] = useState<number | ''>('');
  const [editKurs, setEditKurs] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (ad: any) => {
    setEditingId(ad.id);
    setEditCampaignId(ad.campaign_id || '');
    setEditCreatorId(ad.creator_id || '');
    setEditKurs(ad.kurs?.toString() || '16000');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCampaignId('');
    setEditCreatorId('');
    setEditKurs('');
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
      kurs: numKurs
    }).eq('id', id);

    if (!error) {
      setAdsPerformance(prev => prev.map(ad => ad.id === id ? { 
        ...ad, 
        campaign_id: cId, 
        creator_id: crId, 
        kurs: numKurs,
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

  // Filter ads performance
  const filteredAds = adsPerformance.filter(ad => {
    if (!deferredSearchQuery) return true;
    const q = deferredSearchQuery.toLowerCase();
    return (
      (ad.ad_name && ad.ad_name.toLowerCase().includes(q)) || 
      (ad.ad_id && ad.ad_id.toLowerCase().includes(q))
    );
  }).sort((a, b) => new Date(b.tanggal || '1970-01-01').getTime() - new Date(a.tanggal || '1970-01-01').getTime());

  // const creatorOptions = creators.map(c => ({ id: c.id, label: `@${c.username}` }));

  const handleExport = () => {
    const dataToExport = filteredAds.map(ad => ({
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
          {isManager && (
            <Button onClick={handleExport} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white">
              <Download className="w-4 h-4" /> Export Excel
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Database Iklan ({filteredAds.length} baris)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[100px]">Tanggal</TableHead>
                  <TableHead className="w-[120px]">Ad ID</TableHead>
                  <TableHead className="max-w-[200px]">Ad Name (Dari Vendor)</TableHead>
                  <TableHead className="w-[180px]">Campaign Tujuan</TableHead>
                  <TableHead className="w-[180px]">Kreator Ter-map</TableHead>
                  <TableHead className="w-[120px] text-center">Kurs IDR</TableHead>
                  <TableHead className="text-right">Cost (USD)</TableHead>
                  <TableHead className="text-right">Rev (USD)</TableHead>
                  <TableHead className="w-[80px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAds.slice(0, 100).map((ad) => {
                  const isEditing = editingId === ad.id;
                  const creatorUsername = ad.creators?.username;
                  const campaign = campaigns.find(c => c.id === ad.campaign_id);

                  return (
                    <TableRow key={ad.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-xs text-slate-500">{ad.tanggal ? new Date(ad.tanggal).toLocaleDateString('id-ID') : '-'}</TableCell>
                      <TableCell className="text-xs font-mono text-slate-500 truncate" title={ad.ad_id}>{ad.ad_id}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-700 truncate max-w-[200px]" title={ad.ad_name}>
                        {ad.ad_name}
                      </TableCell>
                      
                      {/* Campaign Column */}
                      <TableCell>
                        {isEditing ? (
                          <select 
                            className="w-full p-1.5 border border-slate-300 rounded text-xs"
                            value={editCampaignId}
                            onChange={(e) => setEditCampaignId(e.target.value === '' ? '' : Number(e.target.value))}
                          >
                            <option value="">-- Kosong --</option>
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs font-medium text-slate-700">{campaign ? campaign.nama : <span className="text-slate-400 italic">Kosong</span>}</span>
                        )}
                      </TableCell>

                      {/* Creator Column */}
                      <TableCell>
                        {isEditing ? (
                          <SearchableSelect 
                            value={editCreatorId}
                            initialLabel={creatorUsername ? `@${creatorUsername}` : ''}
                            onChange={(val) => setEditCreatorId(val)}
                            placeholder="Cari Username..."
                          />
                        ) : (
                          <span className="text-xs font-medium text-indigo-600">{creatorUsername ? `@${creatorUsername}` : <span className="text-amber-500 italic">Unmapped</span>}</span>
                        )}
                      </TableCell>

                      {/* Kurs Column */}
                      <TableCell className="text-center">
                        {isEditing ? (
                          <input 
                            type="number" 
                            className="w-20 p-1.5 border border-slate-300 rounded text-xs text-center"
                            value={editKurs}
                            onChange={(e) => setEditKurs(e.target.value)}
                          />
                        ) : (
                          <span className="text-xs">Rp {ad.kurs?.toLocaleString('id-ID') || '-'}</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-xs text-red-600">${ad.cost_usd.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs text-emerald-600 font-medium">${ad.gross_revenue_usd.toFixed(2)}</TableCell>
                      
                      {/* Action Column */}
                      <TableCell className="text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            {isSaving ? (
                              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                            ) : (
                              <>
                                <button onClick={() => saveEdit(ad.id)} className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 p-1.5 rounded-md" title="Simpan">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-md" title="Batal">
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => startEdit(ad)}
                              className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-md transition-colors"
                              title="Edit Data"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteAd(ad.id)}
                              disabled={deletingId === ad.id}
                              className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                              title="Hapus Data"
                            >
                              {deletingId === ad.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredAds.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-slate-500">
                      Tidak ada data iklan yang ditemukan.
                    </TableCell>
                  </TableRow>
                )}
                {filteredAds.length > 100 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-4 text-center text-xs text-slate-500 bg-slate-50 italic">
                      Menampilkan 100 data teratas dari {filteredAds.length} data. Gunakan pencarian untuk mencari data spesifik.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
