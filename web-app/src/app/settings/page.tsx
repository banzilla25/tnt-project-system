"use client";

import { useState } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Plus, Edit2, Check, X, Tag, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";

export default function SettingsPage() {
  const { brands, niches, addBrand, updateBrand, addNiche, updateNiche } = useDatabaseStore();

  // Brand State
  const [editingBrand, setEditingBrand] = useState<number | null>(null);
  const [brandForm, setBrandForm] = useState<{ nama: string; status: "aktif" | "arsip" }>({ nama: "", status: "aktif" });
  const [newBrandName, setNewBrandName] = useState("");

  // Niche State
  const [editingNiche, setEditingNiche] = useState<number | null>(null);
  const [nicheForm, setNicheForm] = useState({ nama: "" });
  const [newNicheName, setNewNicheName] = useState("");

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    await addBrand({ nama: newBrandName, status: 'aktif' });
    setNewBrandName("");
  };

  const handleSaveBrand = async (id: number) => {
    await updateBrand(id, { nama: brandForm.nama, status: brandForm.status });
    setEditingBrand(null);
  };

  const handleAddNiche = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNicheName.trim()) return;
    await addNiche({ nama: newNicheName });
    setNewNicheName("");
  };

  const handleSaveNiche = async (id: number) => {
    await updateNiche(id, { nama: nicheForm.nama });
    setEditingNiche(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Pengaturan Master Data</h1>
        <p className="text-slate-500 mt-1">Kelola data dasar seperti daftar brand klien dan kategori niche kreator.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BRAND MANAGEMENT */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Master Brand
            </CardTitle>
            <CardDescription>
              Daftar brand yang bekerjasama. Brand ini akan muncul saat membuat campaign baru.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddBrand} className="flex gap-2">
              <input
                type="text"
                placeholder="Nama brand baru..."
                className="flex-1 p-2 border border-slate-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newBrandName.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </form>

            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Nama Brand</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-20 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map(brand => (
                    <TableRow key={brand.id}>
                      <TableCell>
                        {editingBrand === brand.id ? (
                          <input
                            type="text"
                            className="w-full p-1 border rounded text-sm"
                            value={brandForm.nama}
                            onChange={(e) => setBrandForm({ ...brandForm, nama: e.target.value })}
                          />
                        ) : (
                          <span className="font-medium">{brand.nama}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingBrand === brand.id ? (
                          <select
                            className="p-1 border rounded text-sm w-full"
                            value={brandForm.status}
                            onChange={(e) => setBrandForm({ ...brandForm, status: e.target.value as "aktif" | "arsip" })}
                          >
                            <option value="aktif">Aktif</option>
                            <option value="arsip">Arsip</option>
                          </select>
                        ) : (
                          <Badge variant={brand.status === 'aktif' ? 'success' : 'secondary'} className="uppercase text-[10px]">
                            {brand.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingBrand === brand.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleSaveBrand(brand.id)} className="text-green-600 hover:text-green-700">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingBrand(null)} className="text-slate-400 hover:text-slate-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingBrand(brand.id); setBrandForm({ nama: brand.nama, status: brand.status }); }}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {brands.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-slate-500">Belum ada brand.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* NICHE MANAGEMENT */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-600" />
              Master Niche
            </CardTitle>
            <CardDescription>
              Daftar kategori kreator. Niche ini akan muncul saat menambah kreator baru atau filter pencarian.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddNiche} className="flex gap-2">
              <input
                type="text"
                placeholder="Nama niche baru..."
                className="flex-1 p-2 border border-slate-300 rounded text-sm outline-none focus:ring-2 focus:ring-purple-500"
                value={newNicheName}
                onChange={(e) => setNewNicheName(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newNicheName.trim()}
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </form>

            <div className="border rounded overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Nama Niche</TableHead>
                    <TableHead className="w-20 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {niches.map(niche => (
                    <TableRow key={niche.id}>
                      <TableCell>
                        {editingNiche === niche.id ? (
                          <input
                            type="text"
                            className="w-full p-1 border rounded text-sm"
                            value={nicheForm.nama}
                            onChange={(e) => setNicheForm({ nama: e.target.value })}
                          />
                        ) : (
                          <span className="font-medium text-slate-700">{niche.nama}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingNiche === niche.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleSaveNiche(niche.id)} className="text-green-600 hover:text-green-700">
                              <Check className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingNiche(null)} className="text-slate-400 hover:text-slate-600">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingNiche(niche.id); setNicheForm({ nama: niche.nama }); }}
                            className="text-slate-400 hover:text-purple-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {niches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-4 text-slate-500">Belum ada niche.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
