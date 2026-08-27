"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, ArrowRight, Wallet, CheckCircle2, Clock, AlertCircle, Pencil, Check, X } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getPaymentBatches, getBudgetSummary, getPaymentMutations } from "../campaigns/actions/paymentActions";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { MutationTable } from "@/components/MutationTable";

const supabase = createClient();

export default function GlobalBudgetingPage() {
  return (
    <ErrorBoundary>
      <GlobalBudgetingContent />
    </ErrorBoundary>
  );
}

function GlobalBudgetingContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'semua' | 'tindakan' | 'ringkasan' | 'mutasi'>('tindakan');
  const [batches, setBatches] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [mutations, setMutations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Inline edit state
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, sumData, mutData] = await Promise.all([
        getPaymentBatches(),
        getBudgetSummary(),
        getPaymentMutations()
      ]);
      setBatches(data || []);
      setSummaries(sumData || []);
      setMutations(mutData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const startEditing = (campaignId: number, field: string, currentValue: number) => {
    setEditingCell(`${campaignId}_${field}`);
    setEditValue(currentValue.toString());
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async (campaignId: number, field: 'budget_creator_plafon' | 'budget_ads_plafon') => {
    const cellKey = `${campaignId}_${field}`;
    setSavingCell(cellKey);
    try {
      const newValue = Number(editValue.replace(/[^0-9]/g, '') || 0);
      const { error } = await supabase.from('campaigns').update({ [field]: newValue }).eq('id', campaignId);
      if (error) throw error;

      // Update local summaries so sisa recalculates instantly
      setSummaries(prev => prev.map(s => {
        if (s.campaign_id !== campaignId) return s;
        if (field === 'budget_creator_plafon') {
          return { ...s, budget_creator: newValue, sisa_creator: newValue - s.terpakai_creator };
        } else {
          return { ...s, budget_ads: newValue, sisa_ads: newValue - s.terpakai_ads };
        }
      }));
      setEditingCell(null);
      setEditValue('');
    } catch (err: any) {
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setSavingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, campaignId: number, field: 'budget_creator_plafon' | 'budget_ads_plafon') => {
    if (e.key === 'Enter') saveEdit(campaignId, field);
    if (e.key === 'Escape') cancelEditing();
  };

  const getBatchStatusBadge = (status: string) => {
    switch(status) {
      case 'draft': return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase">Draft</span>;
      case 'pending_manager': return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold uppercase">Menunggu Manager</span>;
      case 'pending_finance': return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold uppercase">Menunggu Finance</span>;
      case 'pending_executive': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold uppercase">Menunggu Executive</span>;
      case 'ready_to_pay': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase">Siap Bayar</span>;
      case 'paid': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold uppercase">Paid Off</span>;
      case 'cancelled': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold uppercase">Dibatalkan</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase">{status}</span>;
    }
  }

  const actionStatuses = ['pending_manager', 'pending_finance', 'pending_executive', 'ready_to_pay'];
  const filteredBatches = batches.filter(b => {
    if (activeTab === 'tindakan') {
      return actionStatuses.includes(b.status);
    }
    return true; // semua
  });

  const totalActionNeeded = batches.filter(b => actionStatuses.includes(b.status)).length;
  const totalPaid = batches.filter(b => b.status === 'paid').length;
  const totalAll = batches.length;

  // Inline editable cell component
  const EditableCell = ({ campaignId, field, value }: { campaignId: number, field: 'budget_creator_plafon' | 'budget_ads_plafon', value: number }) => {
    const cellKey = `${campaignId}_${field}`;
    const isEditing = editingCell === cellKey;
    const isSaving = savingCell === cellKey;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1 justify-end">
          <span className="text-xs text-slate-400">Rp</span>
          <input
            type="text"
            autoFocus
            className="w-28 px-2 py-1 text-right text-sm border border-blue-400 rounded outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50"
            value={Number(editValue.replace(/[^0-9]/g, '') || 0).toLocaleString()}
            onChange={e => setEditValue(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => handleKeyDown(e, campaignId, field)}
          />
          <button onClick={() => saveEdit(campaignId, field)} disabled={isSaving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Simpan">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button onClick={cancelEditing} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors" title="Batal">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="group flex items-center gap-1.5 justify-end cursor-pointer" onClick={() => startEditing(campaignId, field, value)}>
        <span>Rp {value.toLocaleString()}</span>
        <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  };

  return (
    <div className="space-y-[24px] pb-[80px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-slate-800">
          <Wallet className="w-8 h-8 text-blue-600" />
          Dashboard Pembayaran Global
        </h1>
        <p className="text-slate-500 mt-1">Pantau seluruh pengajuan pembayaran dari semua campaign di satu tempat.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
        <div className="bg-white border border-blue-100 rounded-xl shadow-sm">
          <div className="p-[24px] flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-[13px] font-medium mb-[4px]">Perlu Tindakan</p>
              <h3 className="text-[28px] font-bold text-slate-800">{totalActionNeeded} <span className="text-sm font-normal text-slate-500">Batch</span></h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-white border border-green-100 rounded-xl shadow-sm">
          <div className="p-[24px] flex justify-between items-start">
            <div>
              <p className="text-slate-500 text-[13px] font-medium mb-[4px]">Sudah Dibayar (Paid)</p>
              <h3 className="text-[28px] font-bold text-slate-800">{totalPaid} <span className="text-sm font-normal text-slate-500">Batch</span></h3>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-green-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 text-white rounded-xl shadow-sm">
          <div className="p-[24px] flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-[13px] font-medium mb-[4px]">Total Pengajuan</p>
              <h3 className="text-[28px] font-bold">{totalAll} <span className="text-sm font-normal text-slate-400">Batch</span></h3>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg text-slate-300">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('tindakan')}
          className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'tindakan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <AlertCircle className="w-4 h-4" /> Perlu Tindakan
          {totalActionNeeded > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{totalActionNeeded}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('semua')}
          className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'semua' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Wallet className="w-4 h-4" /> Semua Ajuan
        </button>
        <button
          onClick={() => setActiveTab('ringkasan')}
          className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ringkasan' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Wallet className="w-4 h-4" /> Ringkasan Budget
        </button>
        <button
          onClick={() => setActiveTab('mutasi')}
          className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'mutasi' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Wallet className="w-4 h-4" /> Mutasi Pembayaran
        </button>
      </div>

      {activeTab === 'mutasi' ? (
        <MutationTable mutations={mutations} />
      ) : activeTab !== 'ringkasan' ? (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-4 text-center w-12">No</th>
                <th className="px-4 py-4">Campaign</th>
                <th className="px-4 py-4">Batch Label</th>
                <th className="px-4 py-4">PIC Submit</th>
                <th className="px-4 py-4 text-center">Jml Item</th>
                <th className="px-4 py-4 text-right">Total Nominal</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-4 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <p className="mt-2 text-slate-500">Memuat data...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="h-48 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center h-full">
                      <CheckCircle2 className="w-12 h-12 text-emerald-200 mb-2" />
                      Tidak ada data batch yang sesuai.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b, idx) => {
                  const totalItem = b.payment_items?.length || 0;
                  const totalNominal = b.payment_items?.reduce((acc: number, cur: any) => acc + Number(cur.nominal) + Number(cur.biaya_transfer), 0) || 0;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{b.campaigns?.nama || 'Unknown Campaign'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {b.batch_label}
                        <div className="text-xs font-normal text-slate-400">
                          {new Date(b.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-600">{b.submitter?.nama}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-600">{totalItem}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">Rp {totalNominal.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">{getBatchStatusBadge(b.status)}</td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => router.push(`/campaigns/${b.campaign_id}/keuangan`)} 
                          className="text-blue-600 hover:text-blue-800 font-semibold text-xs flex items-center justify-center gap-1 mx-auto bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
                        >
                          Lihat Detail <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">No</th>
                  <th className="px-4 py-4">Campaign</th>
                  <th className="px-4 py-4 text-right">Plafon Creator <Pencil className="w-3 h-3 inline ml-1 text-slate-300" /></th>
                  <th className="px-4 py-4 text-right">Terpakai Creator</th>
                  <th className="px-4 py-4 text-right">Sisa Creator</th>
                  <th className="px-4 py-4 text-right">Plafon Ads <Pencil className="w-3 h-3 inline ml-1 text-slate-300" /></th>
                  <th className="px-4 py-4 text-right">Terpakai Ads</th>
                  <th className="px-4 py-4 text-right">Sisa Ads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <p className="mt-2 text-slate-500">Memuat data...</p>
                      </div>
                    </td>
                  </tr>
                ) : summaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-48 text-center text-slate-500">
                      Tidak ada data ringkasan budget.
                    </td>
                  </tr>
                ) : (
                  summaries.map((sum, idx) => (
                    <tr key={sum.campaign_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{sum.campaign_nama}</td>
                      <td className="px-4 py-3 text-right">
                        <EditableCell campaignId={sum.campaign_id} field="budget_creator_plafon" value={sum.budget_creator} />
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">Rp {sum.terpakai_creator.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">Rp {sum.sisa_creator.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <EditableCell campaignId={sum.campaign_id} field="budget_ads_plafon" value={sum.budget_ads} />
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">Rp {sum.terpakai_ads.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">Rp {sum.sisa_ads.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
