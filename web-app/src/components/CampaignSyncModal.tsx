"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Upload, Download, Loader2, ArrowRight, FileSpreadsheet, FolderKanban, AlertCircle, CheckCircle } from "lucide-react";
import { UsernameAutocomplete } from "@/components/ui/UsernameAutocomplete";
import { findClosestMatch } from "@/utils/stringSimilarity";
import { downloadCampaignSyncTemplate, parseCampaignSyncFile, parseFileHeaders, ParsedCampaignCreatorRow, CampaignColumnMapping } from "@/utils/importCampaignSync";
import { createClient } from "@/utils/supabase/client";
import { useDatabaseStore } from "@/store/useDatabaseStore";

const supabase = createClient();

export function CampaignSyncModal({ campaignId: initialCampaignId, onComplete }: { campaignId?: number; onComplete?: () => void }) {
  const { campaigns, fetchData, creators } = useDatabaseStore();
  const creatorUsernames = creators.map(c => c.username);
  const [campaignId, setCampaignId] = useState(initialCampaignId || 0);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1|2|3|4>(1);
  const [file, setFile] = useState<File | null>(null);
  
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CampaignColumnMapping>({
    username: '',
    approval: '',
    notes_manager: '',
    notes_pic: '',
    sample_progress: ''
  });

  const [preview, setPreview] = useState<ParsedCampaignCreatorRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitStatus, setCommitStatus] = useState('');
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

  const updatePreviewUsername = (index: number, newUsername: string) => {
    const newPreview = [...preview];
    newPreview[index].username = newUsername.replace(/\s+/g, '');
    setPreview(newPreview);
    setEditingRowIndex(null);
  };

  const campaignName = campaigns.find(c => c.id === campaignId)?.nama || '...';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setIsProcessing(true);
    setErrors([]);
    try {
      const headers = await parseFileHeaders(f);
      setCsvHeaders(headers);
      
      const guessMapping = { ...mapping };
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());
      
      headers.forEach((h, i) => {
        const lh = lowerHeaders[i];
        if (lh === 'username' || lh === 'username creator') guessMapping.username = h;
        if (lh === 'approval' || lh === 'status approval') guessMapping.approval = h;
        if (lh === 'notes manager' || lh === 'manager notes') guessMapping.notes_manager = h;
        if (lh === 'notes pic' || lh === 'pic notes') guessMapping.notes_pic = h;
        if (lh === 'sample progress' || lh === 'progress sample') guessMapping.sample_progress = h;
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
      const res = await parseCampaignSyncFile(file, mapping);
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
    if (preview.length === 0 || campaignId === 0) return;
    setIsCommitting(true);
    setCommitProgress(0);
    setCommitStatus('Menyiapkan data sinkronisasi...');
    try {
      setCommitStatus('Mengecek data kreator di database...');
      const usernamesArray = Array.from(new Set(preview.map(p => p.username)));
      const lowercasedUsernames = usernamesArray.map(u => u.toLowerCase());
      const existingCreators: any[] = [];
      
      for (let i = 0; i < usernamesArray.length; i += 100) {
        const chunk = usernamesArray.slice(i, i + 100);
        const { data, error } = await supabase.from('creators').select('id, username').in('username', chunk);
        if (error) throw error;
        if (data) existingCreators.push(...data);
      }

      const existingCreatorUsernames = new Set(existingCreators.map(c => c.username.toLowerCase()));
      const newUsernames = usernamesArray.filter(u => !existingCreatorUsernames.has(u.toLowerCase()));
      
      let creatorMap = new Map(existingCreators.map(c => [c.username.toLowerCase(), c.id]));

      // 2. Batch insert kreator baru (chunk per 100 untuk aman)
      if (newUsernames.length > 0) {
        for (let i = 0; i < newUsernames.length; i += 100) {
          setCommitStatus(`Menyimpan ${newUsernames.length} kreator baru ke database... (${i}/${newUsernames.length})`);
          const chunk = newUsernames.slice(i, i + 100);
          const insertData = chunk.map(username => ({
            username,
            link_account: `https://www.tiktok.com/@${username}`
          }));
          
          const { data: newC, error: errC } = await supabase.from('creators').insert(insertData).select('id, username');
          if (errC) throw errC;
          if (newC) {
            newC.forEach(c => creatorMap.set(c.username.toLowerCase(), c.id));
          }
        }
      }

      setCommitStatus('Menyusun data campaign...');
      const { data: existingCampaignCreators } = await supabase.from('campaign_creators').select('id, creator_id').eq('campaign_id', campaignId);
      const existingCcMap = new Map(existingCampaignCreators?.map(cc => [cc.creator_id, cc.id]));

      // 3. Siapkan data upsert untuk campaign_creators
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      
      preview.forEach(row => {
        const creatorId = creatorMap.get(row.username.toLowerCase());
        if (!creatorId) return; // Skip if invalid
        
        const existingCcId = existingCcMap.get(creatorId);
        const payload = {
          campaign_id: campaignId,
          creator_id: creatorId,
          approval: row.approval,
          notes_manager: row.notes_manager,
          notes_pic: row.notes_pic,
          sample_progress: row.sample_progress || 'Belum',
          price: 0,
          qty_vt: 1,
          client_approval: 'not_required',
          status_bayar: 'belum'
        };
        
        if (existingCcId) {
          toUpdate.push({ id: existingCcId, ...payload });
        } else {
          toInsert.push(payload);
        }
      });

      // 4. Batch update existing
      for (let i = 0; i < toUpdate.length; i += 500) {
        setCommitStatus(`Menyinkronkan data lama ke Campaign... (${i}/${toUpdate.length})`);
        const chunk = toUpdate.slice(i, i + 500);
        const { error } = await supabase.from('campaign_creators').upsert(chunk);
        if (error) throw error;
        setCommitProgress(Math.min(i + 500, toUpdate.length));
      }

      // 5. Batch insert new
      for (let i = 0; i < toInsert.length; i += 500) {
        setCommitStatus(`Menambahkan data baru ke Campaign... (${i}/${toInsert.length})`);
        const chunk = toInsert.slice(i, i + 500);
        const { error } = await supabase.from('campaign_creators').insert(chunk);
        if (error) throw error;
        setCommitProgress(toUpdate.length + Math.min(i + 500, toInsert.length));
      }

      setCommitStatus('Memperbarui tampilan...');
      await fetchData();
      setStep(4);
    } catch (e: any) {
      setErrors([e.message || "Terjadi kesalahan saat commit ke database."]);
    } finally {
      setIsCommitting(false);
      setCommitStatus('');
    }
  };

  const resetState = () => {
    setStep(1);
    setFile(null);
    setCsvHeaders([]);
    setPreview([]);
    setErrors([]);
    if (!initialCampaignId) setCampaignId(0);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="w-4 h-4" /> Sync Listing (Excel/CSV)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync Campaign Listing (Excel/CSV)</DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center mb-6 px-4">
          {['Pilih Campaign & Upload', 'Mapping Kolom', 'Review & Sync'].map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${step === i + 1 ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>{s}</span>
            </div>
          ))}
        </div>

        <div className="space-y-6 mt-4">
          {step === 1 && (
            <div className="space-y-6">
              {!initialCampaignId && (
                <div className="space-y-2 p-4 border rounded-xl bg-slate-50">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-blue-600" /> Pilih Campaign Tujuan
                  </label>
                  <select 
                    className="w-full p-2 border rounded-md" 
                    value={campaignId} 
                    onChange={(e) => setCampaignId(Number(e.target.value))}
                  >
                    <option value={0}>-- Pilih Campaign --</option>
                    {campaigns.filter(c => c.status === 'aktif').map(c => (
                      <option key={c.id} value={c.id}>{c.nama}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-4 p-4 bg-blue-50 text-blue-800 rounded-xl border border-blue-100">
                <FileSpreadsheet className="w-8 h-8 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Penting:</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                    <li>Pilih file berformat <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong>.</li>
                    <li>Sistem akan mendeteksi dari sheet paling pertama.</li>
                  </ul>
                  <button onClick={downloadCampaignSyncTemplate} className="text-blue-600 hover:underline text-xs mt-2 block font-semibold">Unduh Template CSV</button>
                </div>
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
                <div className="grid grid-cols-2 gap-4">
                  {(Object.keys(mapping) as Array<keyof CampaignColumnMapping>).map(key => (
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
                    {isCommitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {commitStatus || 'Memproses...'} {commitProgress > 0 ? `(${Math.round((commitProgress / preview.length) * 100)}%)` : ''}</> : <><Upload className="w-4 h-4" /> Mulai Sinkronisasi</>}
                  </Button>
                </div>
              </div>

              {/* Summary Counts */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-green-600 uppercase">Approved</p>
                  <p className="text-xl font-bold text-green-700">{preview.filter(r => r.approval === 'approved').length}</p>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-red-600 uppercase">Not Approved</p>
                  <p className="text-xl font-bold text-red-700">{preview.filter(r => r.approval === 'not_approved').length}</p>
                </div>
                <div className="bg-purple-50 border border-purple-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-purple-600 uppercase">Alternate</p>
                  <p className="text-xl font-bold text-purple-700">{preview.filter(r => r.approval === 'alternate').length}</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-center">
                  <p className="text-xs font-semibold text-yellow-600 uppercase">Pending</p>
                  <p className="text-xl font-bold text-yellow-700">{preview.filter(r => r.approval === 'pending').length}</p>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 text-red-600 p-3 rounded text-xs space-y-1 max-h-32 overflow-y-auto">
                  <p className="font-semibold">Peringatan / Error:</p>
                  {errors.map((e, i) => <p key={i}>- {e}</p>)}
                </div>
              )}

              {preview.length > 0 && (
                <div className="border rounded max-h-96 overflow-y-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b sticky top-0 z-10">
                      <tr>
                        <th className="p-2 font-medium">Username</th>
                        <th className="p-2 font-medium">Status Approval</th>
                        <th className="p-2 font-medium">Sample Progress</th>
                        <th className="p-2 font-medium">Notes Manager</th>
                        <th className="p-2 font-medium">Notes PIC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2 align-top min-w-[250px]">
                            {editingRowIndex === i ? (
                              <UsernameAutocomplete
                                value={row.username}
                                options={creatorUsernames}
                                onChange={(val) => updatePreviewUsername(i, val)}
                                onCancel={() => setEditingRowIndex(null)}
                              />
                            ) : (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="font-semibold text-slate-700">@{row.username}</span>
                                {(() => {
                                  const exactMatch = creatorUsernames.find(u => u.toLowerCase() === row.username.toLowerCase());
                                  if (exactMatch) {
                                    return <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-medium w-fit">Valid</span>;
                                  }

                                  const match = findClosestMatch(row.username, creatorUsernames);
                                  return (
                                    <div className="flex flex-col gap-1 mt-1 bg-amber-50 border border-amber-100 p-1.5 rounded w-full">
                                      <span className="text-[10px] font-bold text-amber-600">⚠ Tidak Ditemukan</span>
                                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                         {match && (
                                           <button onClick={() => updatePreviewUsername(i, match.match)} className="text-[10px] px-2 py-1 bg-blue-500 text-white shadow-sm rounded hover:bg-blue-600 font-semibold transition-colors">
                                             Ganti ➡️ @{match.match}
                                           </button>
                                         )}
                                         <button onClick={() => setEditingRowIndex(i)} className="text-[10px] px-2 py-1 bg-white border border-slate-300 shadow-sm rounded hover:bg-slate-50 text-slate-600 font-medium">
                                           Ketik Manual
                                         </button>
                                      </div>
                                      <span className="text-[9px] text-slate-400">Biarkan jika ingin mendaftarkan sebagai kreator baru.</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              row.approval === 'approved' ? 'bg-green-100 text-green-700' :
                              row.approval === 'not_approved' ? 'bg-red-100 text-red-700' :
                              row.approval === 'alternate' ? 'bg-purple-100 text-purple-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {row.approval}
                            </span>
                          </td>
                          <td className="p-2 align-top max-w-[150px] truncate">{row.sample_progress || '-'}</td>
                          <td className="p-2 align-top max-w-[200px] truncate">{row.notes_manager || '-'}</td>
                          <td className="p-2 align-top max-w-[200px] truncate">{row.notes_pic || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">Sinkronisasi Berhasil!</h3>
              <p className="text-sm text-slate-500 text-center">
                Sebanyak {preview.length - errors.length} dari {preview.length} data telah diproses ke dalam sistem.
              </p>
              
              {errors.length > 0 && (
                <div className="w-full bg-red-50 text-red-600 p-3 rounded text-xs space-y-1 max-h-40 overflow-y-auto text-left border border-red-100">
                  <p className="font-semibold mb-1">Peringatan / Data yang dilewati:</p>
                  {errors.map((e, i) => <p key={i}>- {e}</p>)}
                </div>
              )}

              <Button onClick={() => { setOpen(false); onComplete?.(); }} className="mt-4 px-8">
                Selesai & Tutup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
