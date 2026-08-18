"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Loader2, Plus, Trash2, CheckCircle2 } from "lucide-react";

const supabase = createClient();

export default function CampaignConceptsPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { profile } = useAuth();
  const { skus } = useDatabaseStore();
  
  const campaignSkus = skus.filter(s => s.campaign_id === campaignId);
  const isManager = profile?.role === 'manager';

  const [concepts, setConcepts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchConcepts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('campaign_concepts')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('no_konsep', { ascending: true });
    
    if (error) {
      console.error("Error fetching concepts:", error);
    } else {
      setConcepts(data || []);
    }
    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    fetchConcepts();
  }, [fetchConcepts]);

  const handleAddConcept = async () => {
    if (!isManager) return;
    const nextNo = concepts.length > 0 ? Math.max(...concepts.map(c => c.no_konsep)) + 1 : 1;
    
    const newConcept = {
      campaign_id: campaignId,
      no_konsep: nextNo,
      judul_konsep: `Konsep ${nextNo}`,
      status_approval: 'pending',
      updated_by: profile?.nama,
    };

    const { data, error } = await supabase.from('campaign_concepts').insert([newConcept]).select();
    if (!error && data) {
      setConcepts([...concepts, data[0]]);
    }
  };

  const handleUpdateConcept = async (conceptId: number, field: string, value: any) => {
    if (!isManager) return;
    setSavingId(conceptId);
    
    // Optimistic update
    setConcepts(prev => prev.map(c => c.id === conceptId ? { ...c, [field]: value } : c));

    const payload = { 
      [field]: value,
      updated_by: profile?.nama,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('campaign_concepts')
      .update(payload)
      .eq('id', conceptId);

    if (error) {
      console.error("Error updating concept:", error);
      // Revert if error (simple reload for now)
      fetchConcepts();
    }
    setSavingId(null);
  };

  const handleDeleteConcept = async (conceptId: number) => {
    if (!isManager) return;
    if (!confirm("Yakin ingin menghapus konsep ini?")) return;
    
    setConcepts(prev => prev.filter(c => c.id !== conceptId));
    await supabase.from('campaign_concepts').delete().eq('id', conceptId);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-p300" /></div>;
  }

  return (
    <div className="bg-white rounded-xl border border-line shadow-sm overflow-hidden">
      <div className="p-4 border-b border-line flex justify-between items-center bg-slate-50">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Master Konsep (Brief)</h2>
          <p className="text-sm text-slate-500">Buat dan kelola detail konsep video untuk campaign ini. Hanya Manager yang dapat melakukan edit dan approval.</p>
        </div>
        {isManager && (
          <button onClick={handleAddConcept} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Tambah Konsep
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-line">
            <tr>
              <th className="px-4 py-3 min-w-[60px] text-center">No. Konsep</th>
              <th className="px-4 py-3 min-w-[150px]">Product</th>
              <th className="px-4 py-3 min-w-[200px]">Judul Concept</th>
              <th className="px-4 py-3 min-w-[120px]">Tier Konsep</th>
              <th className="px-4 py-3 min-w-[250px]">Hook</th>
              <th className="px-4 py-3 min-w-[250px]">Fitur / USP</th>
              <th className="px-4 py-3 min-w-[250px]">CTA</th>
              <th className="px-4 py-3 min-w-[150px]">Status Approval</th>
              <th className="px-4 py-3 min-w-[250px]">Notes Revisi</th>
              {isManager && <th className="px-4 py-3 min-w-[60px] text-center">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {concepts.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                  Belum ada master konsep yang dibuat.
                </td>
              </tr>
            ) : (
              concepts.map((concept) => (
                <tr key={concept.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3 text-center">
                    {isManager ? (
                      <input 
                        type="number" 
                        className="input w-16 text-center !p-1.5 font-bold text-slate-700" 
                        defaultValue={concept.no_konsep}
                        onBlur={(e) => handleUpdateConcept(concept.id, 'no_konsep', Number(e.target.value))}
                      />
                    ) : (
                      <span className="font-bold text-slate-700">{concept.no_konsep}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isManager ? (
                      <select 
                        className="select !p-1.5 w-full"
                        defaultValue={concept.sku_id || ''}
                        onChange={(e) => handleUpdateConcept(concept.id, 'sku_id', e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">-- Tanpa Produk --</option>
                        {campaignSkus.map(sku => (
                          <option key={sku.id} value={sku.id}>{sku.nama_produk}</option>
                        ))}
                      </select>
                    ) : (
                      <span>{campaignSkus.find(s => s.id === concept.sku_id)?.nama_produk || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isManager ? (
                      <textarea 
                        className="input w-full !p-2 min-h-[60px] text-sm" 
                        defaultValue={concept.judul_konsep || ''}
                        onBlur={(e) => handleUpdateConcept(concept.id, 'judul_konsep', e.target.value)}
                        placeholder="Contoh: Smooth Skin for Better Makeup"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">{concept.judul_konsep}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isManager ? (
                      <select 
                        className="select !p-1.5 w-full"
                        defaultValue={concept.tier || ''}
                        onChange={(e) => handleUpdateConcept(concept.id, 'tier', e.target.value)}
                      >
                        <option value="">-- Pilih Tier --</option>
                        <option value="TOFU">TOFU</option>
                        <option value="MOFU">MOFU</option>
                        <option value="BOFU">BOFU</option>
                      </select>
                    ) : (
                      <span className="badge b-neutral">{concept.tier || '-'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isManager ? (
                      <textarea 
                        className="input w-full !p-2 min-h-[80px] text-sm leading-relaxed" 
                        defaultValue={concept.hook || ''}
                        onBlur={(e) => handleUpdateConcept(concept.id, 'hook', e.target.value)}
                        placeholder="Makeup sering pecah? Ini penyebabnya..."
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-slate-700">{concept.hook}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isManager ? (
                      <textarea 
                        className="input w-full !p-2 min-h-[80px] text-sm leading-relaxed" 
                        defaultValue={concept.fitur_usp || ''}
                        onBlur={(e) => handleUpdateConcept(concept.id, 'fitur_usp', e.target.value)}
                        placeholder="Highlight sel kulit mati penyebab makeup ga nempel..."
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-slate-700">{concept.fitur_usp}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isManager ? (
                      <textarea 
                        className="input w-full !p-2 min-h-[80px] text-sm leading-relaxed" 
                        defaultValue={concept.cta || ''}
                        onBlur={(e) => handleUpdateConcept(concept.id, 'cta', e.target.value)}
                        placeholder="Langsung checkout di keranjang kuning..."
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-slate-700">{concept.cta}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isManager ? (
                      <select 
                        className={`select !p-1.5 w-full font-semibold ${concept.status_approval === 'approved' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : concept.status_approval === 'revisi' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-600'}`}
                        defaultValue={concept.status_approval || 'pending'}
                        onChange={(e) => handleUpdateConcept(concept.id, 'status_approval', e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="revisi">Revisi</option>
                      </select>
                    ) : (
                      <span className={`badge ${concept.status_approval === 'approved' ? 'b-success' : concept.status_approval === 'revisi' ? 'b-warning' : 'b-neutral'}`}>
                        {concept.status_approval}
                      </span>
                    )}
                    {concept.updated_by && (
                      <div className="mt-1 text-[10px] text-slate-400 leading-tight">
                        Oleh: {concept.updated_by}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isManager ? (
                      <textarea 
                        className="input w-full !p-2 min-h-[60px] text-sm text-red-700 bg-red-50/50" 
                        defaultValue={concept.notes || ''}
                        onBlur={(e) => handleUpdateConcept(concept.id, 'notes', e.target.value)}
                        placeholder="Notes revisi untuk PIC..."
                      />
                    ) : (
                      <div className="whitespace-pre-wrap text-red-600 text-xs italic">{concept.notes}</div>
                    )}
                  </td>
                  {isManager && (
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => handleDeleteConcept(concept.id)} 
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"
                        title="Hapus Konsep"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {savingId === concept.id && <Loader2 className="w-3 h-3 animate-spin text-p300 mx-auto mt-2" />}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Auto-Save Toast Banner */}
      {savingId !== null && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-none animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-slate-900/90 backdrop-blur-sm text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700/50">
            <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
            <span className="text-sm font-medium tracking-wide">Menyimpan perubahan ke database...</span>
          </div>
        </div>
      )}
    </div>
  );
}
