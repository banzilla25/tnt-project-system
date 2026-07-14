"use client";

import { useState, useRef, useEffect, useDeferredValue } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Loader2, ArrowRight, Trash2 } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient } from "@/utils/supabase/client";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { StringCombobox } from "@/components/StringCombobox";

// SearchableSelect component (unchanged)
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
      const { data } = await supabase.from('creators').select('id, username').ilike('username', fuzzyPattern).limit(20);
      if (data) {
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
      <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-500" placeholder={placeholder} value={displayValue} onClick={() => { setOpen(true); setSearch(""); }} onChange={(e) => { setSearch(e.target.value); setOpen(true); }} />
      {open && (
        <div className="absolute z-10 w-[250px] mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 text-center">{search.trim() ? "Tidak ditemukan" : "Ketik untuk mencari..."}</div>
          ) : (
            <>{options.map(opt => <div key={opt.id} className="p-2 text-xs hover:bg-slate-50 cursor-pointer" onClick={() => { onChange(opt.id); setSearch(opt.label); setOpen(false); }}>{opt.label}</div>)}</>
          )}
        </div>
      )}
    </div>
  );
}

type FileConfig = {
  id: string;
  file: File;
  tanggal: string;
  campaignId: number | '';
  campaignAdsName: string;
  kurs: string;
  parsedData?: any[];
};

