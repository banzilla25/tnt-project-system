"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Upload, Download, Loader2, CheckCircle, ArrowRight } from "lucide-react";
import { UsernameAutocomplete } from "@/components/ui/UsernameAutocomplete";
import { findClosestMatch } from "@/utils/stringSimilarity";
import { downloadAddressSyncTemplate, parseAddressSyncFile, AddressColumnMapping, ParsedAddressRow } from "@/utils/importAddressSync";
import { parseFileHeaders } from "@/utils/importCampaignSync";
import { createClient } from "@/utils/supabase/client";
import { useDatabaseStore } from "@/store/useDatabaseStore";

const supabase = createClient();

export function AddressSyncModal({ campaignId: initialCampaignId, onComplete }: { campaignId?: number; onComplete?: () => void }) {
  const { campaigns, fetchData, creators } = useDatabaseStore();
  const creatorUsernames = creators.map(c => c.username);
  const [campaignId, setCampaignId] = useState(initialCampaignId || 0);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1|2|3|4>(1);
  const [file, setFile] = useState<File | null>(null);
  
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<AddressColumnMapping>({
    username: '',
    nama_penerima: '',
    nama_jalan: '',
    kecamatan: '',
    kabupaten_kota: '',
    provinsi: '',
    kode_pos: '',
    resi: '',
    proses: ''
  });

  const [preview, setPreview] = useState<ParsedAddressRow[]>([]);
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
        if (lh === 'nama penerima' || lh === 'penerima' || lh === 'nama') guessMapping.nama_penerima = h;
        if (lh === 'alamat lengkap' || lh === 'alamat' || lh === 'jalan') guessMapping.nama_jalan = h;
        if (lh === 'kecamatan' || lh === 'kec') guessMapping.kecamatan = h;
        if (lh === 'kota/kabupaten' || lh === 'kota' || lh === 'kabupaten') guessMapping.kabupaten_kota = h;
        if (lh === 'provinsi' || lh === 'prov') guessMapping.provinsi = h;
        if (lh === 'kode pos' || lh === 'kodepos') guessMapping.kode_pos = h;
        if (lh === 'resi' || lh === 'no resi') guessMapping.resi = h;
        if (lh === 'status' || lh === 'status pengiriman' || lh === 'proses') guessMapping.proses = h;
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
      const res = await parseAddressSyncFile(file, mapping);
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
    try {
      const { data: ccs } = await supabase
        .from('campaign_creators')
        .select('id, creator_id, creators(username)')
        .eq('campaign_id', campaignId)
        .in('approval', ['approved', 'alternate']);

      const { data: addresses } = await supabase
        .from('creator_addresses')
        .select('id, campaign_creator_id')
        .in('campaign_creator_id', ccs?.map(c => c.id) || []);

      const addressMap = new Map(addresses?.map(a => [a.campaign_creator_id, a.id]));
      const usernameToCcId = new Map<string, number>();
      const uniquePreview = Array.from(new Map(preview.map(item => [item.username.toLowerCase(), item])).values());
      const usernamesArray = uniquePreview.map(p => p.username);
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
      ccs?.forEach(cc => {
        const creator = cc.creators as any;
        if (creator && !Array.isArray(creator) && creator.username) {
          usernameToCcId.set(creator.username.toLowerCase(), cc.id);
        }
      });

      let skippedCount = 0;
      setCommitProgress(0);

      const chunkArray = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
      const chunks = chunkArray(uniquePreview, 50);

      for (let c = 0; c < chunks.length; c++) {
        setCommitStatus(`Memproses gerbong ${c + 1} dari ${chunks.length}...`);
        
        await Promise.all(chunks[c].map(async (row: any, idx: number) => {
          const ccId = usernameToCcId.get(row.username.toLowerCase());
          if (!ccId) {
            skippedCount++;
            return;
          }

          const existingAddrId = addressMap.get(ccId);
          const payload = {
            campaign_creator_id: ccId,
            ...(row.nama_penerima && { nama_penerima: row.nama_penerima }),
            ...(row.nama_jalan && { nama_jalan: row.nama_jalan }),
            ...(row.kecamatan && { kecamatan: row.kecamatan }),
            ...(row.kabupaten_kota && { kabupaten_kota: row.kabupaten_kota }),
            ...(row.provinsi && { provinsi: row.provinsi }),
            ...(row.kode_pos && { kode_pos: row.kode_pos }),
            ...(row.resi && { resi: row.resi }),
            ...(row.proses && { proses: row.proses }),
          };

          if (existingAddrId) {
            await supabase.from('creator_addresses').update(payload).eq('id', existingAddrId);
          } else {
            await supabase.from('creator_addresses').insert(payload);
          }

          const cc = ccs?.find(c => c.id === ccId);
          if (cc && cc.creator_id && row.nama_jalan) {
            const { data: existingBooks } = await supabase.from('creator_address_book')
              .select('id, alamat_jalan')
              .eq('creator_id', cc.creator_id);
              
            const isExist = existingBooks?.find(b => b.alamat_jalan?.toLowerCase() === row.nama_jalan?.toLowerCase());
            if (!isExist) {
              await supabase.from('creator_address_book').insert({
                creator_id: cc.creator_id,
                label: 'Hasil Sync Excel',
                nama_penerima: row.nama_penerima,
                alamat_jalan: row.nama_jalan,
                kecamatan: row.kecamatan,
                kota: row.kabupaten_kota,
                provinsi: row.provinsi,
                kodepos: row.kode_pos
              });
            }
          }
        }));

        setCommitProgress(((c + 1) / chunks.length) * 100);
      }

      if (skippedCount > 0) {
        setErrors([`Perhatian: Ada ${skippedCount} baris yang diabaikan (kreator tidak ditemukan, reject, atau pending di campaign ini).`]);
      }
      await fetchData();
      setStep(4);
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
    if (!initialCampaignId) setCampaignId(0);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="w-4 h-4" /> Sync Alamat (Excel/CSV)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync Alamat (Excel/CSV)</DialogTitle>
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
                    Pilih Campaign Tujuan
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

              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
                <div>
                  <p className="text-sm font-medium mb-1">Penting:</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-1">
                    <li>Sistem hanya akan memproses alamat untuk kreator yang <strong>Approved / Alternate</strong> di Campaign ini.</li>
                    <li>Pilih file berformat <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong>.</li>
                  </ul>
                </div>
                <Button variant="outline" size="sm" onClick={downloadAddressSyncTemplate} className="gap-2">
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
                <p className="text-sm font-medium text-amber-800 mb-2">Cocokkan Kolom Alamat</p>
                <div className="grid grid-cols-2 gap-4">
                  {(Object.keys(mapping) as Array<keyof AddressColumnMapping>).map(key => (
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
                <p className="text-sm font-medium">Preview Data Alamat ({preview.length} baris)</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Ubah Mapping</Button>
                  <Button onClick={handleCommit} disabled={isCommitting} className="gap-2">
                    {isCommitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {Math.round((commitProgress / preview.length) * 100)}% ({commitProgress}/{preview.length})</> : <><Upload className="w-4 h-4" /> Mulai Sinkronisasi</>}
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
                <div className="border rounded max-h-96 overflow-y-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b sticky top-0 z-10">
                      <tr>
                        <th className="p-2 font-medium">Username</th>
                        <th className="p-2 font-medium">Nama Penerima</th>
                        <th className="p-2 font-medium">Alamat</th>
                        <th className="p-2 font-medium">Resi</th>
                        <th className="p-2 font-medium">Status</th>
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
                                      <span className="text-[10px] font-bold text-amber-600">⚠ Kreator Tidak Ditemukan</span>
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
                                      <span className="text-[9px] text-slate-400">Data ini akan diabaikan jika kreator belum masuk campaign.</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                          <td className="p-2 align-top font-medium max-w-[150px] truncate">{row.nama_penerima || '-'}</td>
                          <td className="p-2 align-top text-xs max-w-[200px] truncate">{row.nama_jalan || '-'}</td>
                          <td className="p-2 align-top text-xs max-w-[100px] truncate">{row.kabupaten_kota || '-'}</td>
                          <td className="p-2 align-top">
                            <span className={`px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700`}>
                              {row.proses}
                            </span>
                          </td>
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
                Sebanyak {preview.length} data alamat telah diproses ke dalam sistem.
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
