"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { CreatorAddress } from "@/types/database";
import { createClient } from "@/utils/supabase/client";
import { Download, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";
import { useAuth } from "@/providers/AuthProvider";
import { MultiSelect } from "@/components/MultiSelect";

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
    campaigns,
    skus
  } = useDatabaseStore();

  const campaign = campaigns.find(c => c.id === campaignId);
  const campaignSkus = skus.filter(s => s.campaign_id === campaignId);

  const { canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);

  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<CreatorAddress>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [localCreators, setLocalCreators] = useState<any[]>([]);
  const [isFetchingCC, setIsFetchingCC] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'username', dir: 'asc' });

  const toggleSort = (key: string) => {
    setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig.key !== col) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-400" />;
    return sortConfig.dir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-blue-500" /> : <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />;
  };

  // Address Book state
  const [addressBook, setAddressBook] = useState<any[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>('');

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
          .eq('campaign_id', campaignId);
          
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

  const approvedCCs = localCreators
    .filter(cc => {
      if (searchQuery) {
        if (!cc.creators?.username.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sortConfig.dir === 'asc' ? 1 : -1;
      if (sortConfig.key === 'username') {
        return (a.creators?.username || '').localeCompare(b.creators?.username || '') * dir;
      }
      if (sortConfig.key === 'status') {
        const addrA = creator_addresses.find(x => x.campaign_creator_id === a.id)?.proses || '';
        const addrB = creator_addresses.find(x => x.campaign_creator_id === b.id)?.proses || '';
        return addrA.localeCompare(addrB) * dir;
      }
      return 0;
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
        'Produk Dikirim': addr?.produk_dikirim || '',
        'Resi': addr?.resi || '',
        'Status Pengiriman': addr?.proses || 'Diproses',
        'Tanggal Kirim': addr?.tanggal_kirim || '',
      };
    });
    exportToCSV(exportData, `campaign_${campaignId}_alamat`);
  };

  const [editAssignedSkus, setEditAssignedSkus] = useState<number[]>([]);
  const { updateCampaignCreator } = useDatabaseStore();

  const handleEdit = async (ccId: number) => {
    // 1. Fetch address book for this creator
    const cc = localCreators.find(c => c.id === ccId);
    const creatorId = cc?.creator_id;
    if (creatorId) {
      const { data: book } = await supabase.from('creator_address_book').select('*').eq('creator_id', creatorId).order('is_primary', { ascending: false });
      setAddressBook(book || []);
    } else {
      setAddressBook([]);
    }
    setSelectedBookId('');

    const existing = creator_addresses.find(a => a.campaign_creator_id === ccId);
    if (existing) {
      setFormData(existing);
      setEditId(existing.id);
    } else {
      // Find creator's master address as fallback if no address book
      const creator = cc?.creators;
      
      setFormData({
        campaign_creator_id: ccId,
        nama_penerima: creator?.alamat_penerima || '',
        nama_jalan: creator?.alamat_jalan || '',
        kecamatan: creator?.alamat_kecamatan || '',
        kabupaten_kota: creator?.alamat_kota || '',
        provinsi: creator?.alamat_provinsi || '',
        kode_pos: creator?.alamat_kodepos || '',
        proses: 'Diproses'
      });
      setEditId(-ccId); // Temp ID for new records
    }
    setEditAssignedSkus(cc?.assigned_sku_ids || []);
  };

  const handleSave = async (ccId: number) => {
    setIsSaving(true);
    const existing = creator_addresses.find(a => a.campaign_creator_id === ccId);
    await updateCreatorAddress(existing?.id || null, formData);
    
    // Save assigned_sku_ids
    const cc = localCreators.find(c => c.id === ccId);
    if (cc && JSON.stringify(cc.assigned_sku_ids || []) !== JSON.stringify(editAssignedSkus)) {
      await updateCampaignCreator(ccId, { assigned_sku_ids: editAssignedSkus }, 'System');
      // Update local state so it immediately reflects
      setLocalCreators(prev => prev.map(c => c.id === ccId ? { ...c, assigned_sku_ids: editAssignedSkus } : c));
    }
    
    // Auto-save to address book if not selected from book
    if (formData.nama_jalan && !selectedBookId) {
      if (cc && cc.creator_id) {
        // Check if exactly same address exists in book
        const isExist = addressBook.find(b => b.alamat_jalan?.toLowerCase() === formData.nama_jalan?.toLowerCase());
        if (!isExist) {
          await supabase.from('creator_address_book').insert({
            creator_id: cc.creator_id,
            label: 'Alamat Campaign ' + (campaign?.nama || ''),
            nama_penerima: formData.nama_penerima,
            alamat_jalan: formData.nama_jalan,
            kecamatan: formData.kecamatan,
            kota: formData.kabupaten_kota,
            provinsi: formData.provinsi,
            kodepos: formData.kode_pos
          });
        }
      }
    }

    setEditId(null);
    setIsSaving(false);
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    if (!bookId) return;
    const b = addressBook.find(x => x.id.toString() === bookId);
    if (b) {
      setFormData(prev => ({
        ...prev,
        nama_penerima: b.nama_penerima || '',
        nama_jalan: b.alamat_jalan || '',
        kecamatan: b.kecamatan || '',
        kabupaten_kota: b.kota || '',
        provinsi: b.provinsi || '',
        kode_pos: b.kodepos || ''
      }));
    }
  };

  if (isLoading && creator_addresses.length === 0) {
    return <div className="p-8 text-center text-slate-500">Memuat data alamat...</div>;
  }

  return (
    <div className="space-y-[24px] pb-[80px]">
      <div className="ccard !p-0 overflow-hidden">
        <div className="p-[16px] border-b border-line flex flex-col md:flex-row items-start md:items-center justify-between gap-[16px] bg-slate-50">
          <h3 className="font-semibold text-text text-[16px]">Data Alamat Pengiriman Sampel</h3>
          <div className="flex gap-[8px]">
            <button
              onClick={handleExport}
              className="btn btn-outline flex items-center gap-[8px] !py-[6px] !text-[13px]"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <input 
              type="text" 
              placeholder="Cari username..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="input min-w-[200px]"
            />
          </div>
        </div>
        <div className="tbl-wrap !border-0 !rounded-none">
          <table className="w-full">
            <thead className="border-b border-line bg-slate-50">
              <tr>
                <th className="w-48 py-[16px]">
                  <button onClick={() => toggleSort('username')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                    Kreator <SortIcon col="username" />
                  </button>
                </th>
                <th className="py-[16px]">Alamat Lengkap</th>
                <th className="w-32 py-[16px]">Resi</th>
                <th className="w-32 py-[16px]">
                  <button onClick={() => toggleSort('status')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                    Status <SortIcon col="status" />
                  </button>
                </th>
                {hasAccess && <th className="w-24 text-right py-[16px]">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {approvedCCs.length === 0 ? (
                <tr>
                  <td colSpan={hasAccess ? 5 : 4} className="text-center py-8 text-text-soft">
                    Belum ada kreator yang di-approve di campaign ini.
                  </td>
                </tr>
              ) : (
                approvedCCs.map((cc) => {
                  const creator = cc.creators;
                  const addr = creator_addresses.find(a => a.campaign_creator_id === cc.id);
                  const isEditing = editId === addr?.id || editId === -cc.id;

                  return (
                    <tr key={cc.id} className="border-b border-line hover:bg-slate-50/50">
                      <td>
                        <div className="font-medium flex items-center gap-2">
                          @{creator?.username}
                          {cc.approval !== 'approved' && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-bold" title="Silakan cek status kreator ini di bagian Listing">
                              ⚠️ Listing: {cc.approval}
                            </span>
                          )}
                        </div>
                        {cc.approval === 'approved' && (
                          <span className="inline-block mt-[4px] px-[8px] py-[2px] border border-line rounded-[4px] text-[10px] font-semibold text-text-soft uppercase bg-slate-100">{cc.approval}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="space-y-[8px]">
                            {addressBook.length > 0 && (
                              <select 
                                value={selectedBookId}
                                onChange={e => handleSelectBook(e.target.value)}
                                className="input w-full bg-blue-50 border-blue-300 text-blue-800 font-medium"
                              >
                                <option value="">-- Ketik Alamat Baru --</option>
                                {addressBook.map(b => (
                                  <option key={b.id} value={b.id.toString()}>{b.label || 'Alamat'} - {b.alamat_jalan?.substring(0,30)}...</option>
                                ))}
                              </select>
                            )}
                            <input
                              type="text"
                              placeholder="Nama Penerima"
                              className="input w-full"
                              value={formData.nama_penerima || ''}
                              onChange={e => setFormData({ ...formData, nama_penerima: e.target.value })}
                            />
                            <textarea
                              placeholder="Jalan, RT/RW, Patokan"
                              className="input w-full h-20"
                              value={formData.nama_jalan || ''}
                              onChange={e => setFormData({ ...formData, nama_jalan: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-[8px]">
                              <input
                                type="text"
                                placeholder="Kecamatan"
                                className="input w-full"
                                value={formData.kecamatan || ''}
                                onChange={e => setFormData({ ...formData, kecamatan: e.target.value })}
                              />
                              <input
                                type="text"
                                placeholder="Kab/Kota"
                                className="input w-full"
                                value={formData.kabupaten_kota || ''}
                                onChange={e => setFormData({ ...formData, kabupaten_kota: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-[8px]">
                              <input
                                type="text"
                                placeholder="Provinsi"
                                className="input w-full"
                                value={formData.provinsi || ''}
                                onChange={e => setFormData({ ...formData, provinsi: e.target.value })}
                              />
                              <input
                                type="text"
                                placeholder="Kode Pos"
                                className="input w-full"
                                value={formData.kode_pos || ''}
                                onChange={e => setFormData({ ...formData, kode_pos: e.target.value })}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-[13px]">
                            {addr ? (
                              <>
                                <div className="font-semibold text-text">{addr.nama_penerima || '-'}</div>
                                <div className="text-text-soft mt-[4px]">{addr.nama_jalan}</div>
                                <div className="text-text-soft mt-[4px]">
                                  {addr.kecamatan}, {addr.kabupaten_kota}, {addr.provinsi} {addr.kode_pos}
                                </div>
                              </>
                            ) : (
                              <span className="text-text-soft italic">Belum ada alamat di-input</span>
                            )}
                          </div>
                        )}

                        {isEditing ? (
                          <div className="mt-[12px]">
                            <MultiSelect 
                              options={campaignSkus.map(s => ({ id: s.id, label: s.nama_produk }))}
                              selectedIds={editAssignedSkus}
                              onChange={setEditAssignedSkus}
                              placeholder="Pilih Produk..."
                              emptyMessage="Belum ada produk"
                            />
                            {campaignSkus.length === 0 && (
                              <p className="text-[10px] text-orange-600 mt-1">
                                Jika produk belum ada di list, maka daftarkan di bagian tab Produk.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="mt-[12px] text-[13px] flex flex-wrap gap-1">
                            <span className="font-medium text-text-soft block w-full mb-1">Produk:</span>
                            {cc.assigned_sku_ids && cc.assigned_sku_ids.length > 0 ? (
                              cc.assigned_sku_ids.map((id: number) => {
                                const sku = campaignSkus.find(s => s.id === id);
                                return sku ? <span key={id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded border border-blue-100">{sku.nama_produk}</span> : null;
                              })
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Belum dipilih</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            placeholder="No. Resi"
                            className="input w-full"
                            value={formData.resi || ''}
                            onChange={e => setFormData({ ...formData, resi: e.target.value })}
                          />
                        ) : (
                          <div className="text-[13px] font-mono">{addr?.resi || '-'}</div>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="input w-full"
                            value={formData.proses || 'Diproses'}
                            onChange={e => setFormData({ ...formData, proses: e.target.value })}
                          >
                            <option value="Diproses">Diproses</option>
                            <option value="Dikirim">Dikirim</option>
                            <option value="Diterima">Diterima</option>
                            <option value="Batal">Batal</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-[8px] py-[4px] rounded-[6px] text-[11px] font-bold ${(addr?.proses === 'Dikirim' || addr?.proses === 'Diterima') ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                            {addr?.proses || 'Diproses'}
                          </span>
                        )}
                      </td>
                      {hasAccess && (
                        <td className="text-right align-top">
                          {isEditing ? (
                            <div className="flex flex-col gap-[8px]">
                              <button
                                onClick={() => handleSave(cc.id)}
                                disabled={isSaving}
                                className="btn btn-primary w-full !py-[6px] !text-[12px]"
                              >
                                {isSaving ? 'Menyimpan...' : 'Simpan'}
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="btn btn-outline w-full !py-[6px] !text-[12px]"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEdit(cc.id)}
                              className="text-[12px] text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                            >
                              Edit Data
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