export default function AdsImport() {
  const [files, setFiles] = useState<FileConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<{success: number; errors: string[]} | null>(null);
  
  const { campaigns, creators } = useDatabaseStore();
  const [unmappedAds, setUnmappedAds] = useState<{adName: string, adId: string}[]>([]);
  const [mappings, setMappings] = useState<Record<string, number>>({});
  const [globalCampaignAdsOptions, setGlobalCampaignAdsOptions] = useState<string[]>([]);
  
  const supabase = createClient();

  useEffect(() => {
    // Fetch unique campaign ads names for auto-complete
    const fetchCampaignAds = async () => {
      const { data } = await supabase.from('ads_performance').select('campaign_ads_name');
      if (data) {
        const unique = Array.from(new Set(data.map(d => d.campaign_ads_name).filter(Boolean))) as string[];
        setGlobalCampaignAdsOptions(unique);
      }
    };
    fetchCampaignAds();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(f => {
        // Try to guess date from filename (e.g. 2025-08-11 to 2026-03-10)
        const dateMatch = f.name.match(/(\d{4}-\d{2}-\d{2})/g);
        const guessedDate = dateMatch && dateMatch.length > 0 ? dateMatch[dateMatch.length - 1] : new Date().toISOString().split('T')[0];
        
        // Try to guess campaign ads name
        let guessedCampaignAds = '';
        if (f.name.toLowerCase().includes('qah')) guessedCampaignAds = 'QAHIRA';
        else if (f.name.toLowerCase().includes('man')) guessedCampaignAds = 'MANIS2';

        return {
          id: Math.random().toString(),
          file: f,
          tanggal: guessedDate,
          campaignId: campaigns.length > 0 ? campaigns[0].id : '',
          campaignAdsName: guessedCampaignAds,
          kurs: '16000'
        };
      });
      setFiles([...files, ...newFiles]);
    }
  };

  const updateFileConfig = (id: string, field: keyof FileConfig, value: any) => {
    setFiles(files.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const handleScanFiles = async () => {
    if (files.length === 0) return;
    
    // Validate
    const invalidFile = files.find(f => !f.tanggal || !f.campaignId || !f.campaignAdsName || !f.kurs);
    if (invalidFile) {
      alert(`Mohon lengkapi Tanggal, Campaign Sistem, Campaign Ads, dan Kurs untuk file: ${invalidFile.file.name}`);
      return;
    }

    setLoading(true);
    let allValidData: any[] = [];
    const newFilesWithData = [...files];
    let hasMissingAdId = false;

    // Process all files
    for (let i = 0; i < newFilesWithData.length; i++) {
      const fConfig = newFilesWithData[i];
      const ext = fConfig.file.name.split('.').pop()?.toLowerCase();
      
      const parsed = await new Promise<any[]>((resolve, reject) => {
        if (ext === 'csv') {
          Papa.parse(fConfig.file, {
            header: true, skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: reject
          });
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            resolve(XLSX.utils.sheet_to_json(worksheet));
          };
          reader.readAsArrayBuffer(fConfig.file);
        }
      });

      const validData = parsed.filter(row => Object.keys(row).length > 0 && (row['Ad name'] || row['Ad Name'] || row['Ad Group Name']));
      const missingAdIds = validData.filter(row => !String(row['Ad ID'] || row['Ad ID (Shop)'] || row['Ad Id'] || '').trim());
      
      if (missingAdIds.length > 0) {
        alert(`BLOKIR: File ${fConfig.file.name} memiliki ${missingAdIds.length} baris tanpa Ad ID. Harap perbaiki.`);
        hasMissingAdId = true;
        break;
      }
      
      fConfig.parsedData = validData;
      allValidData.push(...validData);
    }

    if (hasMissingAdId) {
      setLoading(false);
      return;
    }

    setFiles(newFilesWithData);

    // Detect missing mappings
    const { data: dbMappings } = await supabase.from('ad_name_mapping').select('*');
    const knownMappingMap: Record<string, number> = {};
    dbMappings?.forEach(m => knownMappingMap[m.ad_name] = m.creator_id);

    let unknownAdsMap = new Map<string, string>(); 
    for (const row of allValidData) {
      const adName = row['Ad name'] || row['Ad Name'] || row['Ad Group Name'] || '';
      const adId = String(row['Ad ID'] || row['Ad ID (Shop)'] || row['Ad Id'] || '').trim();
      if (adName && !knownMappingMap[adName]) {
        unknownAdsMap.set(adName, adId);
      }
    }

    setMappings(knownMappingMap);
    const unknownAdsList = Array.from(unknownAdsMap.entries()).map(([name, id]) => ({ adName: name, adId: id }));
    setUnmappedAds(unknownAdsList);
    
    setStep(unknownAdsList.length > 0 ? 2 : 3);
    setLoading(false);
  };

  const executeImport = async () => {
    setLoading(true);
    setStep(4);

    try {
      let successCount = 0;
      let errors: string[] = [];

      // Save mappings
      const newMappings = unmappedAds.filter(ad => mappings[ad.adName]).map(ad => ({ ad_name: ad.adName, creator_id: mappings[ad.adName] }));
      for (const mapping of newMappings) {
        await supabase.from('ad_name_mapping').upsert(mapping, { onConflict: 'ad_name' });
      }

      // Process each file
      for (const fConfig of files) {
        if (!fConfig.parsedData) continue;
        
        const chunkSize = 100;
        for (let i = 0; i < fConfig.parsedData.length; i += chunkSize) {
          const chunk = fConfig.parsedData.slice(i, i + chunkSize);
          
          const safeParseNum = (val: any) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            const cleaned = String(val).replace(/[^0-9.-]+/g, "");
            return Number(cleaned) || 0;
          };

          const rawInserts = chunk.map(row => {
            const adName = row['Ad name'] || row['Ad Name'] || row['Ad Group Name'] || '';
            const adId = String(row['Ad ID'] || row['Ad ID (Shop)'] || row['Ad Id']).trim();
            const costUsd = safeParseNum(row['Cost'] || row['Spend'] || row['Amount Spent (USD)']);
            const grossRevenueUsd = safeParseNum(row['Gross revenue (Shop)'] || row['Total Revenue']);
            const purchases = safeParseNum(row['Purchases (Shop)'] || row['Purchases'] || row['Conversions']);
            const impressions = safeParseNum(row['Impressions']);
            const clicks = safeParseNum(row['Clicks (destination)'] || row['Clicks']);
            
            // NEW RAW ARCHITECTURE: Insert raw values directly!
            return {
              campaign_id: fConfig.campaignId,
              campaign_ads_name: fConfig.campaignAdsName,
              tanggal: fConfig.tanggal,
              kurs: fConfig.kurs,
              ad_name: adName,
              ad_id: adId,
              creator_id: mappings[adName],
              cost_usd: costUsd,
              gross_revenue_usd: grossRevenueUsd,
              purchases: purchases,
              impressions: impressions,
              clicks: clicks,
              product_page_views: ppv,
              checkouts_initiated: checkouts,
              items_purchased: itemsPurchased,
            };
          });

          // Insert or Update the snapshot for that ad_id and tanggal
          // Deleting purely by tanggal and ad_id ensures we overwrite old mistakes (even if they were mapped to the wrong campaign)
          const adIds = rawInserts.map(r => r.ad_id);
          await supabase.from('ads_performance').delete()
            .eq('tanggal', fConfig.tanggal)
            .in('ad_id', adIds);

          const { error } = await supabase.from('ads_performance').insert(rawInserts);

          if (error) {
            errors.push(`File ${fConfig.file.name} Chunk ${i}: ${error.message}`);
          } else {
            successCount += rawInserts.length;
          }
        }
      }

      setResult({ success: successCount, errors });
      setStep(5);
      
      if (successCount > 0) {
        const { fetchData } = useDatabaseStore.getState();
        await fetchData();
      }
    } catch (err: any) {
      alert("Terjadi kesalahan sistem saat import: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-4" />
              <p className="font-bold text-slate-700 mb-1">Batch Upload File TikTok Ads</p>
              <p className="text-sm text-slate-500 mb-4">Anda bisa memilih banyak file sekaligus (.xlsx, .csv)</p>
              <input type="file" multiple accept=".csv, .xlsx, .xls" className="hidden" id="ads-upload" onChange={handleFileUpload} />
              <Button variant="outline" className="rounded-xl border-slate-300" onClick={() => document.getElementById('ads-upload')?.click()}>
                Browse Files
              </Button>
            </div>

            {files.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-bold text-lg">Daftar File ({files.length})</h3>
                <div className="border rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Nama File</th>
                        <th className="px-3 py-2 text-left">Tanggal</th>
                        <th className="px-3 py-2 text-left">Campaign Sistem</th>
                        <th className="px-3 py-2 text-left">Campaign Ads</th>
                        <th className="px-3 py-2 text-left">Kurs USD</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {files.map(f => (
                        <tr key={f.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 max-w-[150px] truncate" title={f.file.name}>{f.file.name}</td>
                          <td className="px-3 py-2">
                            <input type="date" className="p-1.5 border rounded w-[130px]" value={f.tanggal} onChange={(e) => updateFileConfig(f.id, 'tanggal', e.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <select className="p-1.5 border rounded w-[150px]" value={f.campaignId} onChange={(e) => updateFileConfig(f.id, 'campaignId', Number(e.target.value))}>
                              <option value="">Pilih...</option>
                              {campaigns.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <div className="w-[180px]">
                              <StringCombobox 
                                value={f.campaignAdsName} 
                                onChange={(val) => updateFileConfig(f.id, 'campaignAdsName', val)} 
                                options={globalCampaignAdsOptions} 
                                placeholder="Cth: QAHIRA" 
                                className="w-full"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" className="p-1.5 border rounded w-[90px]" value={f.kurs} onChange={(e) => updateFileConfig(f.id, 'kurs', e.target.value)} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => removeFile(f.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button className="w-full h-12 text-md rounded-xl bg-indigo-600 hover:bg-indigo-700" disabled={loading} onClick={handleScanFiles}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Pindai & Proses Semua File"}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
                <AlertCircle className="w-5 h-5" />
                Meja Verifikasi: {unmappedAds.length} Iklan Belum Dikenali
              </div>
              <p className="text-sm text-amber-700">Silakan pilih kreator yang tepat agar sistem mengingatnya (Permanent Mapping).</p>
            </div>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Ad Name (Dari CSV)</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 w-1/2">Kreator Tujuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unmappedAds.map((ad, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700 max-w-[200px] truncate" title={ad.adName}>{ad.adName}</td>
                      <td className="px-4 py-3">
                        <SearchableSelect value={mappings[ad.adName] || ''} initialLabel={mappings[ad.adName] ? `@${creators.find(c => c.id === mappings[ad.adName])?.username}` : ''} onChange={(val) => setMappings({...mappings, [ad.adName]: val as number})} placeholder="Ketik username kreator..." />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="w-1/3 h-12 rounded-xl" onClick={() => setStep(1)}>Kembali</Button>
              <Button className="w-2/3 h-12 rounded-xl bg-indigo-600" onClick={() => setStep(3)}>Simpan Mapping & Lanjut</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in zoom-in-95 duration-300">
            <div className="text-center py-10">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-slate-800">Semua File Siap Di-import!</h3>
              <p className="text-slate-500 mt-2">Data raw akan disimpan sesuai tanggal masing-masing file.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="w-1/3 h-12 rounded-xl" onClick={() => setStep(1)}>Batal</Button>
              <Button className="w-2/3 h-12 rounded-xl bg-indigo-600" onClick={executeImport}>Mulai Import ke Database</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center py-20 animate-in zoom-in-95 duration-500">
            <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Sedang Memasukkan Data...</h3>
            <p className="text-slate-500">Mohon jangan tutup halaman ini.</p>
          </div>
        )}

        {step === 5 && result && (
          <div className="text-center py-10 animate-in slide-in-from-bottom-8 duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-3xl font-bold text-slate-800 mb-2">Import Selesai!</h3>
            <p className="text-slate-600 mb-8">Berhasil memasukkan <strong>{result.success}</strong> baris data raw ke database.</p>
            
            {result.errors.length > 0 && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl text-left text-sm max-h-40 overflow-y-auto mb-8 border border-red-100">
                <p className="font-bold mb-2">Beberapa baris gagal diimport:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            <Button className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700" onClick={() => { setStep(1); setFiles([]); }}>
              Import File Lain
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
