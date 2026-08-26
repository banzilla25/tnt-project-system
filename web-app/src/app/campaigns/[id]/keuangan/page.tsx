"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Loader2, Plus, ArrowRight, Wallet, Activity, CheckCircle2, Search, X, Check, Trash2, Pencil, StickyNote } from "lucide-react";
import { useParams } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { BatchForm } from "./BatchForm";
import { BatchDetail } from "./BatchDetail";
import { getPaymentBatches, getPaymentBatchDetail } from "../../actions/paymentActions";

const supabase = createClient();

type ViewState = 'list' | 'form' | 'detail';

type AdsEntry = {
  id: number;
  campaign_id: number;
  detail: string;
  nominal: number;
  status_bayar: 'not_yet' | 'half_paid' | 'pay_off' | 'no_payment';
  tanggal: string;
  notes: string | null;
  last_updated_at?: string | null;
  last_updated_by_profile_name?: string | null;
};

export default function CampaignKeuanganPage() {
  return (
    <ErrorBoundary>
      <CampaignKeuanganContent />
    </ErrorBoundary>
  );
}

function CampaignKeuanganContent() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaigns } = useDatabaseStore();
  const campaign = campaigns.find(c => c.id === campaignId);
  const { canEditCampaign, profile } = useAuth();
  const hasAccess = canEditCampaign(campaignId);

  // View state for Creator Tab
  const [viewState, setViewState] = useState<ViewState>('list');
  const [activeTab, setActiveTab] = useState<'creator' | 'ads'>('creator');
  
  // Batch Data
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);

  // Creators Data for Form
  const [creators, setCreators] = useState<any[]>([]);
  
  // KPI Data
  const [totalTerpakai, setTotalTerpakai] = useState(0);

  // ===================== ADS STATE =====================
  const [adsEntries, setAdsEntries] = useState<AdsEntry[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [editingAdsId, setEditingAdsId] = useState<number | null>(null);
  const [adsEditForm, setAdsEditForm] = useState<Partial<AdsEntry>>({});

  // Form for new ads entry
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAds, setNewAds] = useState({ detail: '', nominal: '', status_bayar: 'not_yet', tanggal: '', notes: '' });
  const [addingAds, setAddingAds] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      // Fetch batches
      const data = await getPaymentBatches(campaignId);
      setBatches(data || []);
      
      // Calculate Total Terpakai
      let terpakai = 0;
      data?.forEach(b => {
        b.payment_items?.forEach((item: any) => {
          if (item.final_status === 'paid' && item.payment_type !== 'ads') {
            terpakai += Number(item.nominal) + Number(item.biaya_transfer);
          }
        });
      });
      setTotalTerpakai(terpakai);

      // Fetch approved creators for form
      const { data: ccData } = await supabase
        .from('campaign_creators')
        .select(`*, creators(username)`)
        .eq('campaign_id', campaignId)
        .eq('approval', 'approved');
      setCreators(ccData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingBatches(false);
    }
  }, [campaignId]);

  const fetchAdsData = useCallback(async () => {
    setAdsLoading(true);
    const { data } = await supabase
      .from('ads_spends')
      .select('*, last_updated_by_profile_name:profiles!ads_spends_last_updated_by_fkey(nama)')
      .eq('campaign_id', campaignId)
      .order('tanggal', { ascending: false });
    setAdsEntries((data as unknown as AdsEntry[]) || []);
    setAdsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) {
      fetchData();
      fetchAdsData();
    }
  }, [campaignId, fetchData, fetchAdsData]);

  // ===================== ADS HANDLERS =====================
  const handleAddAds = async () => {
    if (!newAds.detail || !newAds.nominal) return;
    setAddingAds(true);
    const { error } = await supabase.from('ads_spends').insert({
      campaign_id: campaignId,
      detail: newAds.detail,
      nominal: Number(newAds.nominal.replace(/[^0-9]/g, '')),
      status_bayar: newAds.status_bayar,
      tanggal: newAds.tanggal || new Date().toISOString().split('T')[0],
      notes: newAds.notes || null,
      last_updated_by: profile?.id,
      last_updated_at: new Date().toISOString()
    });
    if (!error) {
      setNewAds({ detail: '', nominal: '', status_bayar: 'not_yet', tanggal: '', notes: '' });
      setShowAddForm(false);
      await fetchAdsData();
    } else {
      alert('Gagal menambah: ' + error.message);
    }
    setAddingAds(false);
  };

  const handleEditAds = (entry: AdsEntry) => {
    setEditingAdsId(entry.id);
    setAdsEditForm({ ...entry });
  };

  const handleSaveAds = async (id: number) => {
    const { error } = await supabase.from('ads_spends').update({
      detail: adsEditForm.detail,
      nominal: Number(String(adsEditForm.nominal || '0').replace(/[^0-9]/g, '')),
      status_bayar: adsEditForm.status_bayar,
      tanggal: adsEditForm.tanggal,
      notes: adsEditForm.notes || null,
      last_updated_by: profile?.id,
      last_updated_at: new Date().toISOString()
    }).eq('id', id);
    if (!error) {
      setEditingAdsId(null);
      await fetchAdsData();
    } else {
      alert('Gagal menyimpan: ' + error.message);
    }
  };

  const handleDeleteAds = async (id: number) => {
    if (!confirm('Yakin ingin menghapus entri ini?')) return;
    await supabase.from('ads_spends').delete().eq('id', id);
    await fetchAdsData();
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pay_off': return 'bg-green-100 text-green-800 border-green-300';
      case 'half_paid': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'not_yet': return 'bg-red-50 text-red-700 border-red-200';
      case 'no_payment': return 'bg-slate-800 text-white border-slate-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pay_off': return 'Paid Off';
      case 'half_paid': return 'Half Paid';
      case 'not_yet': return 'Not Yet';
      case 'no_payment': return 'No Payment';
      default: return status;
    }
  };

  const handleViewDetail = async (batchId: number) => {
    setViewState('detail');
    const detail = await getPaymentBatchDetail(batchId);
    setSelectedBatch(detail);
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

  if (!campaign) return null;

  const budgetPlafon = Number(campaign.budget_creator_plafon || 0);
  const sisaBudget = budgetPlafon - totalTerpakai;
  const progressPercent = budgetPlafon > 0 ? Math.min((totalTerpakai / budgetPlafon) * 100, 100) : 0;

  // ===================== ADS CALCULATIONS =====================
  const adsBudgetPlafon = Number(campaign.budget_ads_plafon || 0);
  const adsTerpakai = adsEntries.filter(a => a.status_bayar === 'pay_off').reduce((sum, a) => sum + Number(a.nominal), 0);
  const adsSisa = adsBudgetPlafon - adsTerpakai;

  return (
    <div className="space-y-[24px] pb-[80px]">
      {/* TAB SWITCHER */}
      {viewState === 'list' && (
        <div className="flex border-b border-line">
          <button
            onClick={() => setActiveTab('creator')}
            className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors ${activeTab === 'creator' ? 'border-blue-600 text-blue-600' : 'border-transparent text-text-soft hover:text-text'}`}
          >
            💰 Budget Creator
          </button>
          <button
            onClick={() => setActiveTab('ads')}
            className={`px-[24px] py-[12px] text-[13px] font-semibold border-b-2 transition-colors ${activeTab === 'ads' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-text-soft hover:text-text'}`}
          >
            📢 Budget Ads
          </button>
        </div>
      )}

      {/* ===================== CREATOR TAB ===================== */}
      {activeTab === 'creator' && (
        <div className="space-y-[24px]">
          {viewState === 'list' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[24px]">
                <div className="bg-slate-900 rounded-xl p-6 text-white shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-400 text-[13px] font-medium mb-[4px]">Budget Plafon Creator</p>
                      <h3 className="text-[24px] font-bold">Rp {budgetPlafon.toLocaleString()}</h3>
                    </div>
                    <Wallet className="w-8 h-8 text-slate-700" />
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-500 text-[13px] font-medium mb-[4px]">Total Terpakai (Paid)</p>
                      <h3 className="text-[24px] font-bold text-slate-800">Rp {totalTerpakai.toLocaleString()}</h3>
                    </div>
                    <Activity className="w-8 h-8 text-slate-300" />
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-emerald-600 text-[13px] font-medium mb-[4px]">Sisa Budget</p>
                      <h3 className="text-[24px] font-bold text-emerald-700">Rp {sisaBudget.toLocaleString()}</h3>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-emerald-200" />
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-slate-500">Persentase Terpakai</span>
                    <span className="text-xs font-bold text-slate-700">{progressPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-800">Daftar Batch Pembayaran</h3>
                  {hasAccess && (
                    <button 
                      onClick={() => setViewState('form')}
                      className="btn btn-primary flex items-center gap-2 text-sm px-4 py-2"
                    >
                      <Plus className="w-4 h-4" /> Ajukan Pembayaran Baru
                    </button>
                  )}
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium">
                      <tr>
                        <th className="px-4 py-3 text-center w-12">No</th>
                        <th className="px-4 py-3">Batch Label</th>
                        <th className="px-4 py-3">PIC Submit</th>
                        <th className="px-4 py-3 text-center">Status Kreator</th>
                        <th className="px-4 py-3 text-right">Total Nominal</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {isLoadingBatches ? (
                        <tr><td colSpan={7} className="h-32 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></td></tr>
                      ) : batches.length === 0 ? (
                        <tr><td colSpan={7} className="h-32 text-center text-slate-500">Belum ada batch pembayaran yang diajukan.</td></tr>
                      ) : (
                        batches.map((b, idx) => {
                          const totalItem = b.payment_items?.length || 0;
                          const totalDibayar = b.payment_items?.filter((i: any) => i.final_status === 'paid').length || 0;
                          const totalDitolak = b.payment_items?.filter((i: any) => i.final_status === 'rejected').length || 0;
                          const totalNominal = b.payment_items?.reduce((acc: number, cur: any) => acc + Number(cur.nominal) + Number(cur.biaya_transfer), 0) || 0;
                          return (
                            <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 text-center text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-3 font-semibold text-slate-700">{b.batch_label}
                                <div className="text-xs font-normal text-slate-400">{new Date(b.created_at).toLocaleDateString('id-ID')}</div>
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-600">{b.submitter?.nama}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1 items-center text-[10px] w-24 mx-auto">
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold w-full text-center">Diajukan: {totalItem}</span>
                                  {totalDibayar > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold w-full text-center">Dibayar: {totalDibayar}</span>}
                                  {totalDitolak > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold w-full text-center">Ditolak: {totalDitolak}</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-700">Rp {totalNominal.toLocaleString()}</td>
                              <td className="px-4 py-3 text-center">{getBatchStatusBadge(b.status)}</td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => handleViewDetail(b.id)} className="text-blue-600 hover:text-blue-800 font-semibold text-xs flex items-center justify-center gap-1 mx-auto bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
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
            </>
          )}

          {viewState === 'form' && (
            <BatchForm 
              campaignId={campaignId} 
              creators={creators} 
              onCancel={() => setViewState('list')} 
              onSuccess={() => { setViewState('list'); fetchData(); }} 
            />
          )}

          {viewState === 'detail' && selectedBatch && (
            <BatchDetail 
              batch={selectedBatch} 
              onBack={() => { setViewState('list'); setSelectedBatch(null); }} 
              onRefresh={async () => {
                const detail = await getPaymentBatchDetail(selectedBatch.id);
                setSelectedBatch(detail);
                fetchData();
              }} 
            />
          )}
        </div>
      )}

      {/* ===================== ADS TAB ===================== */}
      {activeTab === 'ads' && viewState === 'list' && (
        <div className="space-y-[24px]">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
            <div className="ccard bg-slate-900 text-white !border-slate-800">
              <div className="p-[24px]">
                <p className="text-slate-400 text-[13px] font-medium mb-[4px]">Total Budget ADS (Plafon)</p>
                <h3 className="text-[24px] font-bold">Rp {adsBudgetPlafon.toLocaleString()}</h3>
              </div>
            </div>
            <div className="ccard bg-orange-50 border-orange-100">
              <div className="p-[24px]">
                <p className="text-orange-600 text-[13px] font-medium mb-[4px]">Total ADS Terpakai</p>
                <h3 className="text-[24px] font-bold text-orange-900">Rp {adsTerpakai.toLocaleString()}</h3>
                <p className="text-[11px] text-orange-400 mt-[4px]">Hanya yang berstatus Paid Off</p>
              </div>
            </div>
            <div className={`ccard ${adsSisa < 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
              <div className="p-[24px]">
                <p className={`text-[13px] font-medium mb-[4px] ${adsSisa < 0 ? 'text-red-600' : 'text-green-600'}`}>Sisa Budget ADS</p>
                <h3 className={`text-[24px] font-bold ${adsSisa < 0 ? 'text-red-900' : 'text-green-900'}`}>Rp {adsSisa.toLocaleString()}</h3>
                <p className={`text-[11px] mt-[4px] ${adsSisa < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {adsSisa < 0 ? '⚠️ Melebihi plafon!' : 'Plafon dikurangi Terpakai'}
                </p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="ccard overflow-hidden !p-0">
            <div className="p-[16px] border-b border-line flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-text">Riwayat Top-Up & Pengeluaran Ads</h3>
              {hasAccess && (
                <button onClick={() => setShowAddForm(v => !v)} className="btn btn-outline flex items-center gap-[8px] !py-[6px]">
                  {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showAddForm ? 'Batal' : 'Tambah Entri'}
                </button>
              )}
            </div>

            {/* Add Form */}
            {showAddForm && (
              <div className="p-[16px] bg-indigo-50/50 border-b border-indigo-100">
                <p className="text-[13px] font-semibold text-indigo-700 mb-[12px]">➕ Tambah Entri Baru</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-[12px]">
                  <div className="lg:col-span-2">
                    <label className="text-[11px] font-semibold text-text-soft mb-[4px] block">Detail Ads *</label>
                    <input type="text" className="input w-full" placeholder="Contoh: Top Up Ads VSA" value={newAds.detail} onChange={e => setNewAds(p => ({ ...p, detail: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-text-soft mb-[4px] block">Nominal (Rp) *</label>
                    <input type="text" className="input w-full" placeholder="10000000" value={newAds.nominal} onChange={e => setNewAds(p => ({ ...p, nominal: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-text-soft mb-[4px] block">Status Bayar</label>
                    <select className={`input w-full font-semibold ${getStatusStyle(newAds.status_bayar)}`} value={newAds.status_bayar} onChange={e => setNewAds(p => ({ ...p, status_bayar: e.target.value as any }))}>
                      <option value="not_yet">Not Yet</option>
                      <option value="half_paid">Half Paid</option>
                      <option value="pay_off">Paid Off</option>
                      <option value="no_payment">No Payment</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-text-soft mb-[4px] block">Tanggal</label>
                    <input type="date" className="input w-full" value={newAds.tanggal} onChange={e => setNewAds(p => ({ ...p, tanggal: e.target.value }))} />
                  </div>
                  <div className="lg:col-span-4">
                    <label className="text-[11px] font-semibold text-text-soft mb-[4px] flex items-center gap-[4px]"><StickyNote className="w-3 h-3" /> Notes (Opsional)</label>
                    <input type="text" className="input w-full" placeholder="Tambahkan catatan jika perlu..." value={newAds.notes} onChange={e => setNewAds(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                  <div className="flex items-end">
                    <button className="btn btn-primary w-full flex justify-center items-center" onClick={handleAddAds} disabled={addingAds || !newAds.detail || !newAds.nominal}>
                      {addingAds ? <Loader2 className="w-4 h-4 animate-spin mr-[8px]" /> : <Check className="w-4 h-4 mr-[8px]" />}
                      Simpan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Ads Table */}
            <div className="tbl-wrap !border-0 !rounded-none">
              <table className="w-full">
                <thead className="border-b border-line">
                  <tr>
                    <th className="w-10 text-center py-[16px]">No</th>
                    <th className="py-[16px]">Detail Ads</th>
                    <th className="text-right py-[16px]">Nominal</th>
                    <th className="w-36 py-[16px]">Status Bayar</th>
                    <th className="w-36 py-[16px]">Tanggal</th>
                    <th className="py-[16px]">Notes</th>
                    <th className="w-24 text-center py-[16px]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {adsLoading ? (
                    <tr><td colSpan={7} className="h-24 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-text-soft" /></td></tr>
                  ) : adsEntries.length === 0 ? (
                    <tr><td colSpan={7} className="h-24 text-center text-text-soft">Belum ada entri. Klik "Tambah Entri" untuk memulai.</td></tr>
                  ) : (
                    adsEntries.map((entry, idx) => (
                      <tr key={entry.id} className={`hover:bg-slate-50/50 border-b border-line ${entry.status_bayar === 'pay_off' ? 'bg-green-50/30' : ''}`}>
                        <td className="text-center text-text-soft">{idx + 1}</td>
                        <td>
                          {editingAdsId === entry.id
                            ? <input className="input w-full !py-[6px]" value={adsEditForm.detail || ''} onChange={e => setAdsEditForm(p => ({ ...p, detail: e.target.value }))} />
                            : <span className="font-medium">{entry.detail}</span>}
                        </td>
                        <td className="text-right">
                          {editingAdsId === entry.id
                            ? <input type="text" className="input w-full text-right !py-[6px]" value={adsEditForm.nominal || ''} onChange={e => setAdsEditForm(p => ({ ...p, nominal: Number(e.target.value) }))} />
                            : <span className="font-bold">Rp {Number(entry.nominal).toLocaleString()}</span>}
                        </td>
                        <td>
                          {editingAdsId === entry.id
                            ? <select className={`input w-full font-semibold !py-[6px] ${getStatusStyle(adsEditForm.status_bayar || '')}`} value={adsEditForm.status_bayar || ''} onChange={e => setAdsEditForm(p => ({ ...p, status_bayar: e.target.value as any }))}>
                                <option value="not_yet">Not Yet</option>
                                <option value="half_paid">Half Paid</option>
                                <option value="pay_off">Paid Off</option>
                                <option value="no_payment">No Payment</option>
                              </select>
                            : <span className={`px-[8px] py-[4px] rounded-full text-[11px] font-bold border ${getStatusStyle(entry.status_bayar)}`}>{getStatusLabel(entry.status_bayar)}</span>}
                        </td>
                        <td>
                          {editingAdsId === entry.id
                            ? <input type="date" className="input w-full !py-[6px]" value={adsEditForm.tanggal || ''} onChange={e => setAdsEditForm(p => ({ ...p, tanggal: e.target.value }))} />
                            : <span className="text-text-soft">{entry.tanggal ? new Date(entry.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</span>}
                        </td>
                        <td>
                          {editingAdsId === entry.id
                            ? <input className="input w-full !py-[6px]" placeholder="Notes..." value={adsEditForm.notes || ''} onChange={e => setAdsEditForm(p => ({ ...p, notes: e.target.value }))} />
                            : <span className="text-text-soft text-[13px] italic">{entry.notes || '-'}</span>}
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-[4px]">
                            {editingAdsId === entry.id ? (
                              <>
                                <button onClick={() => handleSaveAds(entry.id)} className="p-[6px] rounded-[6px] hover:bg-green-100 text-green-600" title="Simpan"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditingAdsId(null)} className="p-[6px] rounded-[6px] hover:bg-slate-100 text-text-soft" title="Batal"><X className="w-4 h-4" /></button>
                              </>
                            ) : hasAccess ? (
                              <>
                                <button onClick={() => handleEditAds(entry)} className="p-[6px] rounded-[6px] hover:bg-blue-100 text-blue-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteAds(entry.id)} className="p-[6px] rounded-[6px] hover:bg-red-100 text-red-500" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                              </>
                            ) : null}
                          </div>
                          {entry.last_updated_at && editingAdsId !== entry.id && (
                            <div className="text-[10px] text-text-soft mt-[8px] text-center leading-tight">
                              Diupdate:<br/>
                              <span className="font-semibold">{entry.last_updated_by_profile_name || 'Sistem'}</span><br/>
                              {new Date(entry.last_updated_at).toLocaleDateString('id-ID')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
