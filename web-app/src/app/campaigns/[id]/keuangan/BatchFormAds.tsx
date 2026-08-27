"use client";

import React, { useState } from "react";
import { createPaymentBatch, addPaymentItem, submitBatchToManager } from "../../actions/paymentActions";
import { Loader2, ArrowLeft, Send } from "lucide-react";

export function BatchFormAds({ campaignId, onCancel, onSuccess }: { campaignId: number, onCancel: () => void, onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchLabel, setBatchLabel] = useState(`Batch Top Up Ads - ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`);
  
  const [formData, setFormData] = useState({
    nominal: '',
    metode_pembayaran: '',
    nomor_rekening: '',
    nama_penerima: '',
    notes: ''
  });

  const validateForm = () => {
    if (!formData.nominal || Number(formData.nominal) <= 0) return "Nominal Top Up harus diisi dan lebih dari 0";
    return null;
  };

  const handleSave = async (submitToManager: boolean) => {
    const errorMsg = validateForm();
    if (errorMsg) return alert(errorMsg);

    setIsSubmitting(true);
    try {
      // 1. Create Batch
      const batchId = await createPaymentBatch(campaignId, batchLabel);
      
      // 2. Add Item with payment_type = 'ads' and no campaign_creator_id
      await addPaymentItem(batchId, {
        campaign_creator_id: null,
        payment_type: 'ads',
        nominal: formData.nominal,
        metode_pembayaran: formData.metode_pembayaran,
        nomor_rekening: formData.nomor_rekening,
        nama_penerima: formData.nama_penerima,
        notes: formData.notes
      });
      
      // 3. Submit if requested
      if (submitToManager) {
        await submitBatchToManager(batchId);
      }
      
      alert(submitToManager ? "Top Up Ads berhasil disubmit ke Manager!" : "Draft Top Up Ads berhasil disimpan!");
      onSuccess();
    } catch (err: any) {
      alert("Terjadi kesalahan: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onCancel} className="btn btn-outline p-2"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="text-xl font-bold text-slate-800">Ajukan Top Up Ads Baru</h2>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Batch Pembayaran</label>
          <input 
            type="text" 
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            value={batchLabel}
            onChange={e => setBatchLabel(e.target.value)}
          />
        </div>

        <div className="border-t border-slate-100 pt-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nominal Top Up (Rp) <span className="text-red-500">*</span></label>
            <input 
              type="number" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="Contoh: 10000000"
              value={formData.nominal}
              onChange={e => setFormData({...formData, nominal: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Bank / Metode Pembayaran (Opsional)</label>
            <input 
              type="text" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="Contoh: BCA"
              value={formData.metode_pembayaran}
              onChange={e => setFormData({...formData, metode_pembayaran: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nomor Rekening (Opsional)</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="Contoh: 1234567890"
                value={formData.nomor_rekening}
                onChange={e => setFormData({...formData, nomor_rekening: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Atas Nama (Opsional)</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="Contoh: PT Ads Mediatama"
                value={formData.nama_penerima}
                onChange={e => setFormData({...formData, nama_penerima: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Catatan / Detail Ads (Opsional)</label>
            <textarea 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="Tambahkan catatan jika perlu..."
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 flex justify-end gap-3">
          <button 
            className="btn btn-outline" 
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Draft'}
          </button>
          <button 
            className="btn btn-primary flex items-center gap-2"
            onClick={() => handleSave(true)}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Submit ke Manager</>}
          </button>
        </div>
      </div>
    </div>
  );
}
