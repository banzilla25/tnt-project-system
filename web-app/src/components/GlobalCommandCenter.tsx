"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, ChevronDown, ChevronUp, CheckSquare, Square, CheckCircle, ShieldAlert } from 'lucide-react';
import { 
  fetchCommandCenterBatches, 
  bulkApproveManager, 
  bulkApproveExecutive1, 
  bulkApproveExecutiveFinal 
} from '@/app/campaigns/actions/paymentActions';

export function GlobalCommandCenter({ role, onSuccess }: { role: string, onSuccess?: () => void }) {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
  const [selectedBatches, setSelectedBatches] = useState<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchCommandCenterBatches();
      
      // Filter based on role
      let filtered = data || [];
      if (role === 'manager') {
        filtered = filtered.filter(b => b.status === 'pending_manager');
      } else if (role === 'executive') {
        filtered = filtered.filter(b => ['pending_manager', 'pending_executive_1', 'pending_executive'].includes(b.status));
      }
      
      setBatches(filtered);
      // Auto expand all
      setExpandedBatches(new Set(filtered.map(b => b.id)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpand = (id: number) => {
    const next = new Set(expandedBatches);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedBatches(next);
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedBatches);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBatches(next);
  };

  const handleSelectAll = () => {
    if (selectedBatches.size === batches.length) {
      setSelectedBatches(new Set());
    } else {
      setSelectedBatches(new Set(batches.map(b => b.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedBatches.size === 0) return;
    if (!confirm(`Anda yakin ingin memproses ${selectedBatches.size} batch pengajuan ini?`)) return;

    setIsSubmitting(true);
    try {
      const ids = Array.from(selectedBatches);
      if (role === 'manager') {
        await bulkApproveManager(ids);
      } else if (role === 'executive') {
        // Executive can approve multiple statuses. 
        // We can split them by current status and call appropriate function
        const toExec1 = batches.filter(b => ids.includes(b.id) && ['pending_manager', 'pending_executive_1'].includes(b.status)).map(b => b.id);
        const toExecFinal = batches.filter(b => ids.includes(b.id) && b.status === 'pending_executive').map(b => b.id);
        
        if (toExec1.length > 0) await bulkApproveExecutive1(toExec1);
        if (toExecFinal.length > 0) await bulkApproveExecutiveFinal(toExecFinal);
      }
      
      alert("Berhasil memproses semua batch terpilih!");
      setSelectedBatches(new Set());
      loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert("Gagal memproses bulk approve: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Semua Beres!</h3>
        <p className="text-slate-500">Tidak ada pengajuan yang membutuhkan persetujuan Anda saat ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Tumpukan Persetujuan
          </h2>
          <p className="text-sm text-slate-500">Centang batch yang ingin disetujui, lalu klik Approve Selected di bawah.</p>
        </div>
        <button
          onClick={handleSelectAll}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {selectedBatches.size === batches.length ? 'Batal Pilih Semua' : 'Pilih Semua Batch'}
        </button>
      </div>

      <div className="space-y-4">
        {batches.map((batch) => {
          const isExpanded = expandedBatches.has(batch.id);
          const isSelected = selectedBatches.has(batch.id);
          
          let totalNominal = 0;
          batch.payment_items?.forEach((i: any) => { totalNominal += Number(i.nominal) || 0; });

          return (
            <div key={batch.id} className={`bg-white rounded-xl border transition-all ${isSelected ? 'border-blue-400 shadow-md ring-2 ring-blue-50' : 'border-slate-200 shadow-sm'}`}>
              <div 
                className={`p-4 flex items-center justify-between cursor-pointer ${isExpanded ? 'border-b border-slate-100' : ''}`}
                onClick={() => toggleExpand(batch.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div 
                    className="p-2 -m-2 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(batch.id); }}
                  >
                    {isSelected ? <CheckSquare className="w-6 h-6 text-blue-600" /> : <Square className="w-6 h-6 text-slate-300 hover:text-slate-500" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{batch.batch_label}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>{batch.campaigns?.nama || 'Campaign Tidak Diketahui'}</span>
                      <span>•</span>
                      <span>Oleh: {batch.submitter?.nama}</span>
                      <span>•</span>
                      <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-700">{batch.status}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-slate-500">Total Tagihan</div>
                    <div className="font-bold text-slate-800">Rp {totalNominal.toLocaleString()}</div>
                  </div>
                  <button className="text-slate-400 hover:text-slate-700">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 bg-slate-50/50 rounded-b-xl overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                        <th className="pb-2 pl-2">ID Trx / Kategori</th>
                        <th className="pb-2">Kreator / Deskripsi</th>
                        <th className="pb-2">Pembayaran ke</th>
                        <th className="pb-2 text-right">Nominal</th>
                        <th className="pb-2 text-center pr-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batch.payment_items?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="py-3 pl-2">
                            <div className="font-mono text-xs text-slate-500">{item.transaction_id || '-'}</div>
                            <div className="text-[11px] uppercase font-bold text-slate-400 mt-0.5">{item.payment_type}</div>
                          </td>
                          <td className="py-3">
                            {item.campaign_creators ? (
                              <div>
                                <div className="font-semibold text-slate-800">@{item.campaign_creators?.creators?.username}</div>
                                <div className="text-xs text-slate-500">{item.campaign_creators?.tier}</div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-slate-800">Operasional</div>
                                <div className="text-xs text-slate-500 line-clamp-1">{item.notes_dari_pic}</div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-slate-600">
                            <div>{item.nama_penerima}</div>
                            <div className="text-xs text-slate-400">{item.metode_pembayaran}</div>
                          </td>
                          <td className="py-3 text-right font-bold text-slate-800">
                            Rp {Number(item.nominal).toLocaleString()}
                          </td>
                          <td className="py-3 text-center pr-2">
                            <span className="text-[11px] font-medium px-2 py-1 bg-slate-200 text-slate-600 rounded">
                              {item.final_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Action Bar */}
      {selectedBatches.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] p-4 z-50 flex items-center justify-between sm:justify-center gap-6 animate-in slide-in-from-bottom-5">
          <div className="font-semibold text-slate-800">
            {selectedBatches.size} Batch Terpilih
          </div>
          <button
            onClick={handleBulkApprove}
            disabled={isSubmitting}
            className="btn btn-primary px-8 py-2.5 text-base shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</span>
            ) : (
              `Approve Selected (${selectedBatches.size})`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
