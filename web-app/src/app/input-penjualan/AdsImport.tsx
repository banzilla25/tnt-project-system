"use client";

import { useState, useRef, useEffect, useDeferredValue } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Loader2, ArrowRight } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient } from "@/utils/supabase/client";
import { useDatabaseStore } from "@/store/useDatabaseStore";

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
        className="w-full p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-500"
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

export default function AdsImport() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<{success: number; skipped: number; errors: string[]} | null>(null);
  
  const { campaigns, creators } = useDatabaseStore();
  
  const [selectedCampaign, setSelectedCampaign] = useState<number | ''>('');
  const [kurs, setKurs] = useState<string>('16000');
  
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [unmappedAds, setUnmappedAds] = useState<{adName: string, adId: string}[]>([]);
  const [mappings, setMappings] = useState<Record<string, number>>({});
  const [showErrorLogs, setShowErrorLogs] = useState(false);
  
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPage, setPreviewPage] = useState(1);

  const supabase = createClient();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setUnmappedAds([]);
      setParsedData([]);
      setStep(1);
    }
  };

  const handleParseAndDetect = async () => {
    if (!file || !selectedCampaign || !kurs) return;
    setLoading(true);

    const ext = file.name.split('.').pop()?.toLowerCase();

    const processParsed = async (data: any[]) => {
      const validData = data.filter(row => Object.keys(row).length > 0 && (row['Ad ID'] || row['Ad ID (Shop)'] || row['Ad name']));
      setParsedData(validData);

      const { data: dbMappings } = await supabase.from('ad_name_mapping').select('*');
      const knownMappingMap: Record<string, number> = {};
      dbMappings?.forEach(m => knownMappingMap[m.ad_name] = m.creator_id);

      let unknownAdsMap = new Map<string, string>(); 

      for (const row of validData) {
        const adName = row['Ad name'] || row['Ad Name'] || row['Ad Group Name'] || '';
        const adId = row['Ad ID'] || row['Ad ID (Shop)'] || row['Ad Id'] || '';
        
        if (adName && !knownMappingMap[adName]) {
          unknownAdsMap.set(adName, adId);
        }
      }

      const unknownAdsList = Array.from(unknownAdsMap.entries()).map(([name, id]) => ({ adName: name, adId: id }));
      
      setMappings(knownMappingMap);
      setUnmappedAds(unknownAdsList);
      setSelectedIndices(new Set(validData.map((_, i) => i)));
      setPreviewPage(1);
      setSearchQuery('');
      setStep(unknownAdsList.length > 0 ? 2 : 3);
      setLoading(false);
    };

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processParsed(results.data),
        error: (err) => { alert(err.message); setLoading(false); }
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        processParsed(XLSX.utils.sheet_to_json(worksheet));
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const executeImport = async () => {
    setLoading(true);
    setStep(4);

    try {
      let successCount = 0;
      let skippedCount = 0;
      let errors: string[] = [];

      const newMappings = unmappedAds.filter(ad => mappings[ad.adName]).map(ad => ({ ad_name: ad.adName, creator_id: mappings[ad.adName] }));
      for (const mapping of newMappings) {
        await supabase.from('ad_name_mapping').upsert(mapping, { onConflict: 'ad_name' });
      }

      const dataToImport = parsedData.filter((_, idx) => selectedIndices.has(idx));
      const chunkSize = 100;
      for (let i = 0; i < dataToImport.length; i += chunkSize) {
        const chunk = dataToImport.slice(i, i + chunkSize);
        
        const safeParseNum = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          const cleaned = String(val).replace(/[^0-9.-]+/g, "");
          return Number(cleaned) || 0;
        };

        const inserts = chunk.map(row => {
          const adName = row['Ad name'] || row['Ad Name'] || row['Ad Group Name'] || '';
          const adId = String(row['Ad ID'] || row['Ad ID (Shop)'] || row['Ad Id'] || `${Date.now()}-${Math.random()}`);
          const costUsd = safeParseNum(row['Cost'] || row['Spend'] || row['Amount Spent (USD)']);
          const grossRevenueUsd = safeParseNum(row['Gross revenue (Shop)'] || row['Total Revenue']);
          const purchases = safeParseNum(row['Purchases (Shop)'] || row['Purchases'] || row['Conversions']);
          const impressions = safeParseNum(row['Impressions']);
          const clicks = safeParseNum(row['Clicks (destination)'] || row['Clicks']);
          const creatorId = mappings[adName] || null;

          return {
            ad_id: adId,
            campaign_id: Number(selectedCampaign),
            ad_name: adName,
            creator_id: creatorId,
            tanggal: new Date().toISOString().split('T')[0],
            cost_usd: costUsd,
            gross_revenue_usd: grossRevenueUsd,
            purchases,
            impressions,
            clicks,
            kurs: safeParseNum(kurs)
          };
        });

        const { error } = await supabase.from('ads_performance').upsert(inserts, { onConflict: 'ad_id' });
        
        if (error) {
          errors.push(`Gagal insert batch ${i}: ${error.message}`);
        } else {
          successCount += inserts.length;
        }
      }

      setResult({ success: successCount, skipped: skippedCount, errors });
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

  const safeParseNum = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    return Number(cleaned) || 0;
  };

  const getAdName = (row: any) => row['Ad name'] || row['Ad Name'] || row['Ad Group Name'] || '';
  
  const filteredAds = parsedData.map((row, index) => ({ row, index })).filter(({ row }) => {
    const adName = getAdName(row).toLowerCase();
    const creatorId = mappings[getAdName(row)];
    const creatorName = creatorId ? creators.find(c => c.id === creatorId)?.username?.toLowerCase() || '' : '';
    const q = searchQuery.toLowerCase();
    return adName.includes(q) || creatorName.includes(q);
  });
  
  const isAllVisibleSelected = filteredAds.length > 0 && filteredAds.every(({ index }) => selectedIndices.has(index));
  const handleSelectAllVisible = () => {
    const s = new Set(selectedIndices);
    if (isAllVisibleSelected) {
      filteredAds.forEach(({index}) => s.delete(index));
    } else {
      filteredAds.forEach(({index}) => s.add(index));
    }
    setSelectedIndices(s);
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Campaign Tujuan</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={selectedCampaign} onChange={e => setSelectedCampaign(Number(e.target.value))}>
                  <option value="">-- Pilih Campaign --</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Kurs USD to IDR Hari Ini</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">Rp</span>
                  <input type="number" className="w-full p-2 pl-8 border border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" value={kurs} onChange={e => setKurs(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-4" />
              <p className="font-bold text-slate-700 mb-1">Upload File TikTok Ads</p>
              <p className="text-sm text-slate-500 mb-4">Mendukung format .csv dan .xlsx (Gunakan Laporan Ads Manager)</p>
              <input type="file" accept=".csv, .xlsx, .xls" className="hidden" id="ads-upload" onChange={handleFileUpload} />
              <Button variant="outline" className="rounded-xl border-slate-300" onClick={() => document.getElementById('ads-upload')?.click()}>
                Browse Files
              </Button>
              {file && <p className="mt-4 text-sm text-indigo-600 font-medium bg-indigo-50 p-2 rounded-lg inline-block">Terpilih: {file.name}</p>}
            </div>

            <Button className="w-full h-12 text-md rounded-xl bg-indigo-600 hover:bg-indigo-700" disabled={!file || !selectedCampaign || !kurs || loading} onClick={handleParseAndDetect}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Pindai File (Scan)"}
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
                <AlertCircle className="w-5 h-5" />
                Meja Verifikasi: {unmappedAds.length} Iklan Belum Dikenali
              </div>
              <p className="text-sm text-amber-700">
                Sistem mendeteksi ada beberapa *Ad Name* yang belum pernah terdaftar. Silakan pilih kreator yang tepat agar sistem mengingatnya (Permanent Mapping).
              </p>
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
                        <SearchableSelect 
                          value={mappings[ad.adName] || ''}
                          initialLabel={mappings[ad.adName] ? `@${creators.find(c => c.id === mappings[ad.adName])?.username}` : ''}
                          onChange={(val) => setMappings({...mappings, [ad.adName]: val as number})}
                          placeholder="Ketik username kreator..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" className="w-1/3 h-12 rounded-xl" onClick={() => setStep(1)}>Batal</Button>
              <Button className="w-2/3 h-12 rounded-xl bg-indigo-600" onClick={() => setStep(3)}>Simpan Mapping & Lanjut</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-green-500" /> Preview & Seleksi Data Ads</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Pilih baris yang ingin Bapak import. Data Ad Name yang <strong>belum dimapping</strong> akan tetap masuk ke Campaign, tapi tidak terikat ke kreator manapun.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-semibold text-indigo-700">{selectedIndices.size}</span> baris dipilih dari total {parsedData.length} baris
                </div>
              </div>
              <input 
                type="text" 
                placeholder="Cari Ad Name atau Username..." 
                className="p-2 text-sm border border-slate-300 rounded-lg w-64 focus:ring-1 focus:ring-indigo-500"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPreviewPage(1); }}
              />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                          checked={isAllVisibleSelected}
                          onChange={handleSelectAllVisible}
                        />
                      </th>
                      <th className="p-3 font-semibold">Ad Name</th>
                      <th className="p-3 font-semibold">Kreator (Mapped)</th>
                      <th className="p-3 font-semibold">Cost (USD)</th>
                      <th className="p-3 font-semibold">Revenue (USD)</th>
                      <th className="p-3 font-semibold">Conversions</th>
                      <th className="p-3 font-semibold">Video Views / Impr</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAds.slice((previewPage - 1) * 50, previewPage * 50).map(({ row, index }) => {
                      const adName = getAdName(row);
                      const creatorId = mappings[adName];
                      const creatorName = creatorId ? creators.find(c => c.id === creatorId)?.username : null;
                      const costUsd = safeParseNum(row['Cost'] || row['Spend'] || row['Amount Spent (USD)']);
                      const revenueUsd = safeParseNum(row['Gross revenue (Shop)'] || row['Total Revenue']);
                      const purchases = safeParseNum(row['Purchases (Shop)'] || row['Purchases'] || row['Conversions']);
                      const impr = safeParseNum(row['Impressions']);
                      const isSelected = selectedIndices.has(index);

                      return (
                        <tr key={index} className={`hover:bg-indigo-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/30' : ''}`} onClick={() => {
                          const s = new Set(selectedIndices);
                          if (isSelected) s.delete(index); else s.add(index);
                          setSelectedIndices(s);
                        }}>
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              checked={isSelected}
                              onChange={() => {
                                const s = new Set(selectedIndices);
                                if (isSelected) s.delete(index); else s.add(index);
                                setSelectedIndices(s);
                              }}
                            />
                          </td>
                          <td className="p-3 max-w-[200px] truncate" title={adName}>{adName}</td>
                          <td className="p-3">
                            {creatorName ? (
                              <span className="font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-xs">@{creatorName}</span>
                            ) : (
                              <span className="text-slate-400 italic text-xs">Unmapped</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs text-rose-600">${costUsd.toFixed(2)}</td>
                          <td className="p-3 font-mono text-xs text-emerald-600">${revenueUsd.toFixed(2)}</td>
                          <td className="p-3">{purchases}</td>
                          <td className="p-3 text-slate-500">{impr.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    {filteredAds.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">Tidak ada baris yang cocok dengan pencarian.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredAds.length > 50 && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Halaman {previewPage} dari {Math.ceil(filteredAds.length / 50)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewPage(p => Math.max(1, p - 1))} disabled={previewPage === 1}>Sebelumnya</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreviewPage(p => Math.min(Math.ceil(filteredAds.length / 50), p + 1))} disabled={previewPage >= Math.ceil(filteredAds.length / 50)}>Selanjutnya</Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" className="h-12 px-6 rounded-xl" onClick={() => setStep(unmappedAds.length > 0 ? 2 : 1)}>Kembali</Button>
              <Button className="h-12 px-8 rounded-xl bg-indigo-600" onClick={executeImport} disabled={selectedIndices.size === 0}>
                Mulai Import {selectedIndices.size} Baris <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="py-16 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="font-medium text-slate-600">Menyimpan data ke database...</p>
          </div>
        )}

        {step === 5 && result && (
          <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-2xl flex items-start gap-4 mb-6 ${result.errors.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              {result.errors.length > 0 ? (
                <AlertCircle className="w-10 h-10 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="w-10 h-10 text-emerald-500 shrink-0" />
              )}
              
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-2 ${result.errors.length > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {result.errors.length > 0 ? 'Import Selesai dengan Peringatan' : 'Import Sukses 100%!'}
                </h3>
                <p className={`text-sm mb-4 ${result.errors.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  Proses Upsert performa iklan telah selesai. Duplikasi dicegah melalui Ad ID.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/60 p-4 rounded-xl border border-white shadow-sm flex flex-col justify-center items-center text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">Total Data Tersimpan</p>
                    <p className="text-3xl font-bold text-slate-800">{result.success.toLocaleString()} <span className="text-sm font-normal">baris</span></p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-4 bg-white/50 rounded-xl border border-amber-100 text-xs overflow-hidden">
                    <div 
                      className="p-3 font-bold text-amber-900 flex items-center justify-between cursor-pointer hover:bg-amber-50/50 transition-colors"
                      onClick={() => setShowErrorLogs(!showErrorLogs)}
                    >
                      <div className="flex items-center gap-2">
                        {showErrorLogs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span>Log Error ({result.errors.length})</span>
                      </div>
                    </div>
                    {showErrorLogs && (
                      <div className="p-4 pt-0 border-t border-amber-100">
                        <ul className="list-disc pl-4 space-y-1 text-amber-800 font-mono mt-2">
                          {result.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                          {result.errors.length > 50 && <li>...dan {result.errors.length - 50} error lainnya.</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-6">
                  <Button variant="outline" className="w-full rounded-xl" onClick={() => setStep(1)}>Import File Lain</Button>
                </div>
              </div>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
