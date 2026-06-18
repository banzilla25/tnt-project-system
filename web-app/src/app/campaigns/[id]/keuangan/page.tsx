"use client";

import React, { useState, useEffect } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Loader2, Save, Search } from "lucide-react";
import { useParams } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

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

  const [creators, setCreators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  // Form states per creator mapping
  const [editForms, setEditForms] = useState<Record<number, { price: string; nominal_pelunasan: string; status_bayar: string; tgl_pembayaran: string }>>({});
  
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_creators')
        .select(`
          id,
          price,
          status_bayar,
          nominal_pelunasan,
          tgl_pembayaran,
          creators ( username )
        `)
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
  };

  useEffect(() => {
    if (campaignId) {
      fetchData();
    }
  }, [campaignId]);

  const handleFormChange = (ccId: number, field: string, value: string) => {
    setEditForms(prev => ({
      ...prev,
      [ccId]: {
        ...prev[ccId],
        [field]: value
      }
    }));
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
          price: price,
          status_bayar: form.status_bayar as any,
          nominal_pelunasan: nominal,
          tgl_pembayaran: form.tgl_pembayaran || null
        })
        .eq('id', ccId);

      if (error) throw error;
      
      // Update local state without refetching all
      setCreators(prev => prev.map(c => 
        c.id === ccId ? { ...c, price: price, status_bayar: form.status_bayar, nominal_pelunasan: nominal, tgl_pembayaran: form.tgl_pembayaran } : c
      ));

      alert('Berhasil disimpan');
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan');
    } finally {
      setSaving(prev => ({ ...prev, [ccId]: false }));
    }
  };

  if (!campaign) return null;

  // Calculators
  const budgetPlafon = Number(campaign.budget_creator_plafon || 0);
  const totalRatecard = creators.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
  const sisaBudgetCampaign = budgetPlafon - totalRatecard;
  
  const totalPelunasan = creators.reduce((sum, c) => sum + (Number(c.nominal_pelunasan) || 0), 0);
  const sisaBelumTerbayar = totalRatecard - totalPelunasan;

  const filteredCreators = creators.filter(cc => {
    if (!searchQuery) return true;
    return cc.creators?.username?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 pb-20">
      
      {/* Dashboard Rekapan Budgeting */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kolom Kiri: Budget Campaign */}
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

        {/* Kolom Kanan: Pelunasan */}
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
            <div className="bg-green-500 h-full" style={{ width: `${totalRatecard > 0 ? (totalPelunasan/totalRatecard)*100 : 0}%` }}></div>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-100">
            <span className="text-xs text-slate-500">Sisa Belum Dibayar</span>
            <span className="text-sm font-semibold text-red-500">Rp {sisaBelumTerbayar.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Tabel Detail Keuangan */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 gap-4">
          <h3 className="font-semibold text-slate-800">Detail Pembayaran per Kreator</h3>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Cari berdasarkan Username..."
              className="w-full text-sm outline-none bg-transparent"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">No</TableHead>
                <TableHead>Username ID</TableHead>
                <TableHead className="text-right">Total Rate Card</TableHead>
                <TableHead className="w-48">Pelunasan</TableHead>
                <TableHead className="w-40">Status Bayar</TableHead>
                <TableHead className="w-40">Tgl Pembayaran</TableHead>
                <TableHead className="w-24 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : filteredCreators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                    {creators.length === 0 ? 'Belum ada kreator yang di-Approve.' : 'Tidak ditemukan kreator dengan username tersebut.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCreators.map((cc, idx) => {
                  const form = editForms[cc.id];
                  if (!form) return null;
                  
                  return (
                    <TableRow key={cc.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-center text-slate-500">{idx + 1}</TableCell>
                      <TableCell className="font-medium">@{cc.creators?.username}</TableCell>
                      <TableCell className="text-right">
                        <input 
                          type="text" 
                          className="w-full p-2 border rounded text-sm text-right font-bold text-blue-700"
                          value={form.price}
                          onChange={e => handleFormChange(cc.id, 'price', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <input 
                          type="text" 
                          className="w-full p-2 border rounded text-sm text-right font-medium"
                          value={form.nominal_pelunasan}
                          onChange={e => handleFormChange(cc.id, 'nominal_pelunasan', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <select 
                          className={`w-full p-2 border rounded text-sm font-semibold ${
                            form.status_bayar === 'lunas' ? 'bg-green-100 text-green-800 border-green-300' :
                            form.status_bayar === 'sebagian' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                            form.status_bayar === 'no_payment' ? 'bg-slate-800 text-white border-slate-700' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}
                          value={form.status_bayar}
                          onChange={e => handleFormChange(cc.id, 'status_bayar', e.target.value)}
                        >
                          <option value="belum">Not Yet</option>
                          <option value="sebagian">Half Paid</option>
                          <option value="lunas">Paid Off</option>
                          <option value="no_payment">No Payment</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <input 
                          type="date" 
                          className="w-full p-2 border rounded text-sm bg-white"
                          value={form.tgl_pembayaran}
                          onChange={e => handleFormChange(cc.id, 'tgl_pembayaran', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          size="sm" 
                          onClick={() => handleSave(cc.id)}
                          disabled={saving[cc.id]}
                          className="w-full"
                        >
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
  );
}
