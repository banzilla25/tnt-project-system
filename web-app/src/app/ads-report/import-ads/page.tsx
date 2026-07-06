"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { UploadCloud, CheckCircle2, ArrowRight, ArrowLeft, Loader2, AlertCircle, FileSpreadsheet, Calendar } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { downloadAdsSyncTemplate, parseFileHeaders, parseAdsSyncFile, ColumnMapping, EnrichedAdsRow } from "@/utils/importAdsSync";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { StringCombobox } from "@/components/StringCombobox";

const supabase = createClient();

export default function ImportAdsPage() {
  const router = useRouter();
  const { campaigns, creators, fetchData } = useDatabaseStore();
  
  useEffect(() => {
    if (campaigns.length === 0) {
      fetchData();
    }
  }, [campaigns.length, fetchData]);
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  
  // Custom states for Ads Import
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedCampaignAdsName, setSelectedCampaignAdsName] = useState<string>('');
  const [campaignAdsList, setCampaignAdsList] = useState<string[]>([]);
  const [selectedKurs, setSelectedKurs] = useState<number>(16000);

  useEffect(() => {
    const fetchCampaignAds = async () => {
      if (!selectedCampaign) {
        setCampaignAdsList([]);
        return;
      }
      const { data } = await supabase
        .from('ads_performance')
        .select('campaign_ads_name')
        .eq('campaign_id', selectedCampaign)
        .not('campaign_ads_name', 'is', null);
      
      if (data) {
        const unique = Array.from(new Set(data.map(d => d.campaign_ads_name as string)));
        setCampaignAdsList(unique);
      }
    };
    fetchCampaignAds();
  }, [selectedCampaign]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    ad_id: '',
    ad_name: '',
    cost: '',
    revenue: '',
    purchases: '',
    impressions: '',
    clicks: '',
    product_page_views: '',
    checkouts_initiated: '',
    items_purchased: ''
  });
  
  const [preview, setPreview] = useState<EnrichedAdsRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Smart prediction state
  const [autoMappedCreators, setAutoMappedCreators] = useState<Record<string, { id: number, username: string } | null>>({}); // ad_id -> creator_id

  const [historyMapState, setHistoryMapState] = useState<Record<string, { cost: number; revenue: number; purchases: number; impressions: number; clicks: number; product_page_views: number; checkouts_initiated: number; items_purchased: number }>>({});
  const [historicalAdsList, setHistoricalAdsList] = useState<{ad_id: string, ad_name: string}[]>([]);

  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);

  const handleLinkAdId = (rowIndex: number, selectedAdId: string) => {
    setPreview(prev => {
      const newPreview = [...prev];
      const row = newPreview[rowIndex];
      row.linked_ad_id = selectedAdId;
      return newPreview;
    });
  };

  // Helper to trigger file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = async (f: File) => {
    setFile(f);
    setIsProcessing(true);
    try {
      const headers = await parseFileHeaders(f);
      setCsvHeaders(headers);
      
      // Auto guess
      const guessMapping = { ...mapping };
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());
      
      headers.forEach((h, i) => {
        const lh = lowerHeaders[i];
        if (lh === 'ad id' || lh === 'adid') guessMapping.ad_id = h;
        if (lh === 'ad name' || lh === 'adname') guessMapping.ad_name = h;
        if (lh === 'cost') guessMapping.cost = h;
        if (lh === 'gross revenue (shop)' || lh === 'revenue' || lh === 'gmv') guessMapping.revenue = h;
        if (lh === 'purchases (shop)' || lh === 'purchases') guessMapping.purchases = h;
        if (lh === 'impressions') guessMapping.impressions = h;
        if (lh === 'clicks (destination)' || lh === 'clicks') guessMapping.clicks = h;
        if (lh === 'product page views (shop)' || lh === 'product page views') guessMapping.product_page_views = h;
        if (lh === 'checkouts initiated (shop)' || lh === 'checkouts initiated') guessMapping.checkouts_initiated = h;
        if (lh === 'items purchased (shop)' || lh === 'items purchased') guessMapping.items_purchased = h;
      });
      
      setMapping(guessMapping);
      setStep(2);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const processMapping = async () => {
    if (!file) return;
    setIsProcessing(true);
    
    try {
      const res = await parseAdsSyncFile(file, mapping);
      const { validData } = res;
      setErrors(res.errors);
      
      const adNames = Array.from(new Set(validData.map(r => r.ad_name)));

      // Historical data fetch removed since database now stores raw Lifetime data

      const enrichedData: EnrichedAdsRow[] = validData.map(row => {
        return {
          ...row,
          delta_cost: row.cost,
          delta_revenue: row.revenue,
          delta_purchases: row.purchases,
          delta_impressions: row.impressions,
          delta_clicks: row.clicks,
          delta_product_page_views: row.product_page_views,
          delta_checkouts_initiated: row.checkouts_initiated,
          delta_items_purchased: row.items_purchased,
        };
      });

      setPreview(enrichedData);
      
      // 2. Try to predict smart mapping based on historical data using ad_id then ad_name
      const { data: creatorHistoryData } = await supabase.from('ads_performance').select('ad_id, ad_name, creator_id').not('creator_id', 'is', null);
      
      const newAutoMap: Record<string, { id: number, username: string } | null> = {};
      
      // Map historical ad_id and ad_name to creator_id
      const adIdToCreatorId: Record<string, { id: number, username: string }> = {};
      const adNameToCreatorId: Record<string, { id: number, username: string }> = {};
      
      // Fetch all creators explicitly for heuristic matching (global store is empty for performance)
      const { data: allCreators } = await supabase.from('creators').select('id, username');
      
      if (creatorHistoryData && allCreators) {
        creatorHistoryData.forEach(row => {
          if (row.creator_id) {
            const matchedCreator = allCreators.find(c => c.id === row.creator_id);
            if (matchedCreator) {
              if (row.ad_id) adIdToCreatorId[row.ad_id] = { id: row.creator_id, username: matchedCreator.username };
              if (row.ad_name) adNameToCreatorId[row.ad_name] = { id: row.creator_id, username: matchedCreator.username };
            }
          }
        });
      }

      // Sort creators by length descending to match longer usernames first (avoids partial matches)
      const sortedCreators = [...(allCreators || [])].sort((a, b) => (b.username?.length || 0) - (a.username?.length || 0));

      enrichedData.forEach(row => {
        // 1. Try exact history match via Ad ID
        if (row.ad_id && adIdToCreatorId[row.ad_id]) {
          newAutoMap[row.ad_id] = adIdToCreatorId[row.ad_id];
          return;
        }
        
        // 2. Try exact history match via Ad Name
        if (row.ad_name && adNameToCreatorId[row.ad_name]) {
          newAutoMap[row.ad_id] = adNameToCreatorId[row.ad_name];
          return;
        }
        
        // 3. Try heuristic match against creator usernames
        let foundCreator: { id: number, username: string } | null = null;
        const normalizedAdName = (row.ad_name || '').toLowerCase();
        
        for (const creator of sortedCreators) {
          if (!creator.username) continue;
          const username = creator.username.toLowerCase();
          // Match if username is bounded by start/end or separators (_, -, space)
          const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(?:^|[_-]|\\s)${escapedUsername}(?:[_-]|\\s|$)`);
          
          if (regex.test(normalizedAdName)) {
            foundCreator = { id: creator.id, username: creator.username };
            break;
          }
        }
        
        newAutoMap[row.ad_id] = foundCreator;
      });
      
      setAutoMappedCreators(newAutoMap);
      setStep(3);
    } catch (err: any) {
      alert("Error parsing CSV: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const updatePredictedCreator = (adId: string, creatorId: number | '') => {
    setAutoMappedCreators(prev => {
      if (creatorId === '') {
        return { ...prev, [adId]: null };
      }
      // Keep existing username if id matches, otherwise we just lose the label until they save, which is fine for manual select
      return {
        ...prev,
        [adId]: { id: creatorId, username: prev[adId]?.id === creatorId ? prev[adId]!.username : '' }
      };
    });
  };

  const commitData = async () => {
    setIsCommitting(true);
    setCommitProgress(0);
    
    const total = preview.length;
    let processed = 0;
    
    try {
      for (const row of preview) {
        // Upsert to ads_performance
        // If ad_id + tanggal exists, update it, else insert it
        // Since we don't have a strict unique constraint on ad_id + tanggal, we will check manually or insert.
        // Usually, users want to update if it exists for the same date.
        
        const predictedCreator = autoMappedCreators[row.ad_id];
        const creatorId = predictedCreator ? predictedCreator.id : null;
        
        const targetAdId = row.linked_ad_id || row.ad_id;
        
        let existing;
        if (targetAdId) {
          const { data } = await supabase.from('ads_performance')
            .select('id, campaign_id')
            .eq('ad_id', targetAdId)
            .eq('tanggal', selectedDate)
            .single();
          existing = data;
        } else {
          const { data } = await supabase.from('ads_performance')
            .select('id, campaign_id')
            .eq('ad_name', row.ad_name)
            .is('ad_id', null)
            .eq('tanggal', selectedDate)
            .single();
          existing = data;
        }
          
        if (existing) {
          // Update
          const { error } = await supabase.from('ads_performance').update({
            ad_name: row.ad_name,
            cost_usd: row.delta_cost,
            gross_revenue_usd: row.delta_revenue,
            purchases: row.delta_purchases,
            impressions: row.delta_impressions,
            clicks: row.delta_clicks,
            product_page_views: row.delta_product_page_views,
            checkouts_initiated: row.delta_checkouts_initiated,
            items_purchased: row.delta_items_purchased,
            kurs: selectedKurs,
            ...(selectedCampaign ? { campaign_id: Number(selectedCampaign) } : {}),
            campaign_ads_name: selectedCampaignAdsName || null,
            // creator_id is not overwritten here if not intentionally changed, but if we have a new manual mapping we could update it. 
            // Since step 3 has a predictor, let's update creator_id too if predictedCreatorId is set.
            ...(creatorId ? { creator_id: creatorId } : {})
          }).eq('id', existing.id);
          if (error) throw error;
        } else {
          // Insert
          const { error } = await supabase.from('ads_performance').insert({
            ad_id: targetAdId || null,
            ad_name: row.ad_name,
            tanggal: selectedDate,
            campaign_id: selectedCampaign ? Number(selectedCampaign) : null,
            campaign_ads_name: selectedCampaignAdsName || null,
            cost_usd: row.delta_cost,
            gross_revenue_usd: row.delta_revenue,
            purchases: row.delta_purchases,
            impressions: row.delta_impressions,
            clicks: row.delta_clicks,
            product_page_views: row.delta_product_page_views,
            checkouts_initiated: row.delta_checkouts_initiated,
            items_purchased: row.delta_items_purchased,
            creator_id: creatorId || null,
            kurs: selectedKurs
          });
          if (error) throw error;
        }
        
        processed++;
        setCommitProgress(Math.round((processed / total) * 100));
      }
      
      await fetchData(); // Refresh global data (including vw_campaign_summary) so dashboard updates
      setStep(4);
    } catch (err: any) {
      alert("Gagal menyimpan data: " + err.message);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/ads-report')} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Data Iklan (TikTok Ads)</h1>
          <p className="text-slate-500">Unggah CSV performa iklan harian dari platform TikTok Ads Manager.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 mb-8">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
              step === s ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 
              step > s ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
            </div>
            <span className={`ml-3 font-medium ${step === s ? 'text-slate-800' : step > s ? 'text-slate-600' : 'text-slate-400'}`}>
              {s === 1 ? 'Upload File' : s === 2 ? 'Mapping Kolom' : s === 3 ? 'Preview Data' : 'Selesai'}
            </span>
            {s < 4 && <ArrowRight className="w-4 h-4 mx-4 text-slate-300" />}
          </div>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-8">
          
          {/* STEP 1: UPLOAD */}
          {step === 1 && (
            <div className="flex flex-col items-center justify-center max-w-2xl mx-auto py-12">
              
              <div className="w-full mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Tanggal</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-slate-400" />
                    </div>
                    <input 
                      type="date" 
                      className="block w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-sm"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Campaign di Sistem <span className="text-red-500">*</span></label>
                  <select
                    className="block w-full p-3 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-sm"
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                  >
                    <option value="">-- Wajib Pilih --</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.nama}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Campaign Ads <span className="text-red-500">*</span></label>
                  <StringCombobox
                    value={selectedCampaignAdsName}
                    onChange={setSelectedCampaignAdsName}
                    options={campaignAdsList}
                    placeholder="Pilih atau ketik baru..."
                    className="block w-full p-3 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Kurs (IDR/USD)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-slate-400 font-medium text-sm">Rp</span>
                    </div>
                    <input 
                      type="number" 
                      className="block w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-sm"
                      value={selectedKurs}
                      onChange={(e) => setSelectedKurs(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="text-center w-full mb-6">
                <p className="text-xs text-slate-500">Atur tanggal, campaign, dan nilai kurs secara global untuk batch unggahan ini.</p>
              </div>

              <div 
                className="w-full border-2 border-dashed border-slate-300 bg-slate-50 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => {
                  if (!selectedCampaign) {
                    alert("Silakan pilih Campaign di Sistem terlebih dahulu!");
                    return;
                  }
                  if (!selectedCampaignAdsName.trim()) {
                    alert("Silakan isi atau pilih Campaign Ads terlebih dahulu!");
                    return;
                  }
                  fileInputRef.current?.click();
                }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Klik atau Drag file Excel/CSV ke sini</h3>
                <p className="text-sm text-slate-500">Mendukung file .xlsx dan .csv dari TikTok Ads Manager</p>
                
                {isProcessing && (
                  <div className="mt-6 flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Memproses file...</span>
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-8 border-t border-slate-100 w-full flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-700 text-sm">Butuh format CSV yang benar?</h4>
                  <p className="text-xs text-slate-500 mt-1">Unduh template agar sesuai dengan sistem.</p>
                </div>
                <Button variant="outline" onClick={downloadAdsSyncTemplate} className="gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Unduh Template CSV
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: MAPPING */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Pemetaan Kolom</h2>
                <p className="text-slate-600">Pastikan kolom dari CSV Anda (kolom sebelah kanan) sesuai dengan kebutuhan sistem kita (sebelah kiri).</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl bg-slate-50 p-6 rounded-xl border border-slate-200">
                {Object.entries(mapping).map(([key, value]) => {
                  const labels: Record<string, string> = {
                    ad_id: "Ad ID (Opsional)",
                    ad_name: "Ad Name (Wajib)",
                    cost: "Cost / Spend (Wajib)",
                    revenue: "Gross Revenue / GMV (Wajib)",
                    purchases: "Purchases (Wajib)",
                    impressions: "Impressions (Wajib)",
                    clicks: "Clicks (Wajib)",
                    product_page_views: "Product Page Views",
                    checkouts_initiated: "Checkouts Initiated",
                    items_purchased: "Items Purchased"
                  };
                  
                  return (
                    <div key={key} className="flex flex-col gap-1 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{labels[key]}</label>
                      <select 
                        className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={value}
                        onChange={(e) => setMapping(prev => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="">-- Abaikan (Tidak dipetakan) --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>Batal</Button>
                <Button onClick={processMapping} className="bg-blue-600 hover:bg-blue-700 text-white gap-2" disabled={isProcessing || !mapping.ad_name}>
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Lanjutkan ke Preview
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Preview Data ({preview.length} Baris)</h2>
                  <p className="text-slate-600">Periksa kembali data yang akan diunggah. <span className="font-semibold text-blue-600">Smart Mapping</span> secara otomatis mendeteksi kreator berdasarkan Ad ID sebelumnya.</p>
                </div>
                <Button onClick={commitData} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold px-8 shadow-lg shadow-emerald-600/30" disabled={isCommitting || preview.length === 0}>
                  {isCommitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Mengunggah...</>
                  ) : (
                    <><UploadCloud className="w-5 h-5" /> Unggah & Simpan</>
                  )}
                </Button>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex flex-col gap-2 max-h-40 overflow-y-auto">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-5 h-5" />
                    Peringatan: Ditemukan {errors.length} baris tidak valid
                  </div>
                  <ul className="list-disc list-inside text-sm">
                    {errors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                    {errors.length > 5 && <li>... dan {errors.length - 5} baris lainnya</li>}
                  </ul>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="max-h-[500px] overflow-y-auto relative">
                  <Table>
                    <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-[120px]">Ad ID</TableHead>
                        <TableHead className="w-[200px]">Ad Name</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Purchases</TableHead>
                        <TableHead className="text-right">Impr</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">PP Views</TableHead>
                        <TableHead className="text-right">Checkouts</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="bg-blue-50 text-blue-800 w-[150px] border-l border-blue-100">Predicted Creator</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((row, i) => {
                        const predictedCreator = autoMappedCreators[row.ad_id];
                        const predictedCreatorId = predictedCreator?.id || null;
                        const creatorUsername = predictedCreator?.username || null; 
                        
                        const renderValueCell = (val: number, isCurrency: boolean = false) => {
                          const prefix = isCurrency ? '$' : '';
                          const formatVal = isCurrency ? val.toFixed(2) : val.toLocaleString();
                          return (
                            <div className="flex flex-col items-end">
                              <div className="font-bold text-sm text-slate-700">{prefix}{formatVal}</div>
                            </div>
                          );
                        };

                        return (
                          <TableRow key={i} className="hover:bg-slate-50">
                            <TableCell className="font-mono text-[10px] text-slate-500 truncate max-w-[150px]">
                              {row.ad_id ? (
                                row.ad_id
                              ) : (
                                <select 
                                  className="w-full p-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500 bg-white"
                                  value={row.linked_ad_id || ''}
                                  onChange={(e) => handleLinkAdId(i, e.target.value)}
                                >
                                  <option value="">-- Kosong / Biarkan --</option>
                                  {historicalAdsList.map(opt => (
                                    <option key={opt.ad_id} value={opt.ad_id}>[{opt.ad_id}] {opt.ad_name}</option>
                                  ))}
                                </select>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-semibold max-w-[150px] truncate" title={row.ad_name}>{row.ad_name}</TableCell>
                            <TableCell className="text-right">{renderValueCell(row.cost, true)}</TableCell>
                            <TableCell className="text-right">{renderValueCell(row.revenue, true)}</TableCell>
                            <TableCell className="text-right">{renderValueCell(row.purchases, false)}</TableCell>
                            <TableCell className="text-right">{renderValueCell(row.impressions, false)}</TableCell>
                            <TableCell className="text-right">{renderValueCell(row.clicks, false)}</TableCell>
                            <TableCell className="text-right">{renderValueCell(row.product_page_views, false)}</TableCell>
                            <TableCell className="text-right">{renderValueCell(row.checkouts_initiated, false)}</TableCell>
                            <TableCell className="text-right">{renderValueCell(row.items_purchased, false)}</TableCell>
                            <TableCell className="border-l border-blue-50 bg-blue-50/30 text-xs font-medium min-w-[200px]">
                              <SearchableSelect 
                                value={predictedCreatorId || ''} 
                                initialLabel={creatorUsername ? `@${creatorUsername}` : ''} 
                                onChange={(val) => updatePredictedCreator(row.ad_id, val)} 
                                placeholder="Ketik nama kreator..." 
                                className="w-full p-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500 bg-white"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              {isCommitting && (
                <div className="mt-4 bg-slate-100 rounded-full h-2 w-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${commitProgress}%` }}></div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-20 animate-in zoom-in duration-500">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-200">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">Import Berhasil!</h2>
              <p className="text-slate-500 mb-8 text-center max-w-md">Data iklan sebanyak {preview.length} baris telah berhasil disimpan dan dipetakan ke dalam database sistem.</p>
              
              <Button onClick={() => router.push('/ads-report')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 shadow-lg shadow-blue-500/30 py-6 text-lg rounded-xl">
                Kembali ke Ads Report
              </Button>
            </div>
          )}
          
        </CardContent>
      </Card>
    </div>
  );
}
