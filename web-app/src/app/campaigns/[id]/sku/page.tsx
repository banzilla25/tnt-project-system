"use client";

import { useState } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function SkuPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { skus, fetchData } = useDatabaseStore();
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

  const handleAdd = async () => {
    if (!newSku.nama_produk || !newSku.product_id) return;
    
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
    if (confirm("Yakin ingin menghapus SKU ini?")) {
      await supabase.from('skus').delete().eq('id', skuId);
      fetchData();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Daftar SKU Produk</h2>
          <p className="text-sm text-slate-500">Kelola master produk untuk campaign ini.</p>
        </div>
        <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
          <Plus className="w-4 h-4 mr-2" /> Tambah Produk
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Nama Produk</TableHead>
              <TableHead>Product ID</TableHead>
              <TableHead>Satuan/Bundle</TableHead>
              <TableHead>Komisi (%)</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAdding && (
              <TableRow className="bg-blue-50/50">
                <TableCell>
                  <input type="text" placeholder="Nama Produk" className="w-full p-2 text-sm border rounded" value={newSku.nama_produk} onChange={e => setNewSku({...newSku, nama_produk: e.target.value})} />
                </TableCell>
                <TableCell>
                  <input type="text" placeholder="ID TikTok Shop" className="w-full p-2 text-sm border rounded" value={newSku.product_id} onChange={e => setNewSku({...newSku, product_id: e.target.value})} />
                </TableCell>
                <TableCell>
                  <input type="text" placeholder="Satuan/Bundle" className="w-full p-2 text-sm border rounded" value={newSku.satuan_bundle} onChange={e => setNewSku({...newSku, satuan_bundle: e.target.value})} />
                </TableCell>
                <TableCell>
                  <input type="number" placeholder="Contoh: 10" className="w-full p-2 text-sm border rounded" value={newSku.commission} onChange={e => setNewSku({...newSku, commission: e.target.value})} />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={handleAdd} className="mr-2">Simpan</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>Batal</Button>
                </TableCell>
              </TableRow>
            )}

            {campaignSkus.length === 0 && !isAdding ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  Belum ada produk terdaftar.
                </TableCell>
              </TableRow>
            ) : (
              campaignSkus.map((sku) => (
                <TableRow key={sku.id}>
                  <TableCell className="font-medium">{sku.nama_produk}</TableCell>
                  <TableCell className="font-mono text-slate-500 text-sm">{sku.product_id}</TableCell>
                  <TableCell>{sku.satuan_bundle || '-'}</TableCell>
                  <TableCell>{sku.commission ? `${sku.commission}%` : '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" title="Belum diimplementasi di Fase 2">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(sku.id)} className="h-8 w-8 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
