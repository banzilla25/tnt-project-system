"use client";

import React, { useState } from "react";
import { PaymentStepper } from "@/components/PaymentStepper";
import { managerApproveItem, managerRejectItem, managerFinalizeReview, financeToggleItem, financeSubmitToExecutive, financeMarkPaid, executiveApproveItem, executiveRejectItem, executiveFinalizeReview } from "../../actions/paymentActions";
import { useAuth } from "@/providers/AuthProvider";
import { Check, X, Loader2, ArrowLeft, Send } from "lucide-react";

export function BatchDetail({ batch, onBack, onRefresh }: { batch: any, onBack: () => void, onRefresh: () => void }) {
  const { profile } = useAuth();
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  // Mark Paid form state
  const [showPaidForm, setShowPaidForm] = useState(false);
  const [payDate, setPayDate] = useState("");
  const [buktiUrl, setBuktiUrl] = useState("");
  
  // TODO: sender accounts should be fetched, but for simplicity here we assume 1 (PT TNT) or hardcoded unless we pass it down
  // Since we need senderAccountId, we could pass it or fetch it. Let's assume ID 1 for now if not selected, or we should fetch it.
  
  const handleAction = async (id: number, action: () => Promise<void>) => {
    setLoadingIds(prev => ({ ...prev, [id]: true }));
    try {
      await action();
      await onRefresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoadingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleFinalize = async (action: () => Promise<void>) => {
    if (!confirm("Yakin ingin menyelesaikan review dan submit ke tahap selanjutnya?")) return;
    setIsFinalizing(true);
    try {
      await action();
      await onRefresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId || !rejectReason) return;
    const action = batch.status === 'pending_manager' 
      ? () => managerRejectItem(rejectingId, rejectReason)
      : () => executiveRejectItem(rejectingId, rejectReason);
    
    await handleAction(rejectingId, action);
    setRejectingId(null);
    setRejectReason("");
  };

  const handleMarkPaid = async () => {
    if (!payDate || !buktiUrl) return alert("Lengkapi data pembayaran");
    setIsFinalizing(true);
    try {
      await financeMarkPaid(batch.id, {
        actualPaymentDate: payDate,
        buktiTransferUrl: buktiUrl,
        senderAccountId: 1 // Default to 1 (PT TNT)
      });
      await onRefresh();
      setShowPaidForm(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="btn btn-outline flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-8">
        <div className="flex justify-between items-start border-b border-slate-100 pb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{batch.batch_label}</h2>
            <p className="text-sm text-slate-500 mt-1">Campaign: {batch.campaigns?.nama}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-700">Total Nominal: Rp {batch.payment_items.reduce((acc: number, item: any) => acc + Number(item.nominal) + Number(item.biaya_transfer), 0).toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">{batch.payment_items.length} Kreator diajukan</p>
          </div>
        </div>

        <PaymentStepper 
          status={batch.status}
          submitterName={batch.submitter?.nama}
          submitDate={batch.submitted_at}
          managerName={batch.manager?.nama}
          managerDate={batch.manager_reviewed_at}
          financeName={batch.finance?.nama}
          financeDate={batch.finance_reviewed_at}
          executiveName={batch.executive?.nama}
          executiveDate={batch.executive_reviewed_at}
          payerName={batch.payer?.nama}
          payDate={batch.paid_at}
        />

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3">Kreator</th>
                <th className="px-4 py-3">Tipe Pembayaran</th>
                <th className="px-4 py-3 text-right">Ratecard / Final</th>
                <th className="px-4 py-3 text-right">Biaya TF</th>
                <th className="px-4 py-3 text-right">Total Transaksi</th>
                <th className="px-4 py-3">Rekening</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batch.payment_items.map((item: any) => {
                const totalTrx = Number(item.nominal) + Number(item.biaya_transfer);
                const bank = item.creator_bank_accounts;
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      @{item.campaign_creators?.creators?.username}
                      <div className="text-xs text-slate-400 font-normal">{item.nama_penerima || bank?.account_holder}</div>
                    </td>
                    <td className="px-4 py-3 uppercase text-xs font-bold text-slate-500">
                      {item.payment_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.ratecard_awal && <div className="text-xs text-slate-400 line-through">Rp {Number(item.ratecard_awal).toLocaleString()}</div>}
                      <div className="font-semibold text-slate-700">Rp {Number(item.nominal).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">Rp {Number(item.biaya_transfer).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">Rp {totalTrx.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs">
                      {bank ? (
                        <>
                          <span className="font-semibold">{bank.bank_name}</span><br/>
                          {bank.account_number}
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">{item.metode_pembayaran}</span><br/>
                          {item.nomor_rekening}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.final_status === 'paid' ? 'bg-green-100 text-green-700' :
                        item.final_status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {item.final_status.replace('_', ' ')}
                      </span>
                      {item.manager_note || item.executive_note ? (
                        <div className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={item.manager_note || item.executive_note}>
                          Note: {item.manager_note || item.executive_note}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {/* MANAGER ACTIONS */}
                      {batch.status === 'pending_manager' && profile?.role === 'manager' && item.final_status === 'pending' && (
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleAction(item.id, () => managerApproveItem(item.id))} disabled={loadingIds[item.id]} className="p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200">
                            {loadingIds[item.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setRejectingId(item.id)} disabled={loadingIds[item.id]} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* FINANCE ACTIONS */}
                      {batch.status === 'pending_finance' && profile?.role === 'finance' && item.final_status === 'manager_approved' && (
                        <label className="flex items-center justify-center cursor-pointer">
                          <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                            onChange={(e) => handleAction(item.id, () => financeToggleItem(item.id, e.target.checked))} 
                            disabled={loadingIds[item.id]}
                          />
                        </label>
                      )}
                      {batch.status === 'pending_finance' && profile?.role === 'finance' && item.final_status === 'finance_selected' && (
                        <label className="flex items-center justify-center cursor-pointer">
                          <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                            checked={true}
                            onChange={(e) => handleAction(item.id, () => financeToggleItem(item.id, e.target.checked))} 
                            disabled={loadingIds[item.id]}
                          />
                        </label>
                      )}

                      {/* EXECUTIVE ACTIONS */}
                      {batch.status === 'pending_executive' && profile?.role === 'executive' && item.final_status === 'finance_selected' && (
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleAction(item.id, () => executiveApproveItem(item.id))} disabled={loadingIds[item.id]} className="p-1.5 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200">
                            {loadingIds[item.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setRejectingId(item.id)} disabled={loadingIds[item.id]} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Reject Modal */}
        {rejectingId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Tolak Pembayaran</h3>
              <textarea 
                className="w-full border border-slate-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="Alasan penolakan..."
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md">Batal</button>
                <button onClick={handleRejectSubmit} disabled={loadingIds[rejectingId]} className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center">
                  {loadingIds[rejectingId] ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Tolak
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex justify-end pt-6 border-t border-slate-100 gap-4">
          {batch.status === 'pending_manager' && profile?.role === 'manager' && (
            <button onClick={() => handleFinalize(() => managerFinalizeReview(batch.id))} disabled={isFinalizing} className="btn btn-primary flex items-center gap-2">
              {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Finalize Review & Submit ke Finance
            </button>
          )}
          {batch.status === 'pending_finance' && profile?.role === 'finance' && (
            <button onClick={() => handleFinalize(() => financeSubmitToExecutive(batch.id))} disabled={isFinalizing} className="btn btn-primary flex items-center gap-2">
              {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Request Approval Executive
            </button>
          )}
          {batch.status === 'pending_executive' && profile?.role === 'executive' && (
            <button onClick={() => handleFinalize(() => executiveFinalizeReview(batch.id))} disabled={isFinalizing} className="btn btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
              {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Finalize & Tandai Siap Bayar
            </button>
          )}
          {batch.status === 'ready_to_pay' && profile?.role === 'finance' && !showPaidForm && (
            <button onClick={() => setShowPaidForm(true)} className="btn btn-primary flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
              <Check className="w-4 h-4" /> Tandai Sudah Dibayar
            </button>
          )}
        </div>

        {/* Paid Form */}
        {showPaidForm && (
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mt-4">
            <h3 className="font-bold text-slate-800 mb-4">Konfirmasi Pembayaran</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal Aktual Transfer</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Link Bukti Transfer (GDrive)</label>
                <input type="url" placeholder="https://drive.google.com/..." value={buktiUrl} onChange={e => setBuktiUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowPaidForm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md">Batal</button>
              <button onClick={handleMarkPaid} disabled={isFinalizing} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />} Simpan Pembayaran
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
