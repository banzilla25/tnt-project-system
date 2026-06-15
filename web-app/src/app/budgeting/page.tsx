"use client";

import React, { useState, useEffect } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Save, Plus, Search, CheckCircle2 } from "lucide-react";
import { CreatorPayment, AdsSpend } from "@/types/database";

export default function BudgetingPage() {
  const { campaigns, vw_campaign_summary, campaign_creators, creators, creator_payments, ads_spends, updateCreatorPayment, addAdsSpend } = useDatabaseStore();
  
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | ''>('');
  const [activeTab, setActiveTab] = useState<'creator' | 'ads'>('creator');
  const [searchQuery, setSearchQuery] = useState("");

  // Ads Form
  const [newAdsDetail, setNewAdsDetail] = useState("");
  const [newAdsNominal, setNewAdsNominal] = useState("");
  const [newAdsTanggal, setNewAdsTanggal] = useState("");
  const [newAdsStatus, setNewAdsStatus] = useState<'not_yet' | 'half_paid' | 'pay_off'>('pay_off');
  
  const activeCampaigns = vw_campaign_summary.filter(c => c.status === 'aktif');
  
  const currentSummary = vw_campaign_summary.find(s => s.campaign_id === Number(selectedCampaignId));
  
  const ccList = campaign_creators.filter(cc => cc.campaign_id === Number(selectedCampaignId) && cc.price > 0);
  const filteredCcList = ccList.filter(cc => {
    const creator = creators.find(cr => cr.id === cc.creator_id);
    return creator?.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getPaymentState = (ccId: number) => {
    const p = creator_payments.find(cp => cp.campaign_creator_id === ccId);
    return p || { pelunasan: 0, status_bayar: 'no_payment' as any, tgl_pembayaran: '' };
  };

  const handleUpdatePayment = async (ccId: number, pelunasan: number, status: any, tgl: string) => {
    await updateCreatorPayment(null, {
      campaign_creator_id: ccId,
      pelunasan: pelunasan,
      status_bayar: status,
      tgl_pembayaran: tgl
    });
  };

  const handleLunas = async (ccId: number, price: number) => {
    await updateCreatorPayment(null, {
      campaign_creator_id: ccId,
      pelunasan: price,
      status_bayar: 'pay_off',
      tgl_pembayaran: new Date().toISOString().split('T')[0]
    });
  };

  const handleAddAds = async () => {
    if (!newAdsDetail || !newAdsNominal) return;
    await addAdsSpend({
      campaign_id: Number(selectedCampaignId),
      detail: newAdsDetail,
      nominal: Number(newAdsNominal),
      status_bayar: newAdsStatus,
      tanggal: newAdsTanggal || new Date().toISOString().split('T')[0]
    });
    setNewAdsDetail("");
    setNewAdsNominal("");
    setNewAdsTanggal("");
    setNewAdsStatus('pay_off');
  };

  const currentAdsSpends = ads_spends.filter(a => a.campaign_id === Number(selectedCampaignId));
  const terpakaiCreator = ccList.reduce((sum, cc) => sum + (getPaymentState(cc.id).pelunasan || 0), 0);
  const terpakaiAds = currentAdsSpends.filter(a => a.status_bayar === 'pay_off').reduce((sum, a) => sum + Number(a.nominal), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Budgeting & Pelunasan</h1>
        <p className="text-slate-500">Buku kas manajemen pembayaran kreator dan top-up saldo iklan.</p>
      </div>

      <Card className="bg-slate-50/50">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="w-full md:w-1/3">
              <label className="text-sm font-semibold text-slate-700 mb-1 block">Pilih Campaign</label>
              <select 
                className="w-full p-2 border border-slate-300 rounded-lg bg-white" 
                value={selectedCampaignId} 
                onChange={e => setSelectedCampaignId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">-- Silakan Pilih Campaign --</option>
                {activeCampaigns.map(c => <option key={c.campaign_id} value={c.campaign_id}>{c.nama}</option>)}
              </select>
            </div>
            {currentSummary && (
              <div className="w-full md:w-2/3 flex gap-4 overflow-x-auto pb-2 md:pb-0">
                <div className="bg-white border rounded-lg p-3 min-w-[200px] flex-1">
                  <p className="text-xs text-slate-500 font-medium uppercase">Total Plafon Creator</p>
                  <p className="text-xl font-bold text-slate-800">Rp {currentSummary.budget_creator_plafon.toLocaleString()}</p>
                </div>
                <div className="bg-white border rounded-lg p-3 min-w-[200px] flex-1">
                  <p className="text-xs text-slate-500 font-medium uppercase">Total Plafon Ads</p>
                  <p className="text-xl font-bold text-slate-800">Rp {currentSummary.budget_ads_plafon.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedCampaignId && currentSummary ? (
        <div className="space-y-4">
          <div className="flex border-b border-slate-200">
            <button
              className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'creator' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('creator')}
            >
              Creator Payment
            </button>
            <button
              className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'ads' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('ads')}
            >
              Ads Top-up
            </button>
          </div>

          {activeTab === 'creator' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50/30 border-blue-100 shadow-none">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-blue-800 mb-1">Plafon Creator</p>
                    <h3 className="text-2xl font-bold text-blue-900">Rp {currentSummary.budget_creator_plafon.toLocaleString()}</h3>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50/30 border-orange-100 shadow-none">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-orange-800 mb-1">Terpakai (Pelunasan)</p>
                    <h3 className="text-2xl font-bold text-orange-900">Rp {terpakaiCreator.toLocaleString()}</h3>
                  </CardContent>
                </Card>
                <Card className="bg-green-50/30 border-green-100 shadow-none">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-green-800 mb-1">Sisa Budget</p>
                    <h3 className="text-2xl font-bold text-green-900">Rp {(currentSummary.budget_creator_plafon - terpakaiCreator).toLocaleString()}</h3>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Buku Kas Creator</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari username..."
                      className="w-full pl-8 pr-3 py-2 border rounded-md text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Creator</TableHead>
                          <TableHead>Rate Card</TableHead>
                          <TableHead>Status Bayar</TableHead>
                          <TableHead>Pelunasan (Rp)</TableHead>
                          <TableHead>Tgl Bayar</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCcList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-slate-500">Belum ada creator dengan rate card di campaign ini.</TableCell>
                          </TableRow>
                        ) : (
                          filteredCcList.map((cc) => {
                            const creator = creators.find(cr => cr.id === cc.creator_id);
                            const pState = getPaymentState(cc.id);
                            const isLunas = pState.status_bayar === 'pay_off';
                            
                            return (
                              <TableRow key={cc.id} className={isLunas ? 'bg-green-50/30' : ''}>
                                <TableCell>
                                  <div className="font-medium">@{creator?.username}</div>
                                  <Badge variant="outline" className="mt-1">{cc.tier || 'NANO'}</Badge>
                                </TableCell>
                                <TableCell className="font-semibold">Rp {cc.price.toLocaleString()}</TableCell>
                                <TableCell>
                                  <select 
                                    className={`p-1.5 text-sm border rounded ${isLunas ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white'}`}
                                    value={pState.status_bayar}
                                    onChange={(e) => handleUpdatePayment(cc.id, pState.pelunasan, e.target.value, pState.tgl_pembayaran || '')}
                                  >
                                    <option value="no_payment">Belum Bayar</option>
                                    <option value="not_yet">Jatuh Tempo</option>
                                    <option value="half_paid">Sebagian (DP)</option>
                                    <option value="pay_off">Lunas</option>
                                  </select>
                                </TableCell>
                                <TableCell>
                                  <input 
                                    type="number" 
                                    className="w-32 p-1.5 border rounded text-sm" 
                                    value={pState.pelunasan || ''}
                                    onChange={(e) => handleUpdatePayment(cc.id, Number(e.target.value), pState.status_bayar, pState.tgl_pembayaran || '')}
                                    placeholder="0"
                                  />
                                </TableCell>
                                <TableCell>
                                  <input 
                                    type="date" 
                                    className="p-1.5 border rounded text-sm w-36" 
                                    value={pState.tgl_pembayaran || ''}
                                    onChange={(e) => handleUpdatePayment(cc.id, pState.pelunasan, pState.status_bayar, e.target.value)}
                                  />
                                </TableCell>
                                <TableCell>
                                  {!isLunas ? (
                                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleLunas(cc.id, cc.price)}>
                                      <CheckCircle2 className="w-4 h-4 mr-1" /> Lunas
                                    </Button>
                                  ) : (
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Sudah Lunas</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'ads' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-indigo-50/30 border-indigo-100 shadow-none">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-indigo-800 mb-1">Plafon Ads</p>
                    <h3 className="text-2xl font-bold text-indigo-900">Rp {currentSummary.budget_ads_plafon.toLocaleString()}</h3>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50/30 border-orange-100 shadow-none">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-orange-800 mb-1">Terpakai (Top-up Lunas)</p>
                    <h3 className="text-2xl font-bold text-orange-900">Rp {terpakaiAds.toLocaleString()}</h3>
                  </CardContent>
                </Card>
                <Card className="bg-green-50/30 border-green-100 shadow-none">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-green-800 mb-1">Sisa Budget Ads</p>
                    <h3 className="text-2xl font-bold text-green-900">Rp {(currentSummary.budget_ads_plafon - terpakaiAds).toLocaleString()}</h3>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Riwayat Top-up Saldo Ads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Detail Top-up</label>
                      <input type="text" className="w-full p-2 border rounded" placeholder="Contoh: Topup BCA 10 Jan" value={newAdsDetail} onChange={e => setNewAdsDetail(e.target.value)} />
                    </div>
                    <div className="w-40">
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Nominal (Rp)</label>
                      <input type="number" className="w-full p-2 border rounded" placeholder="0" value={newAdsNominal} onChange={e => setNewAdsNominal(e.target.value)} />
                    </div>
                    <div className="w-36">
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Tanggal</label>
                      <input type="date" className="w-full p-2 border rounded" value={newAdsTanggal} onChange={e => setNewAdsTanggal(e.target.value)} />
                    </div>
                    <div className="w-36">
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Status</label>
                      <select className="w-full p-2 border rounded" value={newAdsStatus} onChange={(e: any) => setNewAdsStatus(e.target.value)}>
                        <option value="not_yet">Belum Bayar</option>
                        <option value="pay_off">Lunas</option>
                      </select>
                    </div>
                    <Button onClick={handleAddAds} disabled={!newAdsDetail || !newAdsNominal}>
                      <Plus className="w-4 h-4 mr-2" /> Tambah
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Detail</TableHead>
                        <TableHead>Nominal</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentAdsSpends.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-slate-500">Belum ada riwayat top-up ads.</TableCell>
                        </TableRow>
                      ) : (
                        currentAdsSpends.map(ads => (
                          <TableRow key={ads.id}>
                            <TableCell>{ads.tanggal ? new Date(ads.tanggal).toLocaleDateString('id-ID') : '-'}</TableCell>
                            <TableCell className="font-medium">{ads.detail}</TableCell>
                            <TableCell className="font-bold">Rp {ads.nominal.toLocaleString()}</TableCell>
                            <TableCell>
                              {ads.status_bayar === 'pay_off' ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Lunas</Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-500">Belum Bayar</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <p className="text-slate-500 font-medium">Pilih campaign di atas untuk mengelola Budgeting.</p>
        </div>
      )}
    </div>
  );
}
