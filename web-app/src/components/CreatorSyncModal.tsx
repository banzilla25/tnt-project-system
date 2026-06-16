"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Upload, Download, Loader2, ArrowRight } from "lucide-react";
import { downloadCreatorSyncTemplate, parseCreatorSyncFile, parseFileHeaders, ParsedCreatorRow, ColumnMapping } from "@/utils/importCreatorSync";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export function CreatorSyncModal({ onComplete }: { onComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1|2|3>(1);
  const [file, setFile] = useState<File | null>(null);
  
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    username: '',
    followers: '',
    tier: '',
    level: '',
    ratecard: '',
    audience_age: '',
    gmv: '',
    no_whatsapp: ''
  });

  const [preview, setPreview] = useState<ParsedCreatorRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsProcessing(true);
    setErrors([]);
    try {
      const headers = await parseFileHeaders(f);
      setCsvHeaders(headers);
      
      // Auto-guess mapping
      const guessMapping = { ...mapping };
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());
      
      headers.forEach((h, i) => {
        const lh = lowerHeaders[i];
        if (lh === 'username' || lh === 'username creator') guessMapping.username = h;
        if (lh === 'followers') guessMapping.followers = h;
        if (lh === 'tier') guessMapping.tier = h;
        if (lh === 'level') guessMapping.level = h;
        if (lh === 'ratecard' || lh === 'price') guessMapping.ratecard = h;
        if (lh === 'audience age' || lh === 'audiens age') guessMapping.audience_age = h;
        if (lh === 'gmv 30 days' || lh === 'gmv 30days' || lh === 'gmv') guessMapping.gmv = h;
        if (lh === 'no whatsapp' || lh === 'no. whatsapp' || lh === 'whatsapp' || lh === 'wa') guessMapping.no_whatsapp = h;
      });
      
      setMapping(guessMapping);
      setStep(2);
    } catch (err: any) {
      setErrors([err.message || "Gagal memproses header file"]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedMapping = async () => {
    if (!file) return;
    setIsProcessing(true);
    setErrors([]);
    try {
      const res = await parseCreatorSyncFile(file, mapping);
      setPreview(res.validData);
      setErrors(res.errors);
      setStep(3);
    } catch (err: any) {
      setErrors([err.message || "Gagal memproses file"]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (preview.length === 0) return;
    setIsCommitting(true);
    try {
      // Fetch existing creators to map IDs
      const usernames = preview.map(p => p.username);
      const { data: existingCreators } = await supabase.from('creators').select('id, username').in('username', usernames);
      const creatorMap = new Map(existingCreators?.map(c => [c.username, c.id]));

      for (const row of preview) {
        let creatorId = creatorMap.get(row.username);
        
        // 1. Upsert Creator
        if (!creatorId) {
          const { data: newC, error: errC } = await supabase.from('creators').insert({
            username: row.username,
            link_account: `https://www.tiktok.com/@${row.username}`,
            tipe_kreator: 'eksternal' // default fallback if needed
          }).select().single();
          if (errC) { setErrors(prev => [...prev, `Gagal buat kreator ${row.username}`]); continue; }
          creatorId = newC.id;
          creatorMap.set(row.username, creatorId);
        }

        // 2. Contacts
        if (row.no_whatsapp) {
          const { data: currentContacts } = await supabase.from('creator_contacts')
            .select('id, nomor').eq('creator_id', creatorId).eq('status', 'aktif');
          
          const existing = currentContacts?.[0];
          if (!existing || existing.nomor !== row.no_whatsapp) {
            if (existing) {
              await supabase.from('creator_contacts').update({ status: 'arsip', tanggal_diganti: new Date().toISOString() }).eq('id', existing.id);
            }
            await supabase.from('creator_contacts').insert({
              creator_id: creatorId,
              nomor: row.no_whatsapp,
              status: 'aktif',
              tanggal_mulai: new Date().toISOString()
            });
          }
        }

        // 3. Snapshot
        await supabase.from('creator_snapshots').insert({
          creator_id: creatorId,
          tanggal_update: new Date().toISOString(),
          followers: row.followers,
          tier: row.tier, // fallback tier or auto tier
          level: row.level,
          ratecard: row.ratecard,
          audience_age: row.audience_age,
          gmv_30d: row.gmv_30_days
        });
      }

      setOpen(false);
      onComplete?.();
    } catch (e: any) {
      setErrors([e.message || "Terjadi kesalahan saat commit ke database."]);
    } finally {
      setIsCommitting(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setFile(null);
    setCsvHeaders([]);
    setPreview([]);
    setErrors([]);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="w-4 h-4" /> Sync Data (Excel/CSV)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sinkronisasi Profil Kreator (Excel/CSV)</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-4">
          
          {/* Step Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`px-3 py-1 rounded-full ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>1. Upload</div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <div className={`px-3 py-1 rounded-full ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>2. Mapping Kolom</div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <div className={`px-3 py-1 rounded-full ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>3. Preview & Sync</div>
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
                <div>
                  <p className="text-sm font-medium mb-1">Penting:</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                    <li>Pilih file berformat <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong>.</li>
                    <li>Sistem akan otomatis membaca dari tab (sheet) yang paling pertama.</li>
                    <li>Sistem akan otomatis mendeteksi nama kolom (header).</li>
                  </ul>
                </div>
                <Button variant="outline" size="sm" onClick={downloadCreatorSyncTemplate} className="gap-2">
                  <Download className="w-4 h-4" /> Template CSV
                </Button>
              </div>

              <div className="space-y-2">
                <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                {isProcessing && <p className="text-xs text-blue-600">Membaca file...</p>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <p className="text-sm font-medium text-amber-800 mb-2">Cocokkan Kolom (Mapping)</p>
                <p className="text-xs text-amber-700 mb-4">Pilih kolom dari file CSV Anda yang sesuai dengan data sistem kami. Jika data tidak ada di file Anda, biarkan "Abaikan (Kosong)".</p>
                
                <div className="grid grid-cols-2 gap-4">
                  {(Object.keys(mapping) as Array<keyof ColumnMapping>).map(key => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-xs font-semibold uppercase text-slate-600">{key.replace('_', ' ')} <span className={key === 'username' ? 'text-red-500' : 'hidden'}>*</span></label>
                      <select 
                        value={mapping[key]}
                        onChange={e => setMapping({...mapping, [key]: e.target.value})}
                        className="p-2 border rounded text-sm bg-white"
                      >
                        <option value="">-- Abaikan (Kosong) --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
                <Button onClick={handleProceedMapping} disabled={!mapping.username || isProcessing}>
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lanjut Preview'}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Preview Data ({preview.length} baris siap diproses)</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Ubah Mapping</Button>
                  <Button onClick={handleCommit} disabled={isCommitting} className="gap-2">
                    {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Mulai Sinkronisasi
                  </Button>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 text-red-600 p-3 rounded text-xs space-y-1 max-h-32 overflow-y-auto">
                  <p className="font-semibold">Peringatan / Error:</p>
                  {errors.map((e, i) => <p key={i}>- {e}</p>)}
                </div>
              )}

              {preview.length > 0 && (
                <div className="border rounded overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="p-2 font-medium">Username</th>
                        <th className="p-2 font-medium">Followers</th>
                        <th className="p-2 font-medium">Tier</th>
                        <th className="p-2 font-medium">Level</th>
                        <th className="p-2 font-medium">Ratecard</th>
                        <th className="p-2 font-medium">No WA</th>
                        <th className="p-2 font-medium">GMV 30d</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2">@{row.username}</td>
                          <td className="p-2">{row.followers?.toLocaleString() || '-'}</td>
                          <td className="p-2">{row.tier || '-'}</td>
                          <td className="p-2">{row.level || '-'}</td>
                          <td className="p-2">{row.ratecard === 0 ? 'Barter' : row.ratecard ? `Rp ${row.ratecard.toLocaleString()}` : '-'}</td>
                          <td className="p-2">{row.no_whatsapp || '-'}</td>
                          <td className="p-2">{row.gmv_30_days ? `Rp ${row.gmv_30_days.toLocaleString()}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 10 && <p className="text-xs text-slate-500 text-center p-2 border-t bg-slate-50">Menampilkan 10 baris pertama dari {preview.length} data.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
