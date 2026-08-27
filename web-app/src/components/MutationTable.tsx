import React, { useState, useMemo } from 'react';
import { Download, RefreshCcw, Search, Link } from 'lucide-react';

export function MutationTable({ mutations }: { mutations: any[] }) {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const months = useMemo(() => {
    const uniqueMonths = new Set<string>();
    mutations.forEach(m => {
      if (m.payment_batches?.paid_at) {
        const d = new Date(m.payment_batches.paid_at);
        uniqueMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    return Array.from(uniqueMonths).sort().reverse();
  }, [mutations]);

  const filteredMutations = useMemo(() => {
    return mutations.filter(m => {
      let matchesMonth = true;
      if (selectedMonth !== 'all' && m.payment_batches?.paid_at) {
        const d = new Date(m.payment_batches.paid_at);
        const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        matchesMonth = mStr === selectedMonth;
      }
      let matchesSearch = true;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        matchesSearch = (
          m.nama_penerima?.toLowerCase().includes(s) ||
          m.campaign_creators?.creators?.username?.toLowerCase().includes(s) ||
          m.payment_batches?.campaigns?.nama?.toLowerCase().includes(s)
        );
      }
      return matchesMonth && matchesSearch;
    });
  }, [mutations, selectedMonth, searchTerm]);

  const totalNominal = filteredMutations.reduce((sum, m) => sum + (m.nominal || 0) + (m.biaya_transfer || 0), 0);

  const exportToCSV = () => {
    const headers = ['Tanggal', 'Campaign', 'Batch', 'Penerima', 'Username', 'Rekening', 'Tipe Pembayaran', 'Nominal', 'Biaya Transfer', 'Total', 'Catatan', 'Bukti Transfer'];
    const rows = filteredMutations.map(m => {
      const d = m.payment_batches?.paid_at ? new Date(m.payment_batches.paid_at).toLocaleDateString('id-ID') : '-';
      return [
        d,
        m.payment_batches?.campaigns?.nama || '-',
        m.payment_batches?.batch_label || '-',
        m.nama_penerima || '-',
        m.campaign_creators?.creators?.username || '-',
        `${m.creator_bank_accounts?.bank_name || m.metode_pembayaran || '-'} - ${m.nomor_rekening || '-'}`,
        m.payment_type || '-',
        m.nominal || 0,
        m.biaya_transfer || 0,
        (m.nominal || 0) + (m.biaya_transfer || 0),
        m.notes || '-',
        m.payment_batches?.bukti_transfer || '-'
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Mutasi_Pembayaran_${selectedMonth === 'all' ? 'All' : selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            className="p-2 border border-slate-300 rounded-lg text-sm bg-white min-w-[150px]"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            <option value="all">Semua Bulan</option>
            {months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button 
            onClick={() => setSelectedMonth('all')}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 text-sm border border-transparent"
            title="Reset ke Semua Waktu"
          >
            <RefreshCcw className="w-4 h-4" /> Reset
          </button>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari penerima / campaign..." 
              className="w-full pl-9 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={exportToCSV}
            className="btn btn-outline flex items-center gap-2 py-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-medium whitespace-nowrap">
            <tr>
              <th className="px-4 py-4">Tanggal</th>
              <th className="px-4 py-4">Penerima & Rekening</th>
              <th className="px-4 py-4">Konteks Pembayaran</th>
              <th className="px-4 py-4">Tipe & Catatan</th>
              <th className="px-4 py-4 text-right">Nominal Transfer</th>
              <th className="px-4 py-4 text-center">Bukti</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredMutations.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-32 text-center text-slate-500">
                  Tidak ada data mutasi pembayaran yang sesuai.
                </td>
              </tr>
            ) : (
              filteredMutations.map((m) => {
                const total = (m.nominal || 0) + (m.biaya_transfer || 0);
                const bankName = m.creator_bank_accounts?.bank_name || m.metode_pembayaran || 'Bank';
                const datePaid = m.payment_batches?.paid_at ? new Date(m.payment_batches.paid_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-';
                
                return (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                      {datePaid}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{m.nama_penerima || '-'}</div>
                      <div className="text-xs text-blue-600 mb-1">@{m.campaign_creators?.creators?.username}</div>
                      <div className="text-[11px] bg-slate-100 px-2 py-1 rounded inline-block text-slate-600">
                        {bankName} - {m.nomor_rekening}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{m.payment_batches?.campaigns?.nama}</div>
                      <div className="text-xs text-slate-500">{m.payment_batches?.batch_label}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="inline-block px-2 py-1 bg-green-50 text-green-700 text-[11px] font-semibold rounded-full border border-green-100 mb-1">
                        {m.payment_type}
                      </span>
                      {m.notes && <div className="text-[11px] text-slate-500 truncate" title={m.notes}>{m.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-slate-800">Rp {total.toLocaleString('id-ID')}</div>
                      {m.biaya_transfer > 0 && <div className="text-[10px] text-slate-400">Termasuk fee Rp {m.biaya_transfer.toLocaleString()}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.payment_batches?.bukti_transfer ? (
                        <a href={m.payment_batches.bukti_transfer} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" title="Lihat Bukti Transfer">
                          <Link className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="bg-slate-100 border-t border-slate-200">
            <tr>
              <td colSpan={4} className="px-4 py-4 text-right font-bold text-slate-700">Total Mutasi:</td>
              <td className="px-4 py-4 text-right font-bold text-slate-900 text-lg">Rp {totalNominal.toLocaleString('id-ID')}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
