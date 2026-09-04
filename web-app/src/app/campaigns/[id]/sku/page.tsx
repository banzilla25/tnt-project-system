"use client";

import { useState } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

import { useAuth } from "@/providers/AuthProvider";

export default function SkuPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { skus, fetchData } = useDatabaseStore();
  const { canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);
  const supabase = createClient();

  const campaignSkus = skus.filter(s => s.campaign_id === campaignId);

  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  type SkuRow = { id: string; nama_produk: string; product_id: string; satuan_bundle: string; commission: string; };
  const [newRows, setNewRows] = useState<SkuRow[]>([]);

  const handleAddClick = () => {
    setIsAdding(true);
    setNewRows(Array(3).fill(null).map(() => ({
      id: Math.random().toString(36).substring(2,9),
      nama_produk: '', product_id: '', satuan_bundle: '', commission: ''
    })));
  };

  const updateRow = (id: string, field: keyof SkuRow, value: string) => {
    setNewRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

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
            id: Math.random().toString(36).substring(2,9),
            nama_produk: '', product_id: '', satuan_bundle: '', commission: ''
          });
        }
        
        let currColIdx = colIdx;
        cols.forEach(colText => {
          if (currColIdx < fields.length) {
            result[currRowIdx][fields[currColIdx]] = colText.trim();
          }
          currColIdx++;
        });
        currRowIdx++;
      });
      
      return result;
    });
  };

  const handleAddMoreRow = () => {
    setNewRows(prev => [...prev, {
      id: Math.random().toString(36).substring(2,9),
      nama_produk: '', product_id: '', satuan_bundle: '', commission: ''
    }]);
  };

  const handleSaveAll = async () => {
    const validRows = newRows.filter(r => r.product_id.trim() !== '');
    if (validRows.length === 0) {
      setIsAdding(false);
      return;
    }
    
    setIsSaving(true);
    
    const insertData: any[] = [];
    
    for (const r of validRows) {
      const existing = campaignSkus.find(s => s.product_id === r.product_id);
      
      const newNama = r.nama_produk || null;
      const newSatuan = r.satuan_bundle || null;
      const newComm = r.commission ? Number(r.commission) : null;

      if (existing) {
        // Utamakan isi (jika form kosong, pakai data lama. Jika form ada isinya, pakai data baru)
        const updatedSatuan = newSatuan !== null ? newSatuan : existing.satuan_bundle;
        const updatedComm = newComm !== null ? newComm : existing.commission;
        const updatedNama = newNama !== null ? newNama : existing.nama_produk;

        // Cek apakah ada perubahan
        if (updatedSatuan !== existing.satuan_bundle || 
            updatedComm !== existing.commission || 
            updatedNama !== existing.nama_produk) {
          await supabase.from('skus').update({
            nama_produk: updatedNama,
            satuan_bundle: updatedSatuan,
            commission: updatedComm
          }).eq('id', existing.id);
        }
      } else {
        insertData.push({
          campaign_id: campaignId,
          nama_produk: newNama || 'Produk Tanpa Nama',
          product_id: r.product_id,
          satuan_bundle: newSatuan,
          commission: newComm
        });
      }
    }

    if (insertData.length > 0) {
      await supabase.from('skus').insert(insertData);
    }

    // Trigger sync for all new products
    for (const r of validRows) {
      try {
        await fetch('/api/sync-unmapped', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: r.product_id, campaignId })
        });
      } catch (err) {
        console.error('Failed to sync', err);
      }
    }

    setIsSaving(false);
    setIsAdding(false);
    fetchData();
  };

  const [editingSkuId, setEditingSkuId] = useState<number | null>(null);
  const [editSkuData, setEditSkuData] = useState({
    nama_produk: '',
    product_id: '',
    satuan_bundle: '',
    commission: '',
    link_gmv_max: '',
    link_tap: ''
  });

  const handleDelete = async (skuId: number) => {
    if (!hasAccess) return;
    if (confirm("Yakin ingin menghapus SKU ini?")) {
      await supabase.from('skus').delete().eq('id', skuId);
      fetchData();
    }
  };

  const startEdit = (sku: any) => {
    if (!hasAccess) return;
    setEditingSkuId(sku.id);
    setEditSkuData({
      nama_produk: sku.nama_produk || '',
      product_id: sku.product_id || '',
      satuan_bundle: sku.satuan_bundle || '',
      commission: sku.commission ? sku.commission.toString() : '',
      link_gmv_max: sku.link_gmv_max || '',
      link_tap: sku.link_tap || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingSkuId || !editSkuData.nama_produk || !editSkuData.product_id || !hasAccess) return;

    await supabase.from('skus').update({
      nama_produk: editSkuData.nama_produk,
      product_id: editSkuData.product_id,
      satuan_bundle: editSkuData.satuan_bundle || null,
      commission: editSkuData.commission ? Number(editSkuData.commission) : null,
      link_gmv_max: editSkuData.link_gmv_max || null,
      link_tap: editSkuData.link_tap || null
    }).eq('id', editingSkuId);

    // Trigger Auto-Sync Raw Data
    try {
      await fetch('/api/sync-unmapped', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: editSkuData.product_id, campaignId })
      });
    } catch (err) {
      console.error('Failed to sync unmapped data', err);
    }

    setEditingSkuId(null);
    fetchData();
  };

  return (
    <div className="space-y-[24px] pb-[80px]">
      <div className="flex justify-between items-center mb-[24px]">
        <div>
          <h2 className="text-[20px] font-bold text-text">Daftar SKU Produk</h2>
          <p className="text-[13px] text-text-soft">Kelola master produk untuk campaign ini.</p>
        </div>
        {hasAccess && (
          <button className="btn btn-primary flex items-center gap-[8px]" onClick={handleAddClick} disabled={isAdding}>
            <Plus className="w-4 h-4" /> Tambah Produk Massal
          </button>
        )}
      </div>

      <div className="ccard !p-0 overflow-hidden">
        <div className="tbl-wrap !border-0 !rounded-none">
          <table className="w-full">
            <thead className="border-b border-line bg-slate-50">
              <tr>
                <th className="py-[16px]">Nama Produk</th>
                <th className="py-[16px]">Product ID</th>
                <th className="py-[16px]">Satuan/Bundle</th>
                <th className="py-[16px]">Komisi (%)</th>
                {hasAccess && <th className="py-[16px] text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {isAdding && hasAccess && (
                <>
                  {newRows.map((row) => (
                    <tr key={row.id} className="bg-blue-50/50">
                      <td className="p-1">
                        <input type="text" placeholder="Nama Produk (Opsional)" className="input w-full !rounded-none !border-transparent hover:!border-slate-300 focus:!border-p300 !px-2 !py-1.5" value={row.nama_produk} onChange={e => updateRow(row.id, 'nama_produk', e.target.value)} onPaste={e => handlePaste(e, row.id, 0)} />
                      </td>
                      <td className="p-1">
                        <input type="text" placeholder="ID TikTok Shop (Wajib)" className="input w-full !rounded-none !border-transparent hover:!border-slate-300 focus:!border-p300 !px-2 !py-1.5 font-mono" value={row.product_id} onChange={e => updateRow(row.id, 'product_id', e.target.value)} onPaste={e => handlePaste(e, row.id, 1)} />
                      </td>
                      <td className="p-1">
                        <input type="text" placeholder="Satuan/Bundle" className="input w-full !rounded-none !border-transparent hover:!border-slate-300 focus:!border-p300 !px-2 !py-1.5" value={row.satuan_bundle} onChange={e => updateRow(row.id, 'satuan_bundle', e.target.value)} onPaste={e => handlePaste(e, row.id, 2)} />
                      </td>
                      <td className="p-1">
                        <input type="number" placeholder="Contoh: 10" className="input w-full !rounded-none !border-transparent hover:!border-slate-300 focus:!border-p300 !px-2 !py-1.5" value={row.commission} onChange={e => updateRow(row.id, 'commission', e.target.value)} onPaste={e => handlePaste(e, row.id, 3)} />
                      </td>
                      <td className="text-right p-2">
                        <button onClick={() => setNewRows(prev => prev.filter(r => r.id !== row.id))} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50" title="Hapus Baris"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50/20">
                    <td colSpan={5} className="p-4 border-t border-blue-100">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-[12px]">
                          <button onClick={handleAddMoreRow} className="btn btn-outline !py-1.5 !px-3 text-sm flex items-center gap-1"><Plus className="w-3.5 h-3.5"/> Tambah 1 Baris</button>
                          <span className="text-[12px] text-text-soft">💡 Tips: Anda bisa Paste tabel langsung dari Excel ke kotak isian di atas.</span>
                        </div>
                        <div className="flex gap-[8px]">
                          <button onClick={() => setIsAdding(false)} disabled={isSaving} className="btn btn-outline">Batal</button>
                          <button onClick={handleSaveAll} disabled={isSaving} className="btn btn-primary">{isSaving ? 'Menyimpan...' : 'Simpan Semua Produk'}</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </>
              )}

              {campaignSkus.length === 0 && !isAdding ? (
                <tr>
                  <td colSpan={hasAccess ? 5 : 4} className="text-center py-8 text-text-soft">
                    Belum ada produk terdaftar.
                  </td>
                </tr>
              ) : (
                campaignSkus.map((sku) => (
                  sku.id === editingSkuId ? (
                    <tr key={sku.id} className="bg-blue-50/20 border-b border-line">
                      <td>
                        <input type="text" className="input w-full" value={editSkuData.nama_produk} onChange={e => setEditSkuData({...editSkuData, nama_produk: e.target.value})} />
                      </td>
                      <td>
                        <input type="text" className="input w-full" value={editSkuData.product_id} onChange={e => setEditSkuData({...editSkuData, product_id: e.target.value})} />
                      </td>
                      <td>
                        <input type="text" className="input w-full" value={editSkuData.satuan_bundle} onChange={e => setEditSkuData({...editSkuData, satuan_bundle: e.target.value})} />
                      </td>
                      <td>
                        <input type="number" className="input w-full" value={editSkuData.commission} onChange={e => setEditSkuData({...editSkuData, commission: e.target.value})} />
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button onClick={handleSaveEdit} className="btn btn-primary !py-[6px] !px-[12px] mr-[8px]">Simpan</button>
                        <button onClick={() => setEditingSkuId(null)} className="btn btn-outline !py-[6px] !px-[12px]">Batal</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={sku.id} className="border-b border-line hover:bg-slate-50/50">
                      <td className="font-medium text-text">{sku.nama_produk}</td>
                      <td className="font-mono text-text-soft text-[13px]">{sku.product_id}</td>
                      <td>{sku.satuan_bundle || '-'}</td>
                      <td>{sku.commission ? `${sku.commission}%` : '-'}</td>
                      {hasAccess && (
                        <td className="text-right">
                          <button className="p-[8px] text-blue-500 hover:bg-blue-50 rounded-[8px] mr-[4px]" onClick={() => startEdit(sku)} title="Edit SKU">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button className="p-[8px] text-red-500 hover:bg-red-50 rounded-[8px]" onClick={() => handleDelete(sku.id)} title="Hapus SKU">
                            <Trash2 className="w-4 h-4" />
                          </button>
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
