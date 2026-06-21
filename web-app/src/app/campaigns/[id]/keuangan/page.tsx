"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Loader2, Save, Search, ArrowUp, ArrowDown, ArrowUpDown, Plus, Trash2, Pencil, X, Check, StickyNote } from "lucide-react";
import { useParams } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/providers/AuthProvider";

const supabase = createClient();

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

  // Tab state
  const [activeTab, setActiveTab] = useState<'creator' | 'ads'>('creator');

  // ===================== CREATOR STATE =====================
  const [creators, setCreators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [editForms, setEditForms] = useState<Record<number, { price: string; nominal_pelunasan: string; status_bayar: string; tgl_pembayaran: string }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: '', dir: 'asc' });

  // ===================== ADS STATE =====================
  const [adsEntries, setAdsEntries] = useState<AdsEntry[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [editingAdsId, setEditingAdsId] = useState<number | null>(null);
  const [adsEditForm, setAdsEditForm] = useState<Partial<AdsEntry>>({});

  // Form for new ads entry
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAds, setNewAds] = useState({ detail: '', nominal: '', status_bayar: 'not_yet', tanggal: '', notes: '' });
  const [addingAds, setAddingAds] = useState(false);

  const toggleSort = (key: string) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig.key !== col) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline text-slate-400" />;
    return sortConfig.dir === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 ml-1 inline text-blue-600" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1 inline text-blue-600" />;
  };

  // ===================== CREATOR DATA =====================
  const fetchCreatorData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_creators')
        .select(`id, price, status_bayar, nominal_pelunasan, tgl_pembayaran, payment_updated_at, payment_updated_by_profile:profiles!campaign_creators_payment_updated_by_fkey(nama), creators ( username )`)
        .eq('campaign_id', campaignId)
        .eq('approval', 'approved');
      if (error) throw error;
      setCreators(data || []);
      const forms: Record<number, any> = {};
      (data || []).forEach(cc => {
        forms[cc.id] = {
          price: cc.price?.toString() || '0',
          nominal_pelunasan: cc.nominal_pelunasan?.toString() || '0',
          status_bayar: cc.status_bayar || 'belum',
          tgl_pembayaran: cc.tgl_pembayaran || ''
        };
      });
      setEditForms(forms);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  // ===================== ADS DATA =====================
  const fetchAdsData = useCallback(async () => {
    setAdsLoading(true);
    const { data } = await supabase
      .from('ads_spends')
      .select('*, last_updated_by_profile:profiles!ads_spends_last_updated_by_fkey(nama)')
      .eq('campaign_id', campaignId)
      .order('tanggal', { ascending: false });
    setAdsEntries(data || []);
    setAdsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) {
      fetchCreatorData();
      fetchAdsData();
    }
  }, [campaignId, fetchCreatorData, fetchAdsData]);

  // ===================== CREATOR HANDLERS =====================
  const handleFormChange = (ccId: number, field: string, value: string) => {
    setEditForms(prev => ({ ...prev, [ccId]: { ...prev[ccId], [field]: value } }));
  };

  const handleSave = async (ccId: number) => {
    setSaving(prev => ({ ...prev, [ccId]: true }));
    try {
      const form = editForms[ccId];
      const nominal = form.nominal_pelunasan ? parseInt(form.nominal_pelunasan.replace(/[^0-9]/g, '')) : 0;
      const price = form.price ? parseInt(form.price.replace(/[^0-9]/g, '')) : 0;
      const { error } = await supabase
        .from('campaign_creators')
        .update({ 
          price, 
          status_bayar: form.status_bayar as any, 
          nominal_pelunasan: nominal, 
          tgl_pembayaran: form.tgl_pembayaran || null,
          payment_updated_by: profile?.id,
          payment_updated_at: new Date().toISOString()
        })
        .eq('id', ccId);
      if (error) throw error;
      setCreators(prev => prev.map(c => c.id === ccId ? { ...c, price, status_bayar: form.status_bayar, nominal_pelunasan: nominal, tgl_pembayaran: form.tgl_pembayaran } : c));
      alert('Berhasil disimpan');
    } catch (err) {
      alert('Gagal menyimpan');
    } finally {
      setSaving(prev => ({ ...prev, [ccId]: false }));
      await fetchCreatorData();
    }
  };

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

  if (!campaign) return null;

  // ===================== CREATOR CALCULATIONS =====================
  const budgetPlafon = Number(campaign.budget_creator_plafon || 0);
  const totalRatecard = creators.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
  const sisaBudgetCampaign = budgetPlafon - totalRatecard;
  const totalPelunasan = creators.reduce((sum, c) => sum + (Number(c.nominal_pelunasan) || 0), 0);
  const sisaBelumTerbayar = totalRatecard - totalPelunasan;

  const filteredCreators = creators.filter(cc => !searchQuery || cc.creators?.username?.toLowerCase().includes(searchQuery.toLowerCase()));
  const sortedCreators = [...filteredCreators].sort((a, b) => {
    if (!sortConfig.key) return 0;
    if (sortConfig.key === 'username') {
      const vA = a.creators?.username ?? '', vB = b.creators?.username ?? '';
      return sortConfig.dir === 'asc' ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA));
    }
    const vA = Number(sortConfig.key === 'price' ? a.price : a.nominal_pelunasan) || 0;
    const vB = Number(sortConfig.key === 'price' ? b.price : b.nominal_pelunasan) || 0;
    return sortConfig.dir === 'asc' ? vA - vB : vB - vA;
  });

  // ===================== ADS CALCULATIONS =====================
  const adsBudgetPlafon = Number(campaign.budget_ads_plafon || 0);
  const adsTerpakai = adsEntries.filter(a => a.status_bayar === 'pay_off').reduce((sum, a) => sum + Number(a.nominal), 0);
  const adsSisa = adsBudgetPlafon - adsTerpakai;

  return (
    <div className="space-y-[24px] pb-[80px]">
      {/* TAB SWITCHER */}
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

      {/* ===================== CREATOR TAB ===================== */}
      {activeTab === 'creator' && (
        <div className="space-y-[24px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[24px]">
            <div className="ccard bg-slate-900 text-white !border-slate-800">
              <div className="p-[24px]">
                <p className="text-slate-400 text-[13px] font-medium mb-[4px]">Budget Campaign (Plafon)</p>
                <h3 className="text-[24px] font-bold">Rp {budgetPlafon.toLocaleString()}</h3>
              </div>
            </div>
            <div className="ccard">
              <div className="p-[24px]">
                <p className="text-text-soft text-[13px] font-medium mb-[4px]">Sisa Budget Campaign</p>
                <h3 className={`text-[24px] font-bold ${sisaBudgetCampaign < 0 ? 'text-red-600' : 'text-text'}`}>
                  Rp {sisaBudgetCampaign.toLocaleString()}
                </h3>
                <p className="text-[11px] text-text-soft mt-[4px]">Plafon dikurangi Total Ratecard</p>
              </div>
            </div>
            <div className="ccard bg-blue-50 border-blue-100">
              <div className="p-[24px]">
                <p className="text-blue-600 text-[13px] font-medium mb-[4px]">Total Ratecard Kreator (SOW)</p>
                <h3 className="text-[24px] font-bold text-blue-900">Rp {totalRatecard.toLocaleString()}</h3>
                <p className="text-[11px] text-blue-500 mt-[4px]">Total dari {creators.length} Kreator</p>
              </div>
            </div>
            <div className="ccard space-y-[8px]">
              <div className="p-[24px] space-y-[8px]">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-text-soft">Sudah Terbayar</span>
                  <span className="text-[13px] font-semibold text-green-600">Rp {totalPelunasan.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 h-[8px] rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full" style={{ width: `${totalRatecard > 0 ? Math.min((totalPelunasan / totalRatecard) * 100, 100) : 0}%` }}></div>
                </div>
                <div className="flex justify-between items-center pt-[4px] border-t border-line">
                  <span className="text-[11px] text-text-soft">Sisa Belum Dibayar</span>
                  <span className="text-[13px] font-semibold text-red-500">Rp {sisaBelumTerbayar.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ccard !p-0 overflow-hidden">
            <div className="p-[16px] border-b border-line flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-[16px]">
              <h3 className="font-semibold text-text">Detail Pembayaran per Kreator</h3>
              <div className="flex items-center gap-[8px] bg-white border border-line rounded-[8px] px-[12px] py-[6px] focus-within:ring-2 focus-within:ring-blue-500 w-full md:w-72">
                <Search className="w-4 h-4 text-text-soft" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan Username..."
                  className="w-full text-[13px] outline-none bg-transparent"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="tbl-wrap !border-0 !rounded-none">
              <table className="w-full">
                <thead className="border-b border-line">
                  <tr>
                    <th className="w-12 text-center py-[16px]">No</th>
                    <th className="py-[16px]"><button onClick={() => toggleSort('username')} className="flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">Username ID<SortIcon col="username" /></button></th>
                    <th className="py-[16px] text-right"><button onClick={() => toggleSort('price')} className="flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold ml-auto">Total Rate Card<SortIcon col="price" /></button></th>
                    <th className="w-48 py-[16px]"><button onClick={() => toggleSort('pelunasan')} className="flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">Pelunasan<SortIcon col="pelunasan" /></button></th>
                    <th className="w-40 py-[16px]">Status Bayar</th>
                    <th className="w-40 py-[16px]">Tgl Pembayaran</th>
                    <th className="w-24 text-center py-[16px]">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={7} className="h-32 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-text-soft" /></td></tr>
                  ) : sortedCreators.length === 0 ? (
                    <tr><td colSpan={7} className="h-32 text-center text-text-soft">{creators.length === 0 ? 'Belum ada kreator yang di-Approve.' : 'Tidak ditemukan kreator dengan username tersebut.'}</td></tr>
                  ) : (
                    sortedCreators.map((cc, idx) => {
                      const form = editForms[cc.id];
                      if (!form) return null;
                      return (
                        <tr key={cc.id} className="hover:bg-slate-50/50 border-b border-line">
                          <td className="text-center text-text-soft">{idx + 1}</td>
                          <td className="font-medium">@{cc.creators?.username}</td>
                          <td className="text-right">
                            <input type="text" className="input w-full text-right font-bold text-blue-700 disabled:bg-slate-50 disabled:text-text-soft !py-[6px]" value={form.price} onChange={e => handleFormChange(cc.id, 'price', e.target.value)} disabled={!hasAccess} />
                          </td>
                          <td>
                            <input type="text" className="input w-full text-right font-medium disabled:bg-slate-50 disabled:text-text-soft !py-[6px]" value={form.nominal_pelunasan} onChange={e => handleFormChange(cc.id, 'nominal_pelunasan', e.target.value)} disabled={!hasAccess} />
                          </td>
                          <td>
                            <select className={`input w-full font-semibold disabled:bg-slate-50 disabled:text-text-soft !py-[6px] ${form.status_bayar === 'lunas' ? 'bg-green-100 text-green-800 border-green-300' : form.status_bayar === 'sebagian' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : form.status_bayar === 'no_payment' ? 'bg-slate-800 text-white border-slate-700' : 'bg-red-50 text-red-700 border-red-200'}`} value={form.status_bayar} onChange={e => handleFormChange(cc.id, 'status_bayar', e.target.value)} disabled={!hasAccess}>
                              <option value="belum">Not Yet</option>
                              <option value="sebagian">Half Paid</option>
                              <option value="lunas">Paid Off</option>
                              <option value="no_payment">No Payment</option>
                            </select>
                          </td>
                          <td>
                            <input type="date" className="input w-full bg-white disabled:bg-slate-50 disabled:text-text-soft !py-[6px]" value={form.tgl_pembayaran} onChange={e => handleFormChange(cc.id, 'tgl_pembayaran', e.target.value)} disabled={!hasAccess} />
                          </td>
                          <td className="text-center">
                            {hasAccess && (
                              <button onClick={() => handleSave(cc.id)} disabled={saving[cc.id]} className="btn btn-primary w-full !py-[6px] !text-[12px] flex justify-center items-center">
                                {saving[cc.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-[4px]" />}
                                {saving[cc.id] ? '' : 'Simpan'}
                              </button>
                            )}
                            {cc.payment_updated_at && (
                              <div className="text-[10px] text-text-soft mt-[8px] leading-tight">
                                Terakhir diupdate oleh:<br/>
                                <span className="font-semibold">{cc.payment_updated_by_profile?.nama || 'Sistem'}</span><br/>
                                {new Date(cc.payment_updated_at).toLocaleDateString('id-ID')}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ADS TAB ===================== */}
      {activeTab === 'ads' && (
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
                    <select className={`input w-full font-semibold ${getStatusStyle(newAds.status_bayar)}`} value={newAds.status_bayar} onChange={e => setNewAds(p => ({ ...p, status_bayar: e.target.value }))}>
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
