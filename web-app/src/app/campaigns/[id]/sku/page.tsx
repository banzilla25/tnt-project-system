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
  const [newSku, setNewSku] = useState({
    nama_produk: '',
    product_id: '',
    satuan_bundle: '',
    commission: '',
    link_gmv_max: '',
    link_tap: ''
  });

  const [editingSkuId, setEditingSkuId] = useState<number | null>(null);
  const [editSkuData, setEditSkuData] = useState({
    nama_produk: '',
    product_id: '',
    satuan_bundle: '',
    commission: '',
    link_gmv_max: '',
    link_tap: ''
  });

  const handleAdd = async () => {
    if (!newSku.nama_produk || !newSku.product_id || !hasAccess) return;
    
    await supabase.from('skus').insert({
      campaign_id: campaignId,
      nama_produk: newSku.nama_produk,
      product_id: newSku.product_id,
      satuan_bundle: newSku.satuan_bundle || null,
      commission: newSku.commission ? Number(newSku.commission) : null,
      link_gmv_max: newSku.link_gmv_max || null,
      link_tap: newSku.link_tap || null
    });
    
    setIsAdding(false);
    setNewSku({ nama_produk: '', product_id: '', satuan_bundle: '', commission: '', link_gmv_max: '', link_tap: '' });
    fetchData(); // Refresh data
  };

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
          <button className="btn btn-primary flex items-center gap-[8px]" onClick={() => setIsAdding(true)} disabled={isAdding}>
            <Plus className="w-4 h-4" /> Tambah Produk
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
                <tr className="bg-blue-50/50">
                  <td>
                    <input type="text" placeholder="Nama Produk" className="input w-full" value={newSku.nama_produk} onChange={e => setNewSku({...newSku, nama_produk: e.target.value})} />
                  </td>
                  <td>
                    <input type="text" placeholder="ID TikTok Shop" className="input w-full" value={newSku.product_id} onChange={e => setNewSku({...newSku, product_id: e.target.value})} />
                  </td>
                  <td>
                    <input type="text" placeholder="Satuan/Bundle" className="input w-full" value={newSku.satuan_bundle} onChange={e => setNewSku({...newSku, satuan_bundle: e.target.value})} />
                  </td>
                  <td>
                    <input type="number" placeholder="Contoh: 10" className="input w-full" value={newSku.commission} onChange={e => setNewSku({...newSku, commission: e.target.value})} />
                  </td>
                  <td className="text-right">
                    <button onClick={handleAdd} className="btn btn-primary !py-[6px] !px-[12px] mr-[8px]">Simpan</button>
                    <button onClick={() => setIsAdding(false)} className="btn btn-outline !py-[6px] !px-[12px]">Batal</button>
                  </td>
                </tr>
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
