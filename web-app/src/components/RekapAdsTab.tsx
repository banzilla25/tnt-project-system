import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { fetchPendingAdsTopUp, fetchMutationsPaginated } from '../app/campaigns/actions/paymentActions';

export function RekapAdsTab() {
  const [pendingAds, setPendingAds] = useState<any[]>([]);
  const [paidAds, setPaidAds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pendingRes, paidRes] = await Promise.all([
        fetchPendingAdsTopUp(),
        fetchMutationsPaginated(1, 10, 'all', '', 'ads')
      ]);
      setPendingAds(pendingRes || []);
      setPaidAds(paidRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPending = pendingAds.reduce((sum, item) => sum + (Number(item.actual_transfer || item.nominal || 0) + Number(item.biaya_transfer || 0)), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_finance': return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold uppercase">Menunggu Finance</span>;
      case 'pending_executive': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold uppercase">Menunggu Executive</span>;
      case 'ready_to_pay': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase">Siap Bayar</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold uppercase">{status?.replace('_', ' ')}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-500 text-sm">Memuat data Rekap Ads...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Menunggu Pembayaran (Pending Ads)</h3>
            <p className="text-xs text-slate-500">Kumpulan tagihan Top Up Ads dari berbagai campaign yang harus dibayar.</p>
          </div>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold text-lg">
            Total: Rp {totalPending.toLocaleString()}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3">Campaign & Batch</th>
                <th className="px-4 py-3">Penerima & Rekening</th>
                <th className="px-4 py-3 max-w-[150px]">Catatan</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3 text-right">Biaya TF</th>
                <th className="px-4 py-3 text-right">Total Transaksi</th>
                <th className="px-4 py-3 text-center">Status Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pendingAds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada pengajuan Ads yang belum dibayar saat ini.
                  </td>
                </tr>
              ) : (
                pendingAds.map(item => {
                  const nominal = Number(item.actual_transfer || item.nominal || 0);
                  const biayaTf = Number(item.biaya_transfer || 0);
                  const total = nominal + biayaTf;
                  const bankName = item.bank_name || item.metode_pembayaran || 'Bank';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{item.payment_batches?.campaigns?.nama || '-'}</div>
                        <div className="text-[11px] text-slate-500">{item.payment_batches?.batch_label || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-700">{item.nama_penerima || '-'}</div>
                        <div className="text-[11px] text-slate-500">{bankName} - {item.nomor_rekening}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[150px]">
                        <div className="text-[11px] text-slate-600 truncate" title={item.notes}>{item.notes || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">Rp {nominal.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-400 text-xs">Rp {biayaTf.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">Rp {total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(item.payment_batches?.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Paid Section (Preview) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-800">Riwayat Pembayaran Ads (Terbaru)</h3>
          <p className="text-xs text-slate-500">Menampilkan 10 transaksi ads terakhir yang sudah dibayar. Untuk riwayat lengkap, gunakan tab Mutasi Pembayaran.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3">Tanggal Dibayar</th>
                <th className="px-4 py-3">Campaign & Batch</th>
                <th className="px-4 py-3">Penerima</th>
                <th className="px-4 py-3 text-right">Total Transaksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paidAds.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Belum ada riwayat pembayaran ads.
                  </td>
                </tr>
              ) : (
                paidAds.map(item => {
                  const total = (item.nominal || 0) + (item.biaya_transfer || 0);
                  const datePaid = item.paid_at ? new Date(item.paid_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{datePaid}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{item.campaign_nama || '-'}</div>
                        <div className="text-[11px] text-slate-500">{item.batch_label || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-medium">{item.nama_penerima || '-'}</div>
                        <div className="text-[11px] text-slate-500">{item.bank_name || item.metode_pembayaran} - {item.nomor_rekening}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">Rp {total.toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
