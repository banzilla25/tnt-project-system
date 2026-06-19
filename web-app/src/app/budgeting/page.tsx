"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Loader2, Save, Search, ArrowUp, ArrowDown, ArrowUpDown, Plus, Trash2, Pencil, X, Check, StickyNote, Wallet } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

type AdsEntry = {
  id: number;
  campaign_id: number;
  detail: string;
  nominal: number;
  status_bayar: 'not_yet' | 'half_paid' | 'pay_off' | 'no_payment';
  tanggal: string;
  notes: string | null;
};

export default function BudgetingPage() {
  const { campaigns, vw_campaign_summary } = useDatabaseStore();

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | ''>('');
  const [activeTab, setActiveTab] = useState<'creator' | 'ads'>('creator');

  // ===================== CREATOR STATE =====================
  const [creators, setCreators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [editForms, setEditForms] = useState<Record<number, { price: string; nominal_pelunasan: string; status_bayar: string; tgl_pembayaran: string }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: '', dir: 'asc' });

  // ===================== ADS STATE =====================
  const [adsEntries, setAdsEntries] = useState<AdsEntry[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [editingAdsId, setEditingAdsId] = useState<number | null>(null);
  const [adsEditForm, setAdsEditForm] = useState<Partial<AdsEntry>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAds, setNewAds] = useState({ detail: '', nominal: '', status_bayar: 'not_yet', tanggal: '', notes: '' });
  const [addingAds, setAddingAds] = useState(false);

  const campaign = campaigns.find(c => c.id === Number(selectedCampaignId));
  const campaignSummary = vw_campaign_summary.find(s => s.campaign_id === Number(selectedCampaignId));

  const toggleSort = (key: string) => {
    setSortConfig(prev =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig.key !== col) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline text-slate-400" />;
    return sortConfig.dir === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 ml-1 inline text-blue-600" />
      : <ArrowDown className="w-3.5 h-3.5 ml-1 inline text-blue-600" />;
  };

  // ===================== FETCH CREATOR DATA =====================
  const fetchCreatorData = useCallback(async (campaignId: number) => {
    setIsLoading(true);
    setCreators([]);
    setEditForms({});
    try {
      const { data } = await supabase
        .from('campaign_creators')
        .select(`id, price, status_bayar, nominal_pelunasan, tgl_pembayaran, creators ( username )`)
        .eq('campaign_id', campaignId)
        .eq('approval', 'approved');
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
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ===================== FETCH ADS DATA =====================
  const fetchAdsData = useCallback(async (campaignId: number) => {
    setAdsLoading(true);
    const { data } = await supabase
      .from('ads_spends')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('tanggal', { ascending: false });
    setAdsEntries(data || []);
    setAdsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      fetchCreatorData(Number(selectedCampaignId));
      fetchAdsData(Number(selectedCampaignId));
      setShowAddForm(false);
      setEditingAdsId(null);
      setSearchQuery('');
    } else {
      setCreators([]);
      setAdsEntries([]);
    }
  }, [selectedCampaignId, fetchCreatorData, fetchAdsData]);

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
        .update({ price, status_bayar: form.status_bayar as any, nominal_pelunasan: nominal, tgl_pembayaran: form.tgl_pembayaran || null })
        .eq('id', ccId);
      if (error) throw error;
      setCreators(prev => prev.map(c => c.id === ccId ? { ...c, price, status_bayar: form.status_bayar, nominal_pelunasan: nominal, tgl_pembayaran: form.tgl_pembayaran } : c));
      alert('Berhasil disimpan');
    } catch {
      alert('Gagal menyimpan');
    } finally {
      setSaving(prev => ({ ...prev, [ccId]: false }));
    }
  };

  // ===================== ADS HANDLERS =====================
  const handleAddAds = async () => {
    if (!newAds.detail || !newAds.nominal) return;
    setAddingAds(true);
    const { error } = await supabase.from('ads_spends').insert({
      campaign_id: Number(selectedCampaignId),
      detail: newAds.detail,
      nominal: Number(newAds.nominal.replace(/[^0-9]/g, '')),
      status_bayar: newAds.status_bayar,
      tanggal: newAds.tanggal || new Date().toISOString().split('T')[0],
      notes: newAds.notes || null
    });
    if (!error) {
      setNewAds({ detail: '', nominal: '', status_bayar: 'not_yet', tanggal: '', notes: '' });
      setShowAddForm(false);
      await fetchAdsData(Number(selectedCampaignId));
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
      notes: adsEditForm.notes || null
    }).eq('id', id);
    if (!error) {
      setEditingAdsId(null);
      await fetchAdsData(Number(selectedCampaignId));
    } else {
      alert('Gagal menyimpan: ' + error.message);
    }
  };

  const handleDeleteAds = async (id: number) => {
    if (!confirm('Yakin ingin menghapus entri ini?')) return;
    await supabase.from('ads_spends').delete().eq('id', id);
    await fetchAdsData(Number(selectedCampaignId));
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

  // ===================== CALCULATIONS =====================
  const budgetPlafon = Number(campaign?.budget_creator_plafon || 0);
  const totalRatecard = creators.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
  const sisaBudgetCampaign = budgetPlafon - totalRatecard;
  const totalPelunasan = creators.reduce((sum, c) => sum + (Number(c.nominal_pelunasan) || 0), 0);
  const sisaBelumTerbayar = totalRatecard - totalPelunasan;

  const filteredCreators = creators.filter(cc => !searchQuery || cc.creators?.username?.toLowerCase().includes(searchQuery.toLowerCase()));
  const sortedCreators = [...filteredCreators].sort((a, b) => {
    if (!sortConfig.key) return 0;
    if (sortConfig.key === 'username') {
      return sortConfig.dir === 'asc'
        ? String(a.creators?.username ?? '').localeCompare(String(b.creators?.username ?? ''))
        : String(b.creators?.username ?? '').localeCompare(String(a.creators?.username ?? ''));
    }
    const vA = Number(sortConfig.key === 'price' ? a.price : a.nominal_pelunasan) || 0;
    const vB = Number(sortConfig.key === 'price' ? b.price : b.nominal_pelunasan) || 0;
    return sortConfig.dir === 'asc' ? vA - vB : vB - vA;
  });

  const adsBudgetPlafon = Number(campaignSummary?.budget_ads_plafon || campaign?.budget_ads_plafon || 0);
  const adsTerpakai = adsEntries.filter(a => a.status_bayar === 'pay_off').reduce((sum, a) => sum + Number(a.nominal), 0);
  const adsSisa = adsBudgetPlafon - adsTerpakai;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Wallet className="w-8 h-8 text-blue-600" />
          Budgeting & Keuangan
        </h1>
        <p className="text-slate-500 mt-1">Kelola budget kreator dan ads untuk setiap campaign.</p>
      </div>

      {/* Campaign Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <label className="text-sm font-semibold text-slate-700 mb-2 block">Pilih Campaign</label>
        <select
          className="w-full md:w-1/2 p-2.5 border border-slate-300 rounded-lg bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={selectedCampaignId}
          onChange={e => setSelectedCampaignId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">-- Pilih Campaign --</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.nama}</option>
          ))}
        </select>
      </div>

      {/* Content — only show when campaign selected */}
      {selectedCampaignId ? (
        <div className="space-y-6">
          {/* TAB SWITCHER */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('creator')}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'creator' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              💰 Budget Creator
            </button>
            <button
              onClick={() => setActiveTab('ads')}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'ads' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              📢 Budget Ads
            </button>
          </div>

          {/* ===================== CREATOR TAB ===================== */}
          {activeTab === 'creator' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 text-white p-4 rounded-xl shadow-sm">
                  <p className="text-slate-400 text-sm font-medium mb-1">Budget Campaign (Plafon)</p>
                  <h3 className="text-2xl font-bold">Rp {budgetPlafon.toLocaleString()}</h3>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                  <p className="text-slate-500 text-sm font-medium mb-1">Sisa Budget Campaign</p>
                  <h3 className={`text-2xl font-bold ${sisaBudgetCampaign < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    Rp {sisaBudgetCampaign.toLocaleString()}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Plafon dikurangi Total Ratecard</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl shadow-sm">
                  <p className="text-blue-600 text-sm font-medium mb-1">Total Ratecard Kreator (SOW)</p>
                  <h3 className="text-2xl font-bold text-blue-900">Rp {totalRatecard.toLocaleString()}</h3>
                  <p className="text-xs text-blue-500 mt-1">Total dari {creators.length} Kreator</p>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Sudah Terbayar</span>
                    <span className="text-sm font-semibold text-green-600">Rp {totalPelunasan.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: `${totalRatecard > 0 ? Math.min((totalPelunasan / totalRatecard) * 100, 100) : 0}%` }}></div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                    <span className="text-xs text-slate-500">Sisa Belum Dibayar</span>
                    <span className="text-sm font-semibold text-red-500">Rp {sisaBelumTerbayar.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4">
                  <h3 className="font-semibold text-slate-800">Detail Pembayaran per Kreator</h3>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-1.5 w-full md:w-72">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Cari username..." className="w-full text-sm outline-none bg-transparent" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">No</TableHead>
                        <TableHead><button onClick={() => toggleSort('username')} className="flex items-center gap-0.5 hover:text-blue-600 font-semibold">Username<SortIcon col="username" /></button></TableHead>
                        <TableHead className="text-right"><button onClick={() => toggleSort('price')} className="flex items-center gap-0.5 hover:text-blue-600 font-semibold ml-auto">Rate Card<SortIcon col="price" /></button></TableHead>
                        <TableHead className="w-48"><button onClick={() => toggleSort('pelunasan')} className="flex items-center gap-0.5 hover:text-blue-600 font-semibold">Pelunasan<SortIcon col="pelunasan" /></button></TableHead>
                        <TableHead className="w-40">Status Bayar</TableHead>
                        <TableHead className="w-40">Tgl Pembayaran</TableHead>
                        <TableHead className="w-24 text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={7} className="h-32 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></TableCell></TableRow>
                      ) : sortedCreators.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500">{creators.length === 0 ? 'Belum ada kreator yang di-Approve di campaign ini.' : 'Kreator tidak ditemukan.'}</TableCell></TableRow>
                      ) : (
                        sortedCreators.map((cc, idx) => {
                          const form = editForms[cc.id];
                          if (!form) return null;
                          return (
                            <TableRow key={cc.id} className="hover:bg-slate-50/50">
                              <TableCell className="text-center text-slate-500">{idx + 1}</TableCell>
                              <TableCell className="font-medium">@{cc.creators?.username}</TableCell>
                              <TableCell className="text-right">
                                <input type="text" className="w-full p-2 border rounded text-sm text-right font-bold text-blue-700" value={form.price} onChange={e => handleFormChange(cc.id, 'price', e.target.value)} />
                              </TableCell>
                              <TableCell>
                                <input type="text" className="w-full p-2 border rounded text-sm text-right font-medium" value={form.nominal_pelunasan} onChange={e => handleFormChange(cc.id, 'nominal_pelunasan', e.target.value)} />
                              </TableCell>
                              <TableCell>
                                <select className={`w-full p-2 border rounded text-sm font-semibold ${form.status_bayar === 'lunas' ? 'bg-green-100 text-green-800 border-green-300' : form.status_bayar === 'sebagian' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : form.status_bayar === 'no_payment' ? 'bg-slate-800 text-white border-slate-700' : 'bg-red-50 text-red-700 border-red-200'}`} value={form.status_bayar} onChange={e => handleFormChange(cc.id, 'status_bayar', e.target.value)}>
                                  <option value="belum">Not Yet</option>
                                  <option value="sebagian">Half Paid</option>
                                  <option value="lunas">Paid Off</option>
                                  <option value="no_payment">No Payment</option>
                                </select>
                              </TableCell>
                              <TableCell>
                                <input type="date" className="w-full p-2 border rounded text-sm bg-white" value={form.tgl_pembayaran} onChange={e => handleFormChange(cc.id, 'tgl_pembayaran', e.target.value)} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Button size="sm" onClick={() => handleSave(cc.id)} disabled={saving[cc.id]} className="w-full">
                                  {saving[cc.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                                  {saving[cc.id] ? '' : 'Simpan'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* ===================== ADS TAB ===================== */}
          {activeTab === 'ads' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 text-white p-4 rounded-xl shadow-sm">
                  <p className="text-slate-400 text-sm font-medium mb-1">Total Budget ADS (Plafon)</p>
                  <h3 className="text-2xl font-bold">Rp {adsBudgetPlafon.toLocaleString()}</h3>
                </div>
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl shadow-sm">
                  <p className="text-orange-600 text-sm font-medium mb-1">Total ADS Terpakai</p>
                  <h3 className="text-2xl font-bold text-orange-900">Rp {adsTerpakai.toLocaleString()}</h3>
                  <p className="text-xs text-orange-400 mt-1">Hanya yang berstatus Paid Off</p>
                </div>
                <div className={`p-4 rounded-xl shadow-sm border ${adsSisa < 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                  <p className={`text-sm font-medium mb-1 ${adsSisa < 0 ? 'text-red-600' : 'text-green-600'}`}>Sisa Budget ADS</p>
                  <h3 className={`text-2xl font-bold ${adsSisa < 0 ? 'text-red-900' : 'text-green-900'}`}>Rp {adsSisa.toLocaleString()}</h3>
                  <p className={`text-xs mt-1 ${adsSisa < 0 ? 'text-red-400' : 'text-green-400'}`}>{adsSisa < 0 ? '⚠️ Melebihi plafon!' : 'Plafon dikurangi Terpakai'}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <h3 className="font-semibold text-slate-800">Riwayat Top-Up & Pengeluaran Ads</h3>
                  <Button size="sm" onClick={() => setShowAddForm(v => !v)} className="flex items-center gap-2">
                    {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showAddForm ? 'Batal' : 'Tambah Entri'}
                  </Button>
                </div>

                {showAddForm && (
                  <div className="p-4 bg-indigo-50/50 border-b border-indigo-100">
                    <p className="text-sm font-semibold text-indigo-700 mb-3">➕ Tambah Entri Baru</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="lg:col-span-2">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Detail Ads *</label>
                        <input type="text" className="w-full p-2 border rounded text-sm" placeholder="Contoh: Top Up Ads VSA" value={newAds.detail} onChange={e => setNewAds(p => ({ ...p, detail: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Nominal (Rp) *</label>
                        <input type="text" className="w-full p-2 border rounded text-sm" placeholder="10000000" value={newAds.nominal} onChange={e => setNewAds(p => ({ ...p, nominal: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Status Bayar</label>
                        <select className={`w-full p-2 border rounded text-sm font-semibold ${getStatusStyle(newAds.status_bayar)}`} value={newAds.status_bayar} onChange={e => setNewAds(p => ({ ...p, status_bayar: e.target.value }))}>
                          <option value="not_yet">Not Yet</option>
                          <option value="half_paid">Half Paid</option>
                          <option value="pay_off">Paid Off</option>
                          <option value="no_payment">No Payment</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Tanggal</label>
                        <input type="date" className="w-full p-2 border rounded text-sm" value={newAds.tanggal} onChange={e => setNewAds(p => ({ ...p, tanggal: e.target.value }))} />
                      </div>
                      <div className="lg:col-span-4">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notes (Opsional)</label>
                        <input type="text" className="w-full p-2 border rounded text-sm" placeholder="Tambahkan catatan jika perlu..." value={newAds.notes} onChange={e => setNewAds(p => ({ ...p, notes: e.target.value }))} />
                      </div>
                      <div className="flex items-end">
                        <Button className="w-full" onClick={handleAddAds} disabled={addingAds || !newAds.detail || !newAds.nominal}>
                          {addingAds ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                          Simpan
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-center">No</TableHead>
                        <TableHead>Detail Ads</TableHead>
                        <TableHead className="text-right">Nominal</TableHead>
                        <TableHead className="w-36">Status Bayar</TableHead>
                        <TableHead className="w-36">Tanggal</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-24 text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adsLoading ? (
                        <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></TableCell></TableRow>
                      ) : adsEntries.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="h-24 text-center text-slate-500">Belum ada entri. Klik "Tambah Entri" untuk memulai.</TableCell></TableRow>
                      ) : (
                        adsEntries.map((entry, idx) => (
                          <TableRow key={entry.id} className={`hover:bg-slate-50/50 ${entry.status_bayar === 'pay_off' ? 'bg-green-50/30' : ''}`}>
                            <TableCell className="text-center text-slate-500">{idx + 1}</TableCell>
                            <TableCell>
                              {editingAdsId === entry.id
                                ? <input className="w-full p-1.5 border rounded text-sm" value={adsEditForm.detail || ''} onChange={e => setAdsEditForm(p => ({ ...p, detail: e.target.value }))} />
                                : <span className="font-medium">{entry.detail}</span>}
                            </TableCell>
                            <TableCell className="text-right">
                              {editingAdsId === entry.id
                                ? <input type="text" className="w-full p-1.5 border rounded text-sm text-right" value={adsEditForm.nominal || ''} onChange={e => setAdsEditForm(p => ({ ...p, nominal: Number(e.target.value) }))} />
                                : <span className="font-bold">Rp {Number(entry.nominal).toLocaleString()}</span>}
                            </TableCell>
                            <TableCell>
                              {editingAdsId === entry.id
                                ? <select className={`w-full p-1.5 border rounded text-sm font-semibold ${getStatusStyle(adsEditForm.status_bayar || '')}`} value={adsEditForm.status_bayar || ''} onChange={e => setAdsEditForm(p => ({ ...p, status_bayar: e.target.value as any }))}>
                                    <option value="not_yet">Not Yet</option>
                                    <option value="half_paid">Half Paid</option>
                                    <option value="pay_off">Paid Off</option>
                                    <option value="no_payment">No Payment</option>
                                  </select>
                                : <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusStyle(entry.status_bayar)}`}>{getStatusLabel(entry.status_bayar)}</span>}
                            </TableCell>
                            <TableCell>
                              {editingAdsId === entry.id
                                ? <input type="date" className="w-full p-1.5 border rounded text-sm" value={adsEditForm.tanggal || ''} onChange={e => setAdsEditForm(p => ({ ...p, tanggal: e.target.value }))} />
                                : <span className="text-slate-600">{entry.tanggal ? new Date(entry.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</span>}
                            </TableCell>
                            <TableCell>
                              {editingAdsId === entry.id
                                ? <input className="w-full p-1.5 border rounded text-sm" placeholder="Notes..." value={adsEditForm.notes || ''} onChange={e => setAdsEditForm(p => ({ ...p, notes: e.target.value }))} />
                                : <span className="text-slate-500 text-sm italic">{entry.notes || '-'}</span>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                {editingAdsId === entry.id ? (
                                  <>
                                    <button onClick={() => handleSaveAds(entry.id)} className="p-1.5 rounded hover:bg-green-100 text-green-600" title="Simpan"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingAdsId(null)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Batal"><X className="w-4 h-4" /></button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => handleEditAds(entry)} className="p-1.5 rounded hover:bg-blue-100 text-blue-500" title="Edit"><Pencil className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteAds(entry.id)} className="p-1.5 rounded hover:bg-red-100 text-red-500" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Pilih campaign di atas untuk mulai mengelola keuangan.</p>
        </div>
      )}
    </div>
  );
}
