"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { CreatorAddress } from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { Download } from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";

const supabase = createClient();

export default function AlamatPage() {
  const { id } = useParams();
  const campaignId = Number(id);

  const {
    campaign_creators,
    creators,
    creator_addresses,
    fetchCreatorAddresses,
    updateCreatorAddress,
    isLoading,
    campaigns
  } = useDatabaseStore();

  const campaign = campaigns.find(c => c.id === campaignId);

  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<CreatorAddress>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [localCreators, setLocalCreators] = useState<any[]>([]);
  const [isFetchingCC, setIsFetchingCC] = useState(true);

  useEffect(() => {
    fetchCreatorAddresses(campaignId);
  }, [campaignId, fetchCreatorAddresses]);

  useEffect(() => {
    const fetchCCs = async () => {
      if (!campaignId) return;
      setIsFetchingCC(true);
      let all: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        let query = supabase
          .from('campaign_creators')
          .select('*, creators(*)')
          .eq('campaign_id', campaignId)
          .in('approval', ['approved', 'alternate']);
          
        if (campaign?.require_client_approval) {
          query = query.eq('client_approval', 'approved');
        }

        const { data } = await query.range(from, from + 999);
        if (data && data.length > 0) {
          all = [...all, ...data];
          if (data.length < 1000) hasMore = false;
          else from += 1000;
        } else {
          hasMore = false;
        }
      }
      setLocalCreators(all);
      setIsFetchingCC(false);
    };
    fetchCCs();
  }, [campaignId, campaign?.require_client_approval]);

  const approvedCCs = localCreators.filter(cc => {
    if (searchQuery) {
      if (!cc.creators?.username.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  const handleExport = () => {
    const exportData = approvedCCs.map(cc => {
      const addr = creator_addresses.find(a => a.campaign_creator_id === cc.id);
      return {
        'Username': cc.creators?.username,
        'Nama Penerima': addr?.nama_penerima || '',
        'Alamat': addr?.nama_jalan || '',
        'Kecamatan': addr?.kecamatan || '',
        'Kota/Kabupaten': addr?.kabupaten_kota || '',
        'Provinsi': addr?.provinsi || '',
        'Kode Pos': addr?.kode_pos || '',
        'Resi': addr?.resi || '',
        'Status': addr?.proses || 'Diproses'
      };
    });
    exportToCSV(exportData, `campaign_${campaignId}_alamat`);
  };

  const handleEdit = (ccId: number) => {
    const existing = creator_addresses.find(a => a.campaign_creator_id === ccId);
    if (existing) {
      setFormData(existing);
      setEditId(existing.id);
    } else {
      setFormData({
        campaign_creator_id: ccId,
        proses: 'Diproses'
      });
      setEditId(-ccId); // Temp ID for new records
    }
  };

  const handleSave = async (ccId: number) => {
    setIsSaving(true);
    const existing = creator_addresses.find(a => a.campaign_creator_id === ccId);
    await updateCreatorAddress(existing?.id || null, formData);
    setEditId(null);
    setIsSaving(false);
  };

  if (isLoading && creator_addresses.length === 0) {
    return <div className="p-8 text-center text-slate-500">Memuat data alamat...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Data Alamat Pengiriman Sampel</CardTitle>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-sm hover:bg-slate-50"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <input 
              type="text" 
              placeholder="Cari username..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="p-2 border border-slate-300 rounded-md text-sm min-w-[200px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-48">Kreator</TableHead>
                  <TableHead>Alamat Lengkap</TableHead>
                  <TableHead className="w-32">Resi</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedCCs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      Belum ada kreator yang di-approve di campaign ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  approvedCCs.map((cc) => {
                    const creator = cc.creators;
                    const addr = creator_addresses.find(a => a.campaign_creator_id === cc.id);
                    const isEditing = editId === addr?.id || editId === -cc.id;

                    return (
                      <TableRow key={cc.id}>
                        <TableCell>
                          <div className="font-medium">@{creator?.username}</div>
                          <Badge variant="outline" className="mt-1 text-[10px] uppercase">{cc.approval}</Badge>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                placeholder="Nama Penerima"
                                className="w-full text-sm p-2 border rounded"
                                value={formData.nama_penerima || ''}
                                onChange={e => setFormData({ ...formData, nama_penerima: e.target.value })}
                              />
                              <textarea
                                placeholder="Jalan, RT/RW, Patokan"
                                className="w-full text-sm p-2 border rounded h-20"
                                value={formData.nama_jalan || ''}
                                onChange={e => setFormData({ ...formData, nama_jalan: e.target.value })}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  placeholder="Kecamatan"
                                  className="w-full text-sm p-2 border rounded"
                                  value={formData.kecamatan || ''}
                                  onChange={e => setFormData({ ...formData, kecamatan: e.target.value })}
                                />
                                <input
                                  type="text"
                                  placeholder="Kab/Kota"
                                  className="w-full text-sm p-2 border rounded"
                                  value={formData.kabupaten_kota || ''}
                                  onChange={e => setFormData({ ...formData, kabupaten_kota: e.target.value })}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  placeholder="Provinsi"
                                  className="w-full text-sm p-2 border rounded"
                                  value={formData.provinsi || ''}
                                  onChange={e => setFormData({ ...formData, provinsi: e.target.value })}
                                />
                                <input
                                  type="text"
                                  placeholder="Kode Pos"
                                  className="w-full text-sm p-2 border rounded"
                                  value={formData.kode_pos || ''}
                                  onChange={e => setFormData({ ...formData, kode_pos: e.target.value })}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm">
                              {addr ? (
                                <>
                                  <div className="font-semibold text-slate-700">{addr.nama_penerima || '-'}</div>
                                  <div className="text-slate-600 mt-1">{addr.nama_jalan}</div>
                                  <div className="text-slate-500 mt-1">
                                    {addr.kecamatan}, {addr.kabupaten_kota}, {addr.provinsi} {addr.kode_pos}
                                  </div>
                                </>
                              ) : (
                                <span className="text-slate-400 italic">Belum ada alamat di-input</span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <input
                              type="text"
                              placeholder="No. Resi"
                              className="w-full text-sm p-2 border rounded"
                              value={formData.resi || ''}
                              onChange={e => setFormData({ ...formData, resi: e.target.value })}
                            />
                          ) : (
                            <div className="text-sm font-mono">{addr?.resi || '-'}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <select
                              className="w-full text-sm p-2 border rounded"
                              value={formData.proses || 'Diproses'}
                              onChange={e => setFormData({ ...formData, proses: e.target.value })}
                            >
                              <option value="Diproses">Diproses</option>
                              <option value="Dikirim">Dikirim</option>
                              <option value="Diterima">Diterima</option>
                              <option value="Batal">Batal</option>
                            </select>
                          ) : (
                            <Badge variant={addr?.proses === 'Dikirim' || addr?.proses === 'Diterima' ? 'success' : 'secondary'}>
                              {addr?.proses || 'Diproses'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => handleSave(cc.id)}
                                disabled={isSaving}
                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 w-full"
                              >
                                {isSaving ? 'Menyimpan...' : 'Simpan'}
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-200 w-full"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEdit(cc.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              Edit Data
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
