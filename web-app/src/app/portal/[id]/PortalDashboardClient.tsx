"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TrendingUp, Video, Users, Package, Calendar, CheckCircle, Activity, BarChart3 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { submitClientApproval, updateResiByClient } from "../actions/portalActions";
import { useRouter } from "next/navigation";

export default function PortalDashboardClient({ data, campaignId }: { data: any, campaignId: number }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'performa' | 'approval' | 'sampel' | 'live'>('performa');
  const [isApproving, setIsApproving] = useState<number | null>(null);

  const { campaign, summary, dailyPerf, approvalList, samples, schedules, videos, skus, totalSales, totalAwareness } = data;
  
  // Calculate display values based on campaign type and modern tracking data
  const isAwareness = campaign?.tipe_campaign === 'awareness' || campaign?.tipe_campaign === 'gmv_awareness';
  const displayOrganic = approvalList.reduce((sum: number, c: any) => sum + (c.gmv_organic || 0), 0);
  const displayAds = approvalList.reduce((sum: number, c: any) => sum + (c.gmv_ads || 0), 0);
  const displayTotalGmv = displayOrganic + displayAds;
  const displayTotalVideo = isAwareness ? (totalAwareness?.total_video || summary.achievement_video || 0) : (summary.achievement_video || 0);

  const percentGmv = summary.target_gmv ? Math.round((displayTotalGmv / summary.target_gmv) * 100) : 0;
  const percentVideo = summary.target_video ? Math.round((displayTotalVideo / summary.target_video) * 100) : 0;

  const handleApproval = async (ccId: number, status: 'approved' | 'rejected') => {
    setIsApproving(ccId);
    try {
      await submitClientApproval(campaignId, ccId, status);
      router.refresh();
    } catch (err) {
      alert("Gagal menyimpan persetujuan. Silakan coba lagi.");
    } finally {
      setIsApproving(null);
    }
  };

  const handleUpdateResi = async (addrId: number, resi: string, proses: string, produk?: string, notes?: string) => {
    try {
      await updateResiByClient(campaignId, addrId, resi, proses, produk, notes);
      router.refresh();
    } catch (err) {
      alert("Gagal memperbarui status pengiriman. Silakan coba lagi.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Badge variant="outline" className="mb-2 border-blue-200 bg-blue-50 text-blue-700">Portal Brand Khusus</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{campaign.nama}</h1>
          <p className="text-slate-500 mt-1">
            Periode: {new Date(campaign.start_date).toLocaleDateString('id-ID')} - {new Date(campaign.end_date).toLocaleDateString('id-ID')}
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-sm text-slate-500">Status</p>
          <Badge variant={campaign.status === 'aktif' ? 'success' : 'secondary'} className="uppercase mt-1 text-sm">
            {campaign.status}
          </Badge>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap space-x-2 border-b border-slate-200">
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'performa' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('performa')}
        >
          <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Performa</div>
        </button>
        
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'approval' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('approval')}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4"/> Listing Kreator
            {campaign.require_client_approval && approvalList.filter((cc: any) => cc.client_approval === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                {approvalList.filter((cc: any) => cc.client_approval === 'pending').length}
              </span>
            )}
          </div>
        </button>

        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sampel' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('sampel')}
        >
          <div className="flex items-center gap-2"><Package className="w-4 h-4"/> Sampel & Resi</div>
        </button>
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'live' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('live')}
        >
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4"/> Jadwal Live</div>
        </button>
        <button
          className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'video' as any ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('video' as any)}
        >
          <div className="flex items-center gap-2"><Video className="w-4 h-4"/> Video & Konten</div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-4">
        {activeTab === 'performa' && (
          <div className="space-y-[32px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center flex-wrap gap-[16px]">
              <div>
                <h2 className="text-[20px] font-bold">
                  {campaign.tipe_campaign === 'awareness' || campaign.tipe_campaign === 'gmv_awareness' ? "Performa Awareness Campaign" : "Performa Sales Campaign"}
                </h2>
                <p className="text-[13px] text-slate-500">Analitik pencapaian campaign secara <span className="font-bold text-green-600 border-b border-green-600">Real-Time</span>.</p>
              </div>
            </div>

            <div className="flex flex-col gap-[24px]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-[24px]">
                {/* Total Achievement Card */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-100/50 border border-green-100 rounded-xl overflow-hidden p-[24px] shadow-sm relative">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[13px] font-medium text-green-800">Total Achievement (All)</p>
                      <h3 className="text-[24px] font-bold mt-[8px] text-green-900">Rp {(displayTotalGmv / 1000000).toFixed(1)}M</h3>
                      <p className="text-[11px] font-semibold mt-[4px] text-green-700/80">Rp {displayTotalGmv.toLocaleString()}</p>
                    </div>
                    <div className="p-[12px] bg-white text-green-600 rounded-[12px] shadow-sm"><TrendingUp className="w-6 h-6" /></div>
                  </div>
                  {summary.target_gmv && (
                    <div className="mt-[16px] pt-[16px] border-t border-green-200/50">
                      <div className="flex justify-between text-[11px] mb-[4px] font-medium text-green-800">
                        <span>Target: Rp {(summary.target_gmv / 1000000).toFixed(1)}M</span>
                        <span>{percentGmv}%</span>
                      </div>
                      <div className="w-full bg-green-200/50 rounded-full h-[6px]">
                        <div className="bg-green-600 h-[6px] rounded-full transition-all duration-1000" style={{ width: `${Math.min(percentGmv, 100)}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* GMV Organik Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-[24px] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[13px] font-medium text-slate-500">GMV Organik</p>
                      <h3 className="text-[24px] font-bold mt-[8px] text-slate-800">Rp {(displayOrganic / 1000000).toFixed(1)}M</h3>
                      <p className="text-[11px] font-semibold text-slate-500 mt-[4px]">Rp {displayOrganic.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-400 mt-[4px]">Total dari CSV Penjualan</p>
                    </div>
                    <div className="p-[8px] bg-blue-50 text-blue-600 rounded-[8px]"><Activity className="w-5 h-5" /></div>
                  </div>
                </div>

                {/* GMV Ads Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-[24px] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[13px] font-medium text-slate-500">GMV Ads</p>
                      <h3 className="text-[24px] font-bold mt-[8px] text-slate-800">Rp {(displayAds / 1000000).toFixed(1)}M</h3>
                      <p className="text-[11px] font-semibold text-slate-500 mt-[4px]">Rp {displayAds.toLocaleString()}</p>
                      <p className="text-[11px] text-slate-400 mt-[4px]">Total dari Impor Iklan</p>
                    </div>
                    <div className="p-[8px] bg-purple-50 text-purple-600 rounded-[8px]"><BarChart3 className="w-5 h-5" /></div>
                  </div>
                </div>

                {/* Target Creator Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-[24px] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[13px] font-medium text-slate-500">Target Creator</p>
                      <h3 className="text-[24px] font-bold mt-[8px] text-slate-800">{approvalList.length} <span className="text-[13px] text-slate-500 font-normal">kreator</span></h3>
                    </div>
                    <div className="p-[8px] bg-orange-50 text-orange-600 rounded-[8px]"><Users className="w-5 h-5" /></div>
                  </div>
                  {summary.target_creator && (
                    <div className="mt-[16px] pt-[16px] border-t border-slate-100">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-[4px] font-medium">
                        <span>Target: {summary.target_creator}</span>
                        <span>{Math.round((approvalList.length / summary.target_creator) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-[6px] flex overflow-hidden">
                        <div className="bg-orange-500 h-[6px] transition-all duration-1000" style={{ width: `${Math.min(Math.round((approvalList.length / summary.target_creator) * 100), 100)}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Table Performa Kreator */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50/50 p-[16px] flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-[8px] text-slate-800">
                    Performa per Kreator (Approved)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <Table className="w-full text-[13px] whitespace-nowrap">
                    <TableHeader className="bg-white border-b border-slate-200">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="py-[16px]">Creator</TableHead>
                        <TableHead className="py-[16px] text-center">Total VT</TableHead>
                        <TableHead className="py-[16px] text-center">Item Sold</TableHead>
                        <TableHead className="py-[16px] text-right">GMV Organik</TableHead>
                        <TableHead className="py-[16px] text-right">GMV Ads</TableHead>
                        <TableHead className="py-[16px] text-right">Total GMV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvalList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-[32px] text-slate-500">Belum ada data kreator yang di-approve.</TableCell>
                        </TableRow>
                      ) : (
                        [...approvalList].sort((a: any, b: any) => {
                          const gmvA = (a.gmv_organic || 0) + (a.gmv_ads || 0);
                          const gmvB = (b.gmv_organic || 0) + (b.gmv_ads || 0);
                          return gmvB - gmvA;
                        }).map((c: any) => {
                          const username = c.creators?.username || 'Unknown';
                          const totalVt = c.videos?.length || 0;
                          const itemsSold = c.items_sold || 0;
                          const gmvOrganic = c.gmv_organic || 0;
                          const gmvAds = c.gmv_ads || 0;
                          const totalGmv = gmvOrganic + gmvAds;

                          return (
                            <TableRow key={c.id} className="transition-all duration-300 hover:bg-slate-50">
                              <TableCell className="font-semibold text-blue-600">
                                @{username}
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                {totalVt}
                              </TableCell>
                              <TableCell className="text-center font-bold">
                                {itemsSold} pcs
                              </TableCell>
                              <TableCell className="text-right text-slate-500">
                                Rp {gmvOrganic.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-slate-500">
                                Rp {gmvAds.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                Rp {totalGmv.toLocaleString()}
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
          </div>
        )}

        {activeTab === 'approval' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="bg-blue-50 border-b border-blue-100 rounded-t-xl">
                <CardTitle className="text-blue-900">Daftar Listing Kreator</CardTitle>
                <p className="text-sm text-blue-700">
                  Berikut adalah daftar kreator yang diajukan untuk campaign ini. 
                  {campaign.require_client_approval && " Silakan tentukan apakah Anda setuju untuk bekerja sama dengan mereka."}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white">
                      <TableRow>
                        <TableHead className="w-48">Kreator</TableHead>
                        <TableHead>Followers</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Tipe Konten</TableHead>
                        <TableHead>Progres Sampel</TableHead>
                        <TableHead className="w-48 text-center">Status Approval</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvalList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">Belum ada kreator yang diajukan.</TableCell>
                        </TableRow>
                      ) : (
                        approvalList.map((cc: any) => (
                          <TableRow key={cc.id}>
                            <TableCell className="align-top">
                              <div className="font-semibold text-slate-900">@{cc.creators?.username}</div>
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {cc.followers ? cc.followers.toLocaleString() : '-'}
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {cc.level || '-'}
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline" className="capitalize text-xs">{cc.tier || '-'}</Badge>
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {cc.content_type || '-'}
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {cc.sample_progress || 'Belum dikirim'}
                            </TableCell>
                            <TableCell className="align-top text-center">
                              {campaign.require_client_approval ? (
                                cc.client_approval === 'pending' ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => handleApproval(cc.id, 'approved')}
                                      disabled={isApproving === cc.id}
                                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
                                    >
                                      Setuju
                                    </button>
                                    <button 
                                      onClick={() => handleApproval(cc.id, 'rejected')}
                                      disabled={isApproving === cc.id}
                                      className="bg-red-100 hover:bg-red-200 text-red-700 text-xs px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
                                    >
                                      Tolak
                                    </button>
                                  </div>
                                ) : (
                                  <Badge variant={cc.client_approval === 'approved' ? 'success' : 'destructive'} className="uppercase shadow-sm">
                                    {cc.client_approval === 'approved' ? 'DISETUJUI' : 'DITOLAK'}
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="success" className="uppercase shadow-sm">
                                  DISETUJUI
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'sampel' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Status Pengiriman Sampel</CardTitle>
                <p className="text-sm text-slate-500">
                  Pantau resi dan status pengiriman produk ke kreator yang telah disetujui.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto pb-4">
                  <Table className="w-full whitespace-nowrap text-[13px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="py-[16px] px-3">No</TableHead>
                        <TableHead className="py-[16px] px-3 min-w-[150px]">Product</TableHead>
                        <TableHead className="py-[16px] px-3">Username</TableHead>
                        <TableHead className="py-[16px] px-3">No Whatsapp</TableHead>
                        <TableHead className="py-[16px] px-3 min-w-[150px]">Nama Penerima</TableHead>
                        <TableHead className="py-[16px] px-3 min-w-[200px]">Nama Jalan</TableHead>
                        <TableHead className="py-[16px] px-3">Provinsi</TableHead>
                        <TableHead className="py-[16px] px-3">Kabupaten/Kota</TableHead>
                        <TableHead className="py-[16px] px-3">Kecamatan</TableHead>
                        <TableHead className="py-[16px] px-3">Kelurahan</TableHead>
                        <TableHead className="py-[16px] px-3">Kode Pos</TableHead>
                        <TableHead className="py-[16px] px-3 min-w-[120px]">Proses</TableHead>
                        <TableHead className="py-[16px] px-3">Tanggal Kirim</TableHead>
                        <TableHead className="py-[16px] px-3">Resi</TableHead>
                        <TableHead className="py-[16px] px-3 min-w-[150px]">Notes</TableHead>
                        <TableHead className="py-[16px] px-3">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {samples.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={16} className="text-center py-8 text-slate-500">Belum ada data pengiriman sampel.</TableCell>
                        </TableRow>
                      ) : (
                        samples.map((addr: any, idx: number) => {
                          const cc = approvalList.find((c: any) => c.id === addr.campaign_creator_id);
                          const skuNames = (cc?.assigned_sku_ids || []).map((id: number) => {
                            const sku = skus?.find((s: any) => s.id === id);
                            return sku ? sku.nama_produk : '';
                          }).filter(Boolean);
                          const noWhatsapp = cc?.no_whatsapp || '-';

                          return (
                            <TableRow key={addr.id} className="hover:bg-slate-50/50">
                              <TableCell className="px-3 py-3 text-center">{idx + 1}</TableCell>
                              <TableCell className="px-3 py-3 whitespace-normal">
                                <div className="flex flex-col gap-1 w-[200px]">
                                  {skuNames.length > 0 ? (
                                    skuNames.map((name: string, i: number) => (
                                      <span key={i} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded border border-blue-100">{name}</span>
                                    ))
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">Belum dipilih</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-3 font-medium">@{addr.creator_username}</TableCell>
                              <TableCell className="px-3 py-3">{noWhatsapp}</TableCell>
                              <TableCell className="px-3 py-3">{addr.nama_penerima || '-'}</TableCell>
                              <TableCell className="px-3 py-3 whitespace-normal">{addr.nama_jalan || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.provinsi || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kabupaten_kota || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kecamatan || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kelurahan || '-'}</TableCell>
                              <TableCell className="px-3 py-3">{addr.kode_pos || '-'}</TableCell>
                              <TableCell className="px-3 py-3">
                                <select className="w-full text-[12px] p-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white" defaultValue={addr.proses || 'Diproses'} onChange={e => handleUpdateResi(addr.id, addr.resi || '', e.target.value, undefined, addr.notes || '')}>
                                  <option value="Diproses">Diproses</option>
                                  <option value="Dikirim">Dikirim</option>
                                  <option value="Diterima">Diterima</option>
                                  <option value="Kendala [FUI]">Kendala [FUI]</option>
                                  <option value="Batal">Batal</option>
                                </select>
                              </TableCell>
                              <TableCell className="px-3 py-3">{addr.tanggal_kirim || '-'}</TableCell>
                              <TableCell className="px-3 py-3 font-mono">
                                <input type="text" className="w-full text-[12px] p-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[120px]" placeholder="Input resi..." defaultValue={addr.resi || ''} onBlur={e => { if (e.target.value !== addr.resi) handleUpdateResi(addr.id, e.target.value, addr.proses || 'Diproses', undefined, addr.notes || '') }} />
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-normal">
                                <input type="text" className="w-full text-[12px] p-1 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[150px]" placeholder="Notes..." defaultValue={addr.notes || ''} onBlur={e => { if (e.target.value !== addr.notes) handleUpdateResi(addr.id, addr.resi || '', addr.proses || 'Diproses', undefined, e.target.value) }} />
                              </TableCell>
                              <TableCell className="px-3 py-3 text-center">
                                <span className="inline-block px-[8px] py-[2px] border border-slate-200 rounded-[4px] text-[10px] font-semibold text-slate-500 uppercase bg-slate-100">
                                  {cc?.client_approval === 'NOT_REQUIRED' ? 'APPROVED' : (cc?.client_approval || 'pending')}
                                </span>
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

        {activeTab === 'live' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Jadwal Live Kreator</CardTitle>
                <p className="text-sm text-slate-500">Jadwal sesi live streaming yang telah disepakati.</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-48">Kreator</TableHead>
                        <TableHead>Tanggal Live</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-8 text-slate-500">Belum ada jadwal live terdaftar.</TableCell>
                        </TableRow>
                      ) : (
                        schedules.map((l: any) => (
                          <TableRow key={l.id}>
                            <TableCell className="align-top">
                              <div className="font-medium text-slate-800">@{l.creator_username}</div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant="outline" className="px-3 py-1 text-blue-700 bg-blue-50 border-blue-200 text-sm">
                                {new Date(l.tanggal_live).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'video' as any && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="bg-blue-50 border-b border-blue-100 rounded-t-xl">
                <CardTitle className="text-blue-900">Daftar Video Konten</CardTitle>
                <p className="text-sm text-blue-700">
                  Berikut adalah daftar video TikTok yang telah dibuat dan diposting oleh kreator.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white">
                      <TableRow>
                        <TableHead className="w-16 text-center">No</TableHead>
                        <TableHead className="w-48">Kreator</TableHead>
                        <TableHead>Link Video</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Likes</TableHead>
                        <TableHead className="text-right">Sales GMV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!videos || videos.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-500">Belum ada video yang disubmit.</TableCell>
                        </TableRow>
                      ) : (
                        videos.map((v: any, index: number) => (
                          <TableRow key={v.id || index} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="text-center text-slate-500">{index + 1}</TableCell>
                            <TableCell className="font-medium text-slate-900">@{v.creator_username}</TableCell>
                            <TableCell>
                              {v.link_video ? (
                                <a href={v.link_video} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 text-sm">
                                  <Video className="w-4 h-4" /> Nonton di TikTok
                                </a>
                              ) : (
                                <span className="text-slate-400 text-sm">Belum ada link</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-slate-400">-</TableCell>
                            <TableCell className="text-right text-slate-400">-</TableCell>
                            <TableCell className="text-right font-semibold text-green-700">
                              Rp {(v.gmv || 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
