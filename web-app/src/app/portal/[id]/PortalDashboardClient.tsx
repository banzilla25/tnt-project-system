"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TrendingUp, Video, Users, Package, Calendar, CheckCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { submitClientApproval, updateResiByClient } from "../actions/portalActions";
import { useRouter } from "next/navigation";

export default function PortalDashboardClient({ data, campaignId }: { data: any, campaignId: number }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'performa' | 'approval' | 'sampel' | 'live'>('performa');
  const [isApproving, setIsApproving] = useState<number | null>(null);

  const { campaign, summary, dailyPerf, approvalList, samples, schedules, skus } = data;
  const percentGmv = summary.target_gmv ? Math.round((summary.total_gmv_achievement / summary.target_gmv) * 100) : 0;
  const percentVideo = summary.target_video ? Math.round((summary.achievement_video / summary.target_video) * 100) : 0;

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

  const handleUpdateResi = async (addrId: number, resi: string, proses: string, produk?: string) => {
    try {
      await updateResiByClient(campaignId, addrId, resi, proses, produk);
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
        
        {campaign.require_client_approval && (
          <button
            className={`py-3 px-4 md:px-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'approval' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('approval')}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4"/> Approval Kreator
              {approvalList.filter((cc: any) => cc.client_approval === 'pending').length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                  {approvalList.filter((cc: any) => cc.client_approval === 'pending').length}
                </span>
              )}
            </div>
          </button>
        )}

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
      </div>

      {/* Tab Content */}
      <div className="pt-4">
        {activeTab === 'performa' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total GMV</p>
                      <h3 className="text-3xl font-bold mt-2 text-slate-900">Rp {summary.total_gmv_achievement?.toLocaleString() || 0}</h3>
                      <div className="mt-2 text-sm text-slate-500">
                        Target: Rp {summary.target_gmv?.toLocaleString() || '-'} 
                        <span className={`ml-2 font-bold ${percentGmv >= 100 ? 'text-green-600' : 'text-blue-600'}`}>({percentGmv}%)</span>
                      </div>
                    </div>
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><TrendingUp className="w-6 h-6" /></div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-4">
                    <div className={`h-2 rounded-full ${percentGmv >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(percentGmv, 100)}%` }}></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Video Tayang</p>
                      <h3 className="text-3xl font-bold mt-2 text-slate-900">{summary.achievement_video || 0} Video</h3>
                      <div className="mt-2 text-sm text-slate-500">
                        Target: {summary.target_video || '-'} Video
                        <span className="ml-2 font-bold text-purple-600">({percentVideo}%)</span>
                      </div>
                    </div>
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><Video className="w-6 h-6" /></div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-4">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(percentVideo, 100)}%` }}></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Kreator</p>
                      <h3 className="text-3xl font-bold mt-2 text-slate-900">{approvalList.length} Kreator</h3>
                      <div className="mt-2 text-sm text-slate-500">
                        Target: {summary.target_creator || '-'} Kreator
                      </div>
                    </div>
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><Users className="w-6 h-6" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* GMV Breakdown */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Rincian Pendapatan (Berdasarkan Sistem)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 border rounded-xl bg-slate-50">
                    <p className="text-sm text-slate-500">Organik (Affiliate)</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">Rp {(summary.total_daily_organic || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-4 border rounded-xl bg-slate-50">
                    <p className="text-sm text-slate-500">Iklan (Ads Manager)</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">Rp {(summary.total_daily_vsa || 0).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'approval' && campaign.require_client_approval && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="bg-blue-50 border-b border-blue-100 rounded-t-xl">
                <CardTitle className="text-blue-900">Persetujuan Kreator</CardTitle>
                <p className="text-sm text-blue-700">
                  Berikut adalah daftar kreator yang diajukan oleh tim manajemen kami. Silakan tentukan apakah Anda setuju untuk bekerja sama dengan mereka.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-white">
                      <TableRow>
                        <TableHead className="w-64">Kreator</TableHead>
                        <TableHead>Link Akun</TableHead>
                        <TableHead>Catatan dari Manajer</TableHead>
                        <TableHead className="w-48 text-center">Tindakan</TableHead>
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
                              <div className="text-sm text-slate-500">{cc.creators?.nama_asli || '-'}</div>
                            </TableCell>
                            <TableCell className="align-top">
                              {cc.creators?.link_account ? (
                                <a href={cc.creators.link_account} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm truncate max-w-xs block">
                                  Lihat Profil TikTok
                                </a>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="align-top text-sm text-slate-600">
                              {cc.notes_pic || <span className="italic text-slate-400">Tidak ada catatan</span>}
                            </TableCell>
                            <TableCell className="align-top text-center">
                              {cc.client_approval === 'pending' ? (
                                <div className="flex items-center justify-center gap-2">
                                  <button 
                                    onClick={() => handleApproval(cc.id, 'approved')}
                                    disabled={isApproving === cc.id}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded disabled:opacity-50"
                                  >
                                    Setuju
                                  </button>
                                  <button 
                                    onClick={() => handleApproval(cc.id, 'rejected')}
                                    disabled={isApproving === cc.id}
                                    className="bg-red-100 hover:bg-red-200 text-red-700 text-xs px-3 py-1.5 rounded disabled:opacity-50"
                                  >
                                    Tolak
                                  </button>
                                </div>
                              ) : (
                                <Badge variant={cc.client_approval === 'approved' ? 'success' : 'destructive'} className="uppercase">
                                  {cc.client_approval === 'approved' ? 'DISETUJUI' : 'DITOLAK'}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-48">Kreator</TableHead>
                        <TableHead>Alamat Pengiriman</TableHead>
                        <TableHead className="w-48">Produk Dikirim</TableHead>
                        <TableHead className="w-48">No. Resi</TableHead>
                        <TableHead className="w-40">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {samples.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-slate-500">Belum ada data pengiriman sampel.</TableCell>
                        </TableRow>
                      ) : (
                        samples.map((addr: any) => (
                          <TableRow key={addr.id}>
                            <TableCell className="align-top">
                              <div className="font-medium text-slate-800">@{addr.creator_username}</div>
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              <div className="font-semibold">{addr.nama_penerima || '-'}</div>
                              <div className="text-slate-600 mt-1">{addr.nohp_penerima || '-'}</div>
                              <div className="text-slate-500 mt-1">
                                {addr.nama_jalan}<br/>
                                {addr.kecamatan && `${addr.kecamatan}, `}{addr.kabupaten_kota}<br/>
                                {addr.provinsi} {addr.kode_pos}
                              </div>
                              {addr.catatan && (
                                <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                                  <strong>Catatan:</strong> {addr.catatan}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="align-top font-mono text-sm">
                              <select
                                className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                defaultValue={addr.produk_dikirim || ''}
                                onChange={(e) => {
                                  if (e.target.value !== addr.produk_dikirim) {
                                    handleUpdateResi(addr.id, addr.resi || '', addr.proses || 'Diproses', e.target.value);
                                  }
                                }}
                              >
                                <option value="">-- Pilih Produk --</option>
                                {skus?.map((s: any) => (
                                  <option key={s.id} value={s.nama_produk}>{s.nama_produk}</option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="align-top font-mono text-sm">
                              <input
                                type="text"
                                className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Input No. Resi..."
                                defaultValue={addr.resi || ''}
                                onBlur={(e) => {
                                  if (e.target.value !== addr.resi) {
                                    handleUpdateResi(addr.id, e.target.value, addr.proses || 'Diproses', addr.produk_dikirim || '');
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <select
                                className={`w-full text-sm p-2 border rounded font-medium outline-none transition-colors
                                  ${addr.proses === 'Dikirim' || addr.proses === 'Diterima' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-700 border-slate-300'}`}
                                defaultValue={addr.proses || 'Diproses'}
                                onChange={(e) => handleUpdateResi(addr.id, addr.resi || '', e.target.value, addr.produk_dikirim || '')}
                              >
                                <option value="Diproses">Diproses</option>
                                <option value="Dikirim">Dikirim</option>
                                <option value="Diterima">Diterima</option>
                                <option value="Batal">Batal</option>
                              </select>
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
      </div>
    </div>
  );
}
