"use client";

import React, { useState, useEffect } from "react";
import { createPaymentBatch, addPaymentItem, submitBatchToManager, getCreatorBankAccounts } from "../../actions/paymentActions";
import { Loader2, Plus, Trash2, Save, Send, ArrowLeft } from "lucide-react";

export function BatchForm({ campaignId, creators, onCancel, onSuccess }: { campaignId: number, creators: any[], onCancel: () => void, onSuccess: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchLabel, setBatchLabel] = useState(`Batch - ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`);
  
  const [selectedCreators, setSelectedCreators] = useState<any[]>([]);
  const [forms, setForms] = useState<Record<number, any>>({});
  const [bankAccounts, setBankAccounts] = useState<Record<number, any[]>>({});
  const [loadingBanks, setLoadingBanks] = useState<Record<number, boolean>>({});

  const handleSelectCreator = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ccId = Number(e.target.value);
    if (!ccId) return;
    
    const cc = creators.find(c => c.id === ccId);
    if (!cc) return;
    
    if (selectedCreators.find(s => s.id === ccId)) return; // Already selected
    
    setSelectedCreators(prev => [...prev, cc]);
    setForms(prev => ({
      ...prev,
      [ccId]: {
        campaign_creator_id: ccId,
        payment_type: '100_akhir',
        ratecard_awal: cc.price || 0,
        nominal: cc.price || 0,
        biaya_transfer: 0,
        bank_account_id: '',
        metode_pembayaran: '',
        nomor_rekening: '',
        nama_penerima: '',
        nama_wa_pic: '',
        nomor_wa_dealing: '',
        alamat_ktp: '',
        nik: '',
        link_ktp: '',
        link_kontrak: '',
      }
    }));

    // Fetch bank accounts for this creator
    if (!bankAccounts[cc.creator_id]) {
      setLoadingBanks(prev => ({ ...prev, [cc.creator_id]: true }));
      try {
        const banks = await getCreatorBankAccounts(cc.creator_id);
        setBankAccounts(prev => ({ ...prev, [cc.creator_id]: banks }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBanks(prev => ({ ...prev, [cc.creator_id]: false }));
      }
    }
  };

  const handleRemoveCreator = (ccId: number) => {
    setSelectedCreators(prev => prev.filter(c => c.id !== ccId));
    const newForms = { ...forms };
    delete newForms[ccId];
    setForms(newForms);
  };

  const handleChange = (ccId: number, field: string, value: any) => {
    setForms(prev => ({
      ...prev,
      [ccId]: {
        ...prev[ccId],
        [field]: value
      }
    }));
  };

  const validateForms = () => {
    if (selectedCreators.length === 0) return "Pilih minimal 1 kreator";
    for (const cc of selectedCreators) {
      const f = forms[cc.id];
      if (!f.payment_type) return `Pilih tipe pembayaran untuk @${cc.creators?.username}`;
      if (!f.nominal || Number(f.nominal) <= 0) return `Nominal harus lebih dari 0 untuk @${cc.creators?.username}`;
      
      if (!f.bank_account_id) {
        if (!f.metode_pembayaran || !f.nomor_rekening) {
          return `Pilih rekening tersimpan atau isi rekening manual untuk @${cc.creators?.username}`;
        }
      }
      
      if (!f.nama_wa_pic || !f.nomor_wa_dealing || !f.alamat_ktp || !f.nik || !f.link_ktp || !f.link_kontrak) {
        return `Harap lengkapi semua data administrasi (WA, KTP, NIK, Link) untuk @${cc.creators?.username}`;
      }
    }
    return null;
  };

  const handleSave = async (submitToManager: boolean) => {
    const errorMsg = validateForms();
    if (errorMsg) return alert(errorMsg);

    setIsSubmitting(true);
    try {
      // 1. Create Batch
      const batchId = await createPaymentBatch(campaignId, batchLabel);
      
      // 2. Add Items
      for (const cc of selectedCreators) {
        await addPaymentItem(batchId, forms[cc.id]);
      }
      
      // 3. Submit if requested
      if (submitToManager) {
        await submitBatchToManager(batchId);
      }
      
      alert(submitToManager ? "Berhasil disubmit ke Manager!" : "Draft berhasil disimpan!");
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
        <h2 className="text-xl font-bold text-slate-800">Ajukan Pembayaran Baru</h2>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Batch Pembayaran</label>
          <input 
            type="text" 
            className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            value={batchLabel}
            onChange={e => setBatchLabel(e.target.value)}
          />
        </div>

        <div className="border-t border-slate-100 pt-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Kreator (Bisa pilih lebih dari satu)</label>
          <select className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" onChange={handleSelectCreator} value="">
            <option value="" disabled>-- Klik untuk memilih kreator --</option>
            {creators.filter(c => c.approval === 'approved').map(c => (
              <option key={c.id} value={c.id}>
                @{c.creators?.username} - Ratecard: Rp {Number(c.price || 0).toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        {selectedCreators.length > 0 && (
          <div className="space-y-6">
            {selectedCreators.map((cc, idx) => {
              const f = forms[cc.id];
              const banks = bankAccounts[cc.creator_id] || [];
              const isBankLoading = loadingBanks[cc.creator_id];

              return (
                <div key={cc.id} className="border border-blue-100 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2">
                      <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">{idx + 1}</span>
                      @{cc.creators?.username}
                    </h3>
                    <button onClick={() => handleRemoveCreator(cc.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Pembayaran Info */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-slate-700 border-b pb-2">Informasi Pembayaran</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Tipe Pembayaran</label>
                          <select className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.payment_type} onChange={e => handleChange(cc.id, 'payment_type', e.target.value)}>
                            <option value="100_akhir">100% Akhir</option>
                            <option value="50_awal">DP 50% Awal</option>
                            <option value="50_akhir">Pelunasan 50% Akhir</option>
                            <option value="ads">Top Up ADS</option>
                            <option value="crm">Biaya CRM</option>
                            <option value="lion">Ongkir Lion Parcel</option>
                            <option value="reward_affiliate">Bonus Reward Affiliate</option>
                            <option value="boost_views">Boost Views</option>
                            <option value="boost_comment">Boost Comment</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Ratecard Awal</label>
                          <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.ratecard_awal} onChange={e => handleChange(cc.id, 'ratecard_awal', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Nominal Diajukan (Rp)</label>
                          <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.nominal} onChange={e => handleChange(cc.id, 'nominal', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Biaya Transfer (Opsional)</label>
                          <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.biaya_transfer} onChange={e => handleChange(cc.id, 'biaya_transfer', e.target.value)} />
                        </div>
                      </div>

                      <h4 className="font-semibold text-sm text-slate-700 border-b pb-2 pt-2">Rekening Penerima</h4>
                      {isBankLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Memuat rekening...</div>
                      ) : (
                        <div>
                          <select className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500 mb-3" value={f.bank_account_id} onChange={e => handleChange(cc.id, 'bank_account_id', e.target.value)}>
                            <option value="">-- Ketik Manual (Belum Tersimpan) --</option>
                            {banks.map((b: any) => (
                              <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number} ({b.account_holder})</option>
                            ))}
                          </select>

                          {!f.bank_account_id && (
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Metode / Bank</label>
                                <input type="text" placeholder="BCA / DANA / ShopeePay" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.metode_pembayaran} onChange={e => handleChange(cc.id, 'metode_pembayaran', e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Nomor Rekening</label>
                                <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.nomor_rekening} onChange={e => handleChange(cc.id, 'nomor_rekening', e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Nama Penerima</label>
                                <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.nama_penerima} onChange={e => handleChange(cc.id, 'nama_penerima', e.target.value)} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Data Administrasi */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-slate-700 border-b pb-2">Data Administrasi (Wajib)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Nama WA PIC Admin</label>
                          <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.nama_wa_pic} onChange={e => handleChange(cc.id, 'nama_wa_pic', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">No WA Dealing</label>
                          <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.nomor_wa_dealing} onChange={e => handleChange(cc.id, 'nomor_wa_dealing', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Alamat KTP</label>
                          <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.alamat_ktp} onChange={e => handleChange(cc.id, 'alamat_ktp', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">NIK</label>
                          <input type="text" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.nik} onChange={e => handleChange(cc.id, 'nik', e.target.value)} />
                        </div>
                        <div className="col-span-2 grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Link KTP (GDrive)</label>
                            <input type="url" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.link_ktp} onChange={e => handleChange(cc.id, 'link_ktp', e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Link Kontrak (GDrive)</label>
                            <input type="url" className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-blue-500" value={f.link_kontrak} onChange={e => handleChange(cc.id, 'link_kontrak', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
              <button 
                className="btn btn-outline flex items-center gap-2"
                onClick={() => handleSave(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan Draft
              </button>
              <button 
                className="btn btn-primary flex items-center gap-2"
                onClick={() => handleSave(true)}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit ke Manager
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
