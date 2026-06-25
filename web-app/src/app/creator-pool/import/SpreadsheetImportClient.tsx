"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { getAutoTier } from '@/utils/importCreatorSync';
import { ArrowLeft, Save, Play, Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useDatabaseStore } from "@/store/useDatabaseStore";

import { useAuth } from "@/providers/AuthProvider";

type SpreadsheetRow = {
  id: string;
  username: string;
  followers: string;
  level: string;
  audience_age: string;
  gmv_30d: string;
  niche: string;
  mcn: string;
  ratecard: string;
  whatsapp: string;
  avatar_url?: string;
  
  status?: 'baru' | 'update' | 'error';
  errorMsg?: string;
  existingInfo?: string;
};

const getEmptyRow = (): SpreadsheetRow => ({
  id: Math.random().toString(36).substring(2, 9),
  username: '',
  followers: '',
  level: '',
  audience_age: '',
  gmv_30d: '',
  niche: '',
  mcn: '',
  ratecard: '',
  whatsapp: '',
});

export default function SpreadsheetImportClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { niches, fetchData } = useDatabaseStore();
  const { profile } = useAuth();
  
  const [rows, setRows] = useState<SpreadsheetRow[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`tnt_import_draft_global`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
    }
    return Array(5).fill(null).map(getEmptyRow);
  });
  
  const [step, setStep] = useState<1 | 2>(1);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const updateRow = (id: string, field: keyof SpreadsheetRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        if (field === 'username') updated.status = undefined;
        return updated;
      }
      return r;
    }));
  };

  useEffect(() => {
    if (rows.length > 0) {
      localStorage.setItem(`tnt_import_draft_global`, JSON.stringify(rows));
    } else {
      localStorage.removeItem(`tnt_import_draft_global`);
    }
  }, [rows]);

  useEffect(() => {
    const usernamesParam = searchParams.get('usernames');
    if (usernamesParam) {
      const names = usernamesParam.split(',').map(n => n.trim()).filter(n => n.length > 0);
      if (names.length > 0) {
        setRows(prevRows => {
          const existingUsernames = new Set(prevRows.map(r => r.username.toLowerCase()));
          const newNames = names.filter(n => !existingUsernames.has(n.toLowerCase()));
          if (newNames.length === 0) return prevRows;

          let nextRows = [...prevRows];
          for (const name of newNames) {
            const emptyIdx = nextRows.findIndex(r => r.username === '');
            if (emptyIdx !== -1) {
              nextRows[emptyIdx] = { ...nextRows[emptyIdx], username: name };
            } else {
              const newRow = getEmptyRow();
              newRow.username = name;
              nextRows.push(newRow);
            }
          }
          return nextRows;
        });
      }
    }
  }, [searchParams]);

  const handleVerify = async () => {
    let filledRows = [...rows].filter(r => r.username.trim() !== '');
    if (filledRows.length === 0) {
      alert("Tidak ada data username yang diisi!");
      return;
    }

    setIsVerifying(true);
    
    let hasError = false;
    filledRows = filledRows.map(r => {
      let err = '';
      if (!r.niche.trim()) err = "Niche wajib diisi!";
      if (!r.whatsapp.trim()) err = "No. Whatsapp wajib diisi!";
      if (r.username.includes(' ')) err = "Username tidak boleh ada spasi";
      if (err) hasError = true;
      return { ...r, status: err ? 'error' : undefined, errorMsg: err };
    });

    if (hasError) {
      setRows(rows.map(r => {
        const f = filledRows.find(fr => fr.id === r.id);
        return f ? f : r;
      }));
      setIsVerifying(false);
      alert("Ada data yang masih error (merah). Silakan perbaiki terlebih dahulu.");
      return;
    }

    const usernames = filledRows.map(r => r.username);
    const { data: dbCreators } = await supabase.from('creators').select('id, username, added_by, created_at, last_updated_by, last_updated_at').in('username', usernames);
    const creatorMap = new Map((dbCreators || []).map(c => [c.username, c]));
    
    const { data: profiles } = await supabase.from('profiles').select('id, nama');
    const profileMap = new Map((profiles || []).map(p => [p.id, p.nama]));

    filledRows = filledRows.map(r => {
      const c = creatorMap.get(r.username);
      if (!c) {
        return { ...r, status: 'baru', existingInfo: 'Belum terdaftar di database' };
      }
      
      const updaterId = c.last_updated_by;
      const adderId = c.added_by;
      const updaterName = updaterId ? (profileMap.get(updaterId) || updaterId) : null;
      const adderName = adderId ? (profileMap.get(adderId) || adderId) : null;

      const lastUpdate = updaterName ? `diupdate oleh ${updaterName}` : (adderName ? `diinput oleh ${adderName}` : 'Sistem');
      const lastDate = c.last_updated_at || c.created_at;
      const dateStr = lastDate ? new Date(lastDate).toLocaleDateString() : '';

      return { 
        ...r, 
        status: 'update', 
        existingInfo: `Data Kreator ${lastUpdate} ${dateStr}`
      };
    });

    setRows(rows.map(r => {
      const f = filledRows.find(fr => fr.id === r.id);
      return f ? f : r;
    }));
    
    setIsVerifying(false);
    setStep(2);
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const filledRows = rows.filter(r => r.username.trim() !== '' && r.status !== 'error');
      
      const uniqueUsernames = Array.from(new Set(filledRows.map(r => r.username)));
      
      // Upsert Creators
      const creatorPayloads = [];
      const dbCreatorsRes = await supabase.from('creators').select('username').in('username', uniqueUsernames);
      const existingUsernames = new Set((dbCreatorsRes.data || []).map(c => c.username));

      for (const r of filledRows) {
        if (!existingUsernames.has(r.username)) {
           creatorPayloads.push({
             username: r.username,
             link_account: `https://www.tiktok.com/@${r.username}`,
             mcn: r.mcn || null,
             avatar_url: r.avatar_url || null,
             added_by: profile?.id
           });
           existingUsernames.add(r.username); // prevent duplicate in same batch
        } else {
           creatorPayloads.push({
             username: r.username,
             mcn: r.mcn || null,
             avatar_url: r.avatar_url || null,
             link_account: `https://www.tiktok.com/@${r.username}`,
             last_updated_by: profile?.id,
             last_updated_at: new Date().toISOString()
           });
        }
      }

      const { data: cData, error: cErr } = await supabase.from('creators').upsert(
        creatorPayloads,
        { onConflict: 'username' }
      ).select('id, username');
      
      if (cErr) throw cErr;
      const cMap = new Map(cData?.map(c => [c.username, c.id]));

      const snapshots = [];
      const contacts = [];
      for (const r of filledRows) {
        const cId = cMap.get(r.username);
        if (!cId) continue;
        
        snapshots.push({
          creator_id: cId,
          followers: parseInt(r.followers) || null,
          tier: r.followers ? getAutoTier(parseInt(r.followers) || 0) : null,
          level: parseInt(r.level) || null,
          audience_age: r.audience_age || null,
          gmv_30d: parseInt(r.gmv_30d) || null,
          ratecard: parseInt(r.ratecard) || null,
          tanggal_update: new Date().toISOString(),
          updated_by: profile?.nama || 'System'
        });

        if (r.whatsapp) {
          contacts.push({
            creator_id: cId,
            nomor: r.whatsapp,
            status: 'aktif',
            created_at: new Date().toISOString()
          });
        }
      }

      if (snapshots.length > 0) {
        await supabase.from('creator_snapshots').insert(snapshots);
      }
      if (contacts.length > 0) {
        const creatorIdsWithContacts = Array.from(new Set(contacts.map(c => c.creator_id)));
        await supabase.from('creator_contacts').delete().in('creator_id', creatorIdsWithContacts);
        await supabase.from('creator_contacts').insert(contacts);
      }

      const typedNiches = new Set(filledRows.map(r => r.niche.trim()).filter(Boolean));
      if (typedNiches.size > 0) {
        const { data: dbNiches } = await supabase.from('niches').select('id, nama');
        const existingNicheNames = new Set((dbNiches || []).map(n => n.nama.toLowerCase()));
        const missingNiches = Array.from(typedNiches).filter(n => !existingNicheNames.has(n.toLowerCase()));
        if (missingNiches.length > 0) {
          await supabase.from('niches').insert(missingNiches.map(name => ({ nama: name })));
        }
        const { data: finalNiches } = await supabase.from('niches').select('id, nama');
        const nicheMap = new Map((finalNiches || []).map(n => [n.nama.toLowerCase(), n.id]));
        const creatorNiches = [];
        for (const r of filledRows) {
           const cId = cMap.get(r.username);
           const nicheName = r.niche.trim().toLowerCase();
           const nId = nicheMap.get(nicheName);
           if (cId && nId) {
             creatorNiches.push({ creator_id: cId, niche_id: nId, peringkat: 1 });
           }
        }
        if (creatorNiches.length > 0) {
          const updatedCreatorIds = Array.from(new Set(creatorNiches.map(cn => cn.creator_id)));
          await supabase.from('creator_niches').delete().in('creator_id', updatedCreatorIds);
          await supabase.from('creator_niches').insert(creatorNiches);
        }
      }
      
      await fetchData();
      localStorage.removeItem(`tnt_import_draft_global`);
      alert("Berhasil menyimpan data kreator!");
      
      const remainingRows = rows.filter(r => r.username.trim() === '' || r.status === 'error');
      if (remainingRows.length < 5) {
        const needed = 5 - remainingRows.length;
        for (let i = 0; i < needed; i++) {
          remainingRows.push(getEmptyRow());
        }
      }
      setRows(remainingRows);
      setStep(1);
    } catch (err: any) {
      alert("Gagal import: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push(`/creator-pool`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Import / Update Kreator Baru</h2>
          <p className="text-sm text-slate-500">Mode Spreadsheet. Auto-saved.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-semibold text-slate-700 w-10">No</th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[150px]">Username <span className="text-red-500">*</span></th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[150px]">No. Whatsapp <span className="text-red-500">*</span></th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[120px]">Followers</th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[100px]">Tier</th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[100px]">Level</th>
                    <th className="p-3 font-semibold text-slate-700 min-w-[120px]">Audiens Age</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 text-left w-32 border-b-2 border-slate-200">GMV 30 Days</th>
                    <th className="px-3 py-3 font-semibold text-rose-600 text-left w-36 border-b-2 border-rose-200">Niche *</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 text-left w-36 border-b-2 border-slate-200">MCN</th>
                    <th className="px-3 py-3 font-semibold text-slate-600 text-left w-32 border-b-2 border-slate-200">Ratecard (Rp)</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${row.status === 'error' ? 'bg-red-50' : ''}`}>
                      <td className="p-2 text-center text-slate-400 font-medium">
                        {idx + 1}
                        {row.status === 'error' && <span title={row.errorMsg}><AlertCircle className="w-4 h-4 text-red-500 inline ml-1" /></span>}
                      </td>
                      <td className="p-2">
                        <input type="text" value={row.username} 
                          onBlur={async (e) => {
                             const val = e.target.value.trim();
                             if (!val) return;
                             const { data: c } = await supabase.from('creators').select('id').eq('username', val).single();
                             if (c) {
                               const newRows = [...rows];
                               let updated = false;

                               if (!row.whatsapp) {
                                 const { data: contact } = await supabase.from('creator_contacts').select('nomor').eq('creator_id', c.id).eq('status', 'aktif').order('id', {ascending: false}).limit(1).single();
                                 if (contact && contact.nomor) {
                                    newRows[idx].whatsapp = contact.nomor;
                                    updated = true;
                                 }
                               }

                               if (!row.ratecard) {
                                 const { data: snap } = await supabase.from('creator_snapshots').select('ratecard').eq('creator_id', c.id).not('ratecard', 'is', null).order('id', {ascending: false}).limit(1).single();
                                 if (snap && snap.ratecard) {
                                    newRows[idx].ratecard = snap.ratecard.toString();
                                    updated = true;
                                 }
                               }

                               if(updated) setRows(newRows);
                             }
                          }}
                          onChange={e => updateRow(row.id, 'username', e.target.value.replace('@', '').toLowerCase())} className="w-full border-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1 rounded" placeholder="username" />
                      </td>
                      <td className="p-2">
                        <input type="text" value={row.whatsapp} onChange={e => updateRow(row.id, 'whatsapp', e.target.value)} className="w-full border-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1 rounded" placeholder="08..." />
                      </td>
                      <td className="p-2">
                        <input type="number" value={row.followers} onChange={e => updateRow(row.id, 'followers', e.target.value)} className="w-full border-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1 rounded" placeholder="10000" />
                      </td>
                      <td className="p-2">
                        <input type="text" value={row.followers ? getAutoTier(parseInt(row.followers) || 0) : ''} readOnly className="w-full border-none bg-transparent p-1 rounded text-slate-400 font-medium cursor-not-allowed" placeholder="Auto" />
                      </td>
                      <td className="p-2">
                        <input type="number" value={row.level} onChange={e => updateRow(row.id, 'level', e.target.value)} className="w-full border-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1 rounded" placeholder="2" />
                      </td>
                      <td className="p-2">
                        <input type="text" value={row.audience_age} onChange={e => updateRow(row.id, 'audience_age', e.target.value)} className="w-full border-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1 rounded" placeholder="18-24" />
                      </td>
                      <td className="p-0 border-r border-slate-200">
                        <input type="number" className="w-full h-full p-2 bg-transparent border-none outline-none" value={row.gmv_30d} onChange={(e) => updateRow(row.id, 'gmv_30d', e.target.value)} placeholder="5000000" />
                      </td>
                      <td className="p-0 border-r border-rose-100 bg-rose-50/30">
                        <input type="text" list="niche-options" className="w-full h-full p-2 bg-transparent border-none outline-none" value={row.niche} onChange={(e) => updateRow(row.id, 'niche', e.target.value)} placeholder="Ketik..." />
                      </td>
                      <td className="p-0 border-r border-slate-200">
                        <input type="text" className="w-full h-full p-2 bg-transparent border-none outline-none" value={row.mcn} onChange={(e) => updateRow(row.id, 'mcn', e.target.value)} placeholder="MCN" />
                      </td>
                      <td className="p-0 border-r border-slate-200">
                        <input type="number" className="w-full h-full p-2 bg-transparent border-none outline-none" value={row.ratecard} onChange={(e) => updateRow(row.id, 'ratecard', e.target.value)} placeholder="150000" />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => setRows(rows.filter(r => r.id !== row.id))} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-slate-50 flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setRows([...rows, getEmptyRow()])}>
                  <Plus className="w-4 h-4 mr-1" /> Tambah Baris
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRows([...rows, ...Array(5).fill(null).map(getEmptyRow)])}>
                  + 5 Baris
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleVerify} disabled={isVerifying} className="bg-indigo-600 hover:bg-indigo-700">
                {isVerifying ? 'Memeriksa...' : 'Verifikasi Data'} <Play className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Verifikasi Selesai</h4>
                  <p className="text-sm mt-1">Silakan periksa kembali status kreator di bawah ini sebelum melakukan Import.</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-semibold text-slate-700">Username</th>
                      <th className="p-3 font-semibold text-slate-700">Followers</th>
                      <th className="p-3 font-semibold text-slate-700">Tier</th>
                      <th className="p-3 font-semibold text-slate-700">No. WhatsApp</th>
                      <th className="p-3 font-semibold text-slate-700">Niche</th>
                      <th className="p-3 font-semibold text-slate-700">Status</th>
                      <th className="p-3 font-semibold text-slate-700">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.filter(r => r.username.trim() !== '').map(row => (
                      <tr key={row.id} className="border-b border-slate-100 last:border-0">
                        <td className="p-3 font-medium text-slate-800">@{row.username}</td>
                        <td className="p-3">{row.followers || '-'}</td>
                        <td className="p-3">{row.followers ? getAutoTier(parseInt(row.followers) || 0) : '-'}</td>
                        <td className="p-3">{row.whatsapp}</td>
                        <td className="p-3">{row.niche}</td>
                        <td className="p-3">
                          {row.status === 'baru' && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">Baru</span>}
                          {row.status === 'update' && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Update Data</span>}
                        </td>
                        <td className="p-3 text-xs text-slate-500">{row.existingInfo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setStep(1)} disabled={isImporting}>
                  Kembali Edit
                </Button>
                <Button onClick={handleImport} disabled={isImporting} className="bg-indigo-600 hover:bg-indigo-700">
                  {isImporting ? 'Menyimpan...' : 'Import Sekarang'} <Save className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <datalist id="niche-options">
        {niches.map(n => (
          <option key={n.id} value={n.nama} />
        ))}
      </datalist>
    </div>
  );
}
