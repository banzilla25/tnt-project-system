"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Plus, Edit2, Trash2, Loader2, CheckCircle2, AlertCircle, X, CheckSquare, Square } from "lucide-react";
import { useParams } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import {
  getCampaignSkus,
  deleteSkuAction,
  deleteBatchSkusAction,
  updateSkuAction,
  saveBatchSkusAction
} from "@/app/campaigns/actions/skuActions";

type SkuRow = {
  id: string;
  nama_produk: string;
  product_id: string;
  satuan_bundle: string;
  commission: string;
};

export default function SkuPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { skus, deleteSku: storeDeleteSku, updateSku: storeUpdateSku } = useDatabaseStore();
  const { canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);

  // Local state for campaign SKUs to ensure instant responsiveness & zero stale cache
  const [localSkus, setLocalSkus] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selection state for testing & batch delete
  const [selectedSkuIds, setSelectedSkuIds] = useState<number[]>([]);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Batch Add state
  const [isAdding, setIsAdding] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [newRows, setNewRows] = useState<SkuRow[]>([]);

  // Inline Edit state
  const [editingSkuId, setEditingSkuId] = useState<number | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSkuData, setEditSkuData] = useState({
    nama_produk: '',
    product_id: '',
    satuan_bundle: '',
    commission: '',
  });

  // Action states
  const [deletingSkuId, setDeletingSkuId] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Load fresh SKUs directly for this campaign
  const loadSkus = useCallback(async () => {
    if (!campaignId) return;
    setIsLoading(true);
    try {
      const res = await getCampaignSkus(campaignId);
      if (res.success && res.data) {
        setLocalSkus(res.data);
      } else {
        const storeSkus = skus.filter(s => s.campaign_id === campaignId);
        setLocalSkus(storeSkus);
      }
    } catch (err) {
      console.error("Failed to load SKUs:", err);
      const storeSkus = skus.filter(s => s.campaign_id === campaignId);
      setLocalSkus(storeSkus);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, skus]);

  useEffect(() => {
    loadSkus();
  }, [campaignId]);

  // Selection Handlers
  const isAllSelected = localSkus.length > 0 && selectedSkuIds.length === localSkus.length;
  const isSomeSelected = selectedSkuIds.length > 0 && selectedSkuIds.length < localSkus.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSkuIds([]);
    } else {
      setSelectedSkuIds(localSkus.map(s => s.id));
    }
  };

  const handleToggleSelect = (skuId: number) => {
    setSelectedSkuIds(prev =>
      prev.includes(skuId) ? prev.filter(id => id !== skuId) : [...prev, skuId]
    );
  };

  // Handle Add Batch Click
  const handleAddClick = () => {
    setIsAdding(true);
    setEditingSkuId(null);
    setNewRows(Array(3).fill(null).map(() => ({
      id: Math.random().toString(36).substring(2, 9),
      nama_produk: '',
      product_id: '',
      satuan_bundle: '',
      commission: ''
    })));
  };

  const updateRow = (rowId: string, field: keyof SkuRow, value: string) => {
    setNewRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  const handleAddMoreRow = () => {
    setNewRows(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      nama_produk: '',
      product_id: '',
      satuan_bundle: '',
      commission: ''
    }]);
  };

  const handleRemoveNewRow = (rowId: string) => {
    setNewRows(prev => {
      const remaining = prev.filter(r => r.id !== rowId);
      return remaining.length > 0 ? remaining : [{
        id: Math.random().toString(36).substring(2, 9),
        nama_produk: '',
        product_id: '',
        satuan_bundle: '',
        commission: ''
      }];
    });
  };

  // Smart Paste Handler from Excel
  const handlePaste = (e: React.ClipboardEvent, startRowId: string, colIdx: number) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    const pastedRows = pasteData.split(/\r?\n/).filter(r => r.trim());

    setNewRows(prev => {
      const result = [...prev];
      const startIdx = result.findIndex(r => r.id === startRowId);
      if (startIdx === -1) return prev;

      let currRowIdx = startIdx;
      const fields: (keyof SkuRow)[] = ['nama_produk', 'product_id', 'satuan_bundle', 'commission'];

      pastedRows.forEach(rowText => {
        const cols = rowText.split('\t');
        if (currRowIdx >= result.length) {
          result.push({
            id: Math.random().toString(36).substring(2, 9),
            nama_produk: '',
            product_id: '',
            satuan_bundle: '',
            commission: ''
          });
        }

        let currColIdx = colIdx;
        cols.forEach(rawColText => {
          if (currColIdx < fields.length) {
            let cleaned = rawColText.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
            if (fields[currColIdx] === 'commission') {
              cleaned = cleaned.replace(/%/g, '').trim();
            }
            result[currRowIdx][fields[currColIdx]] = cleaned;
          }
          currColIdx++;
        });
        currRowIdx++;
      });

      return result;
    });
  };

  // Save Batch SKUs
  const handleSaveAll = async () => {
    const validRows = newRows.filter(r => (r.product_id || '').trim() !== '');
    if (validRows.length === 0) {
      alert("Harap masukkan minimal satu baris dengan Product ID TikTok Shop.");
      return;
    }

    setIsSavingBatch(true);
    try {
      const res = await saveBatchSkusAction(campaignId, validRows);
      if (!res.success) {
        showNotification('error', res.error || 'Gagal menyimpan produk');
        alert("Gagal menyimpan produk: " + res.error);
        return;
      }

      showNotification('success', `Berhasil menyimpan! ${res.inserted || 0} produk baru ditambahkan, ${res.updated || 0} produk diperbarui.`);
      setIsAdding(false);
      setNewRows([]);
      await loadSkus();
    } catch (err: any) {
      console.error("Save all error:", err);
      showNotification('error', err.message || 'Terjadi kesalahan sistem saat menyimpan');
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Start Inline Edit
  const startEdit = (sku: any) => {
    if (!hasAccess) return;
    setIsAdding(false);
    setEditingSkuId(sku.id);
    setEditSkuData({
      nama_produk: sku.nama_produk || '',
      product_id: sku.product_id || '',
      satuan_bundle: sku.satuan_bundle || '',
      commission: sku.commission ? String(sku.commission) : '',
    });
  };

  // Save Inline Edit
  const handleSaveEdit = async () => {
    if (!editingSkuId || !hasAccess) return;

    if (!editSkuData.nama_produk.trim()) {
      alert("Nama produk wajib diisi.");
      return;
    }
    if (!editSkuData.product_id.trim()) {
      alert("Product ID TikTok Shop wajib diisi.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await updateSkuAction(editingSkuId, campaignId, {
        nama_produk: editSkuData.nama_produk.trim(),
        product_id: editSkuData.product_id.trim(),
        satuan_bundle: editSkuData.satuan_bundle.trim() || null,
        commission: editSkuData.commission ? Number(editSkuData.commission.replace(/%/g, '').trim()) : null,
      });

      if (!res.success) {
        showNotification('error', res.error || 'Gagal memperbarui produk');
        alert("Gagal memperbarui produk: " + res.error);
        return;
      }

      setLocalSkus(prev => prev.map(s => s.id === editingSkuId ? { ...s, ...res.data } : s));
      try {
        storeUpdateSku(editingSkuId, res.data);
      } catch (e) {}

      showNotification('success', `Produk "${editSkuData.nama_produk}" berhasil diperbarui.`);
      setEditingSkuId(null);
    } catch (err: any) {
      console.error("Error saving edit:", err);
      showNotification('error', err.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Single SKU
  const handleDelete = async (sku: any) => {
    if (!hasAccess) return;

    const confirmMsg = `Yakin ingin menghapus produk ini?\n\n` +
      `Nama: ${sku.nama_produk}\n` +
      `Product ID: ${sku.product_id}\n\n` +
      `💡 Catatan: Riwayat data penjualan lampau tetap aman dan tersimpan di database. Keterkaitan SKU ini akan dilepas.`;

    if (!confirm(confirmMsg)) return;

    setDeletingSkuId(sku.id);
    try {
      const res = await deleteSkuAction(sku.id, campaignId);
      if (!res.success) {
        showNotification('error', res.error || 'Gagal menghapus produk');
        alert("Gagal menghapus produk: " + res.error);
        return;
      }

      setLocalSkus(prev => prev.filter(s => s.id !== sku.id));
      setSelectedSkuIds(prev => prev.filter(id => id !== sku.id));
      try {
        await storeDeleteSku(sku.id);
      } catch (e) {}

      showNotification('success', `Produk "${sku.nama_produk}" (ID: ${sku.product_id}) berhasil dihapus.`);
    } catch (err: any) {
      console.error("Error deleting SKU:", err);
      showNotification('error', err.message || 'Terjadi kesalahan saat menghapus');
      alert("Terjadi kesalahan saat menghapus: " + err.message);
    } finally {
      setDeletingSkuId(null);
    }
  };

  // Batch Delete Selected SKUs
  const handleDeleteSelected = async () => {
    if (selectedSkuIds.length === 0 || !hasAccess) return;

    const count = selectedSkuIds.length;
    const isAll = count === localSkus.length;

    const confirmMsg = isAll
      ? `⚠️ PERINGATAN HAPUS SEMUA PRODUK:\n\n` +
        `Anda akan menghapus SEMUA (${count}) produk pada campaign ini.\n\n` +
        `• Riwayat data transaksi di database tetap tersimpan rapi.\n` +
        `• Tampilan performa GMV & kuantitas terjual di menu Performa/Daily akan menjadi 0 sampai produk didaftarkan kembali.\n\n` +
        `Lanjutkan menghapus semua produk?`
      : `Yakin ingin menghapus ${count} produk terpilih?\n\n` +
        `💡 Catatan: Riwayat data penjualan lampau tetap aman tersimpan di database. Keterkaitan SKU terpilih akan dilepas.`;

    if (!confirm(confirmMsg)) return;

    setIsDeletingBatch(true);
    try {
      const res = await deleteBatchSkusAction(selectedSkuIds, campaignId);
      if (!res.success) {
        showNotification('error', res.error || 'Gagal menghapus produk terpilih');
        alert("Gagal menghapus: " + res.error);
        return;
      }

      const deletedSet = new Set(selectedSkuIds);
      setLocalSkus(prev => prev.filter(s => !deletedSet.has(s.id)));
      for (const id of selectedSkuIds) {
        try { await storeDeleteSku(id); } catch (e) {}
      }

      showNotification('success', `Berhasil menghapus ${res.count || count} produk terpilih.`);
      setSelectedSkuIds([]);
    } catch (err: any) {
      console.error("Error delete selected:", err);
      showNotification('error', err.message || 'Terjadi kesalahan saat menghapus produk terpilih');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Delete All SKUs Quick Action
  const handleDeleteAllPrompt = () => {
    if (localSkus.length === 0 || !hasAccess) return;
    setSelectedSkuIds(localSkus.map(s => s.id));
    setTimeout(() => {
      handleDeleteSelected();
    }, 50);
  };

  return (
    <div className="space-y-[24px] pb-[80px]">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-[24px]">
        <div>
          <h2 className="text-[20px] font-bold text-text">Daftar SKU Produk</h2>
          <p className="text-[13px] text-text-soft">
            Kelola master produk untuk campaign ini. ({localSkus.length} produk terdaftar)
          </p>
        </div>
        {hasAccess && (
          <div className="flex items-center gap-2">
            {localSkus.length > 0 && (
              <button
                className="btn btn-outline text-red-600 hover:bg-red-50 hover:border-red-300 flex items-center gap-[8px] text-xs font-semibold !py-2 !px-3"
                onClick={handleDeleteAllPrompt}
                disabled={isDeletingBatch || isLoading}
                title="Hapus semua produk dari campaign ini sekaligus untuk tes"
              >
                <Trash2 className="w-4 h-4" /> Hapus Semua Produk
              </button>
            )}
            <button
              className="btn btn-primary flex items-center gap-[8px]"
              onClick={handleAddClick}
              disabled={isAdding || isSavingBatch || isDeletingBatch}
            >
              <Plus className="w-4 h-4" /> Tambah Produk Massal
            </button>
          </div>
        )}
      </div>

      {/* Notification Alert Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm transition-all animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{notification.message}</p>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Batch Selection Action Bar (Appears when 1 or more SKUs are selected) */}
      {hasAccess && selectedSkuIds.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center bg-amber-200 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
              {selectedSkuIds.length} Dipilih
            </span>
            <span className="text-sm font-medium text-amber-900">
              {selectedSkuIds.length === localSkus.length
                ? 'Semua produk pada campaign ini telah dipilih'
                : `${selectedSkuIds.length} dari ${localSkus.length} produk dipilih untuk tindakan massal`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isAllSelected && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="btn btn-outline !py-1.5 !px-3 text-xs bg-white hover:bg-slate-50"
              >
                Pilih Semua ({localSkus.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedSkuIds([])}
              className="btn btn-outline !py-1.5 !px-3 text-xs bg-white hover:bg-slate-50"
            >
              Batal Pilihan
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={isDeletingBatch}
              className="btn bg-red-600 hover:bg-red-700 text-white !py-1.5 !px-3.5 text-xs flex items-center gap-1.5 font-semibold shadow-sm"
            >
              {isDeletingBatch ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghapus...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih ({selectedSkuIds.length})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="ccard !p-0 overflow-hidden shadow-sm">
        <div className="tbl-wrap !border-0 !rounded-none overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-slate-50">
              <tr>
                {hasAccess && (
                  <th className="py-[16px] px-3 w-12 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={isAllSelected}
                      ref={input => {
                        if (input) input.indeterminate = isSomeSelected;
                      }}
                      onChange={handleSelectAll}
                      disabled={localSkus.length === 0 || isDeletingBatch}
                      title={isAllSelected ? "Batalkan semua pilihan" : "Pilih semua produk"}
                    />
                  </th>
                )}
                <th className="py-[16px] px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Nama Produk
                </th>
                <th className="py-[16px] px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-48">
                  Product ID
                </th>
                <th className="py-[16px] px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-36">
                  Satuan/Bundle
                </th>
                <th className="py-[16px] px-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">
                  Komisi (%)
                </th>
                {hasAccess && (
                  <th className="py-[16px] px-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Batch Add Form Rows */}
              {isAdding && hasAccess && (
                <>
                  <tr className="bg-amber-50/60 border-b border-amber-200">
                    <td colSpan={hasAccess ? 6 : 4} className="px-4 py-2 text-xs font-semibold text-amber-800">
                      📝 Mode Tambah Produk Massal (Ketik langsung atau Paste dari tabel Excel)
                    </td>
                  </tr>
                  {newRows.map((row) => (
                    <tr key={row.id} className="bg-blue-50/40 hover:bg-blue-50/70 transition-colors">
                      <td className="px-3 py-2 text-center text-slate-400 font-mono text-xs">
                        •
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="Nama Produk (Wajib/Opsional)"
                          className="input w-full !rounded-md !border-slate-200 hover:!border-slate-300 focus:!border-p300 !px-3 !py-2 text-sm"
                          value={row.nama_produk}
                          onChange={e => updateRow(row.id, 'nama_produk', e.target.value)}
                          onPaste={e => handlePaste(e, row.id, 0)}
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="ID TikTok Shop (Wajib)"
                          className="input w-full !rounded-md !border-slate-200 hover:!border-slate-300 focus:!border-p300 !px-3 !py-2 font-mono text-sm"
                          value={row.product_id}
                          onChange={e => updateRow(row.id, 'product_id', e.target.value)}
                          onPaste={e => handlePaste(e, row.id, 1)}
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="Satuan/Bundle"
                          className="input w-full !rounded-md !border-slate-200 hover:!border-slate-300 focus:!border-p300 !px-3 !py-2 text-sm"
                          value={row.satuan_bundle}
                          onChange={e => updateRow(row.id, 'satuan_bundle', e.target.value)}
                          onPaste={e => handlePaste(e, row.id, 2)}
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="Contoh: 10"
                          className="input w-full !rounded-md !border-slate-200 hover:!border-slate-300 focus:!border-p300 !px-3 !py-2 text-sm"
                          value={row.commission}
                          onChange={e => updateRow(row.id, 'commission', e.target.value)}
                          onPaste={e => handlePaste(e, row.id, 3)}
                        />
                      </td>
                      <td className="text-right p-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveNewRow(row.id)}
                          className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Hapus Baris"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50/20 border-t border-blue-100">
                    <td colSpan={hasAccess ? 6 : 4} className="p-4">
                      <div className="flex flex-wrap justify-between items-center gap-3">
                        <div className="flex items-center gap-[12px]">
                          <button
                            type="button"
                            onClick={handleAddMoreRow}
                            className="btn btn-outline !py-1.5 !px-3 text-sm flex items-center gap-1.5 hover:bg-white"
                          >
                            <Plus className="w-3.5 h-3.5" /> Tambah 1 Baris
                          </button>
                          <span className="text-[12px] text-text-soft">
                            💡 Tips: Anda bisa Paste tabel langsung dari Excel ke kotak isian di atas.
                          </span>
                        </div>
                        <div className="flex gap-[8px]">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAdding(false);
                              setNewRows([]);
                            }}
                            disabled={isSavingBatch}
                            className="btn btn-outline"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveAll}
                            disabled={isSavingBatch}
                            className="btn btn-primary flex items-center gap-1.5 min-w-[160px] justify-center"
                          >
                            {isSavingBatch ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                              </>
                            ) : (
                              'Simpan Semua Produk'
                            )}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </>
              )}

              {/* Loading Indicator */}
              {isLoading && localSkus.length === 0 ? (
                <tr>
                  <td colSpan={hasAccess ? 6 : 4} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                      <span className="text-sm">Memuat data produk...</span>
                    </div>
                  </td>
                </tr>
              ) : localSkus.length === 0 && !isAdding ? (
                <tr>
                  <td colSpan={hasAccess ? 6 : 4} className="text-center py-12 text-text-soft">
                    <div className="flex flex-col items-center gap-2">
                      <p className="font-medium text-slate-600">Belum ada produk terdaftar</p>
                      <p className="text-xs text-slate-400">Klik tombol "+ Tambah Produk Massal" di atas untuk menambahkan produk.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                localSkus.map(sku => (
                  sku.id === editingSkuId ? (
                    <tr key={sku.id} className="bg-amber-50/30 border-b border-amber-200">
                      {hasAccess && <td className="px-3 py-2 text-center text-slate-300">•</td>}
                      <td className="p-2">
                        <input
                          type="text"
                          className="input w-full text-sm font-medium"
                          value={editSkuData.nama_produk}
                          onChange={e => setEditSkuData({ ...editSkuData, nama_produk: e.target.value })}
                          placeholder="Nama Produk"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="input w-full text-sm font-mono"
                          value={editSkuData.product_id}
                          onChange={e => setEditSkuData({ ...editSkuData, product_id: e.target.value })}
                          placeholder="Product ID TikTok"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="input w-full text-sm"
                          value={editSkuData.satuan_bundle}
                          onChange={e => setEditSkuData({ ...editSkuData, satuan_bundle: e.target.value })}
                          placeholder="Satuan/Bundle"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="input w-full text-sm"
                          value={editSkuData.commission}
                          onChange={e => setEditSkuData({ ...editSkuData, commission: e.target.value })}
                          placeholder="Komisi (%)"
                        />
                      </td>
                      <td className="text-right px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            disabled={isSavingEdit}
                            className="btn btn-primary !py-[6px] !px-[12px] text-xs flex items-center gap-1"
                          >
                            {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            {isSavingEdit ? 'Menyimpan...' : 'Simpan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSkuId(null)}
                            disabled={isSavingEdit}
                            className="btn btn-outline !py-[6px] !px-[12px] text-xs"
                          >
                            Batal
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={sku.id}
                      className={`border-b border-line hover:bg-slate-50/70 transition-colors ${
                        selectedSkuIds.includes(sku.id) ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {hasAccess && (
                        <td className="px-3 py-3.5 text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedSkuIds.includes(sku.id)}
                            onChange={() => handleToggleSelect(sku.id)}
                            disabled={deletingSkuId !== null || isDeletingBatch}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3.5 font-medium text-text text-sm">
                        {sku.nama_produk}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-text-soft text-[13px]">
                        {sku.product_id}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">
                        {sku.satuan_bundle || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">
                        {sku.commission !== null && sku.commission !== undefined && sku.commission !== ''
                          ? `${sku.commission}%`
                          : '-'}
                      </td>
                      {hasAccess && (
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              onClick={() => startEdit(sku)}
                              title="Edit Produk"
                              disabled={deletingSkuId !== null || isDeletingBatch}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              onClick={() => handleDelete(sku)}
                              title="Hapus Produk"
                              disabled={deletingSkuId !== null || isDeletingBatch}
                            >
                              {deletingSkuId === sku.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
