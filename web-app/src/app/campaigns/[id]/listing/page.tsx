"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { getCreatorType, getJenisKerjasama } from "@/utils/computed";
import { ChevronDown, ChevronRight, ChevronLeft, Edit2, Check, X, Loader2, Trash2, Download, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { exportToCSV } from "@/utils/exportCsv";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/providers/AuthProvider";

const supabase = createClient();
const PAGE_SIZE = 50;

export default function CampaignListingPage() {
  return (
    <ErrorBoundary>
      <CampaignListingContent />
    </ErrorBoundary>
  );
}

function CampaignListingContent() {
  const { id } = useParams();
  const campaignId = Number(id);
  
  const { 
    updateCampaignCreator,
    addCampaignCreator,
    campaigns,
    profiles
  } = useDatabaseStore();

  const { profile, canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);

  const campaign = campaigns.find(c => c.id === campaignId);
  const isClientApprovalRequired = campaign?.require_client_approval || false;

  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState('0');
  const [editQtyVt, setEditQtyVt] = useState('1');
  const [editApproval, setEditApproval] = useState<any>('');
  const [editClientApproval, setEditClientApproval] = useState<any>('');
  const [editSampleProgress, setEditSampleProgress] = useState<any>('Done Req Sample');
  const [editStatusBayar, setEditStatusBayar] = useState<any>('belum');
  const [editNotesManager, setEditNotesManager] = useState('');
  const [editNotesPic, setEditNotesPic] = useState('');

  const [filterType, setFilterType] = useState<'all' | 'regular' | 'auto_detect'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'alternate' | 'not_approved'>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'id', dir: 'desc' });

  const toggleSort = (key: string) => {
    setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig.key !== col) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-400" />;
    return sortConfig.dir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-blue-500" /> : <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />;
  };

  // Data State
  const [listingData, setListingData] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Counts State
  const [counts, setCounts] = useState({ approved: 0, pending: 0, alternate: 0, not_approved: 0, all: 0 });
  
  // Daily Recap State
  const [dailyRecap, setDailyRecap] = useState<any[]>([]);
  const [recapStartIndex, setRecapStartIndex] = useState(0);

  // Add Creator Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCreatorId, setNewCreatorId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newPrice, setNewPrice] = useState<string>('0');
  const [newQtyVt, setNewQtyVt] = useState<string>('1');
  const [filteredCreators, setFilteredCreators] = useState<any[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(tableSearch);
    }, 500);
    return () => clearTimeout(handler);
  }, [tableSearch]);

  const fetchCounts = useCallback(async () => {
    // Supabase has a default limit of 1000 rows for data fetching.
    // To get the true counts for large campaigns, we use head: true and count: 'exact'
    const getCount = async (status?: string) => {
      let query = supabase.from('campaign_creators').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId);
      if (status) query = query.eq('approval', status);
      const { count } = await query;
      return count || 0;
    };

    const [all, approved, pending, alternate, not_approved] = await Promise.all([
      getCount(),
      getCount('approved'),
      getCount('pending'),
      getCount('alternate'),
      getCount('not_approved')
    ]);

    setCounts({ approved, pending, alternate, not_approved, all });

    // Fetch Daily Recap Data
    const { data: recapData } = await supabase.from('campaign_creators').select('id, approval, approved_at, created_at').eq('campaign_id', campaignId);
    if (recapData) {
      // Group by date
      const group: Record<string, { total: number, approved: number, pending: number, alternate: number, not_approved: number }> = {};
      recapData.forEach(r => {
        // Use approved_at if approved/alternate/not_approved, else created_at
        const dateStr = r.approved_at || r.created_at;
        if (!dateStr) return;
        const dateKey = new Date(dateStr).toISOString().split('T')[0];
        if (!group[dateKey]) group[dateKey] = { total: 0, approved: 0, pending: 0, alternate: 0, not_approved: 0 };
        
        group[dateKey].total++;
        if (r.approval === 'approved') group[dateKey].approved++;
        else if (r.approval === 'alternate') group[dateKey].alternate++;
        else if (r.approval === 'not_approved') group[dateKey].not_approved++;
        else if (r.approval === 'pending') group[dateKey].pending++;
      });
      // Sort ascending so oldest is first, newest is last
      const sortedKeys = Object.keys(group).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      const recapArr = sortedKeys.map(k => ({ date: k, ...group[k] }));
      setDailyRecap(recapArr);
      // Start window at the very end
      setRecapStartIndex(Math.max(0, recapArr.length - 4));
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const fetchListing = useCallback(async (pageNum: number, isReset = false) => {
    setIsLoading(true);
    try {
      let selectQuery = `
        id, creator_id, price, qty_vt, approval, client_approval, tier,
        sample_progress, status_bayar, notes_manager, notes_pic,
        created_at,
        added_by_profile:profiles!campaign_creators_added_by_fkey ( nama ),
        creators!inner (
          id, username, nama_asli, link_account,
          creator_snapshots ( id, audience_age, level, gmv_30d, tanggal_update, followers, tier ),
          creator_niches ( niches ( nama ) )
        ),
        videos (
          id, urutan, concept, link_video, vt_approval
        )
      `;

      let query: any = supabase.from('campaign_creators').select(selectQuery).eq('campaign_id', campaignId);

      // Filters
      if (filterType === 'auto_detect') query = query.eq('tier', 'Auto-Detect');
      if (filterType === 'regular') query = query.neq('tier', 'Auto-Detect');
      if (statusFilter !== 'all') query = query.eq('approval', statusFilter);

      if (debouncedSearch) {
        query = query.or(`username.ilike.%${debouncedSearch}%,nama_asli.ilike.%${debouncedSearch}%`, { foreignTable: 'creators' });
      }

      // Pagination
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      // Sorting - map UI key to actual DB column
      const sortMap: Record<string, string> = {
        'id': 'id',
        'username': 'creator_id', // We'll sort by ID as proxy for username server-side
        'price': 'price',
        'qty_vt': 'qty_vt',
        'approval': 'approval'
      };
      const dbCol = sortMap[sortConfig.key] || 'id';
      query = query.order(dbCol, { ascending: sortConfig.dir === 'asc' }).range(from, to);

      const { data, error } = await query;
      if (error) throw error;

      if (isReset) {
        setListingData(data || []);
      } else {
        setListingData(prev => [...prev, ...(data || [])]);
      }

      setHasMore((data || []).length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, filterType, statusFilter, debouncedSearch, sortConfig]);

  useEffect(() => {
    setPage(0);
    fetchListing(0, true);
  }, [debouncedSearch, filterType, statusFilter, sortConfig, fetchListing]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchListing(next, false);
  };

  // Search Add Creator dynamically
  useEffect(() => {
    const searchAvailable = async () => {
      if (!searchQuery) {
        setFilteredCreators([]);
        return;
      }
      const fuzzyPattern = '%' + searchQuery.split('').join('%') + '%';
      const { data } = await supabase.from('creators')
        .select('id, username')
        .ilike('username', fuzzyPattern)
        .limit(30);
      
      if (data) {
        // Sort locally by length to bring the closest match to the top
        const sorted = data.sort((a, b) => a.username.length - b.username.length).slice(0, 10);
        setFilteredCreators(sorted);
      } else {
        setFilteredCreators([]);
      }
    };
    const handler = setTimeout(searchAvailable, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const toggleExpand = (ccId: number) => {
    setExpandedRows(prev => ({ ...prev, [ccId]: !prev[ccId] }));
  };

  const startEdit = (cc: any) => {
    setEditingId(cc.id);
    setEditPrice(cc.price?.toString() || '0');
    setEditQtyVt(cc.qty_vt?.toString() || '1');
    setEditApproval(cc.approval);
    setEditClientApproval(cc.client_approval || 'not_required');
    setEditSampleProgress(cc.sample_progress || 'Done Req Sample');
    setEditStatusBayar(cc.status_bayar || 'belum');
    setEditNotesManager(cc.notes_manager || '');
    setEditNotesPic(cc.notes_pic || '');
  };

  const saveEdit = async (ccId: number) => {
    if (!hasAccess) return;
    const oldCc = listingData.find(c => c.id === ccId);
    let extraUpdates: any = {};
    if (oldCc && oldCc.approval !== editApproval) {
      if (editApproval === 'approved') {
        extraUpdates.approved_by = profile?.id;
        extraUpdates.approved_at = new Date().toISOString();
      } else if (editApproval === 'not_approved') {
        extraUpdates.not_approved_by = profile?.id;
        extraUpdates.not_approved_at = new Date().toISOString();
      }
    }

    await updateCampaignCreator(ccId, {
      price: Number(editPrice),
      qty_vt: Number(editQtyVt),
      approval: editApproval,
      sample_progress: editSampleProgress,
      status_bayar: editStatusBayar,
      notes_manager: editNotesManager,
      notes_pic: editNotesPic,
      ...(isClientApprovalRequired && { client_approval: editClientApproval }),
      ...extraUpdates
    }, profile?.nama || 'System');
    setEditingId(null);
    // Refresh to show changes immediately
    setPage(0);
    fetchListing(0, true);
    fetchCounts();
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleDeleteCreator = async (ccId: number) => {
    if (!confirm('Yakin ingin mengeluarkan kreator ini dari campaign? Data performa campaign kreator ini akan ikut terhapus. (Kreator tetap ada di Pool)')) return;
    try {
      await useDatabaseStore.getState().deleteCampaignCreator(ccId);
      // Refresh to show changes immediately
      setPage(0);
      fetchListing(0, true);
      fetchCounts();
    } catch (err) {
      alert('Gagal menghapus kreator.');
    }
  };

  const handleAddCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCreatorId || !hasAccess) return;

    await addCampaignCreator({
      campaign_id: campaignId,
      creator_id: Number(newCreatorId),
      tier: 'NANO',
      price: Number(newPrice),
      qty_vt: Number(newQtyVt),
      content_type: null,
      approval: 'pending',
      pic_assist: profile?.nama || '-',
      notes_manager: '',
      notes_pic: '',
      sample_progress: 'Belum',
      gmv_organic_legacy: 0,
      gmv_ads_legacy: 0,
      status_bayar: 'belum',
      nominal_pelunasan: 0,
      tgl_pembayaran: null,
      client_approval: isClientApprovalRequired ? 'pending' : 'not_required',
      added_by: profile?.id || null,
      approved_by: null,
      approved_at: null,
      not_approved_by: null,
      not_approved_at: null,
      payment_updated_by: null,
      payment_updated_at: null
    });
    
    setIsAddModalOpen(false);
    setNewCreatorId('');
    setSearchQuery('');
    setNewPrice('0');
    setNewQtyVt('1');
    
    // Refresh data
    setPage(0);
    fetchListing(0, true);
    fetchCounts();
  };

  const handleExport = () => {
    const exportData = listingData.map((cc) => {
      const creator = cc.creators || {};
      const snapshot = creator.creator_snapshots?.[0] || {};
      return {
        'Username': creator.username || '',
        'Nama Asli': creator.nama_asli || '',
        'Link Account': creator.link_account || '',
        'Level': snapshot.level || '',
        'Followers': snapshot.followers || 0,
        'Tier Rate Card': cc.tier,
        'Price': cc.price,
        'Qty VT': cc.qty_vt,
        'Status Klien': cc.client_approval,
        'Status Internal': cc.approval
      };
    });
    exportToCSV(exportData, `campaign_${campaignId}_creators`);
  };

  return (
    <div className="space-y-[32px]">
      <div className="flex justify-between items-start mb-[24px] gap-[16px] flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold">Daftar Creator</h2>
          <p className="text-[13px] text-text-soft">Kelola status dan rate card creator di campaign ini. (Paginated)</p>
        </div>
        <div className="flex flex-wrap gap-[10px] items-center justify-end">
          <button className="btn btn-outline" onClick={handleExport}>
            <Download className="ico" /> Export
          </button>
          <input 
            type="text" 
            placeholder="Cari username..." 
            value={tableSearch} 
            onChange={e => setTableSearch(e.target.value)} 
            className="input min-w-[200px]"
          />
          <select 
            value={filterType}
            onChange={(e: any) => setFilterType(e.target.value)}
            className="select min-w-[150px]"
          >
            <option value="all">Semua Tipe</option>
            <option value="regular">Reguler (Manual)</option>
            <option value="auto_detect">Auto-Detect</option>
          </select>
          {isClientApprovalRequired && hasAccess && (
            <button className="btn btn-outline" onClick={async () => {
              const pendingIds = listingData.filter(cc => cc.client_approval === 'not_required' || cc.client_approval === 'pending').map(cc => cc.id);
              if (pendingIds.length === 0) {
                alert('Semua kreator sudah disetujui / ditolak klien.');
                return;
              }
              if (confirm(`Approve ${pendingIds.length} kreator sekaligus?`)) {
                for (const id of pendingIds) {
                  await updateCampaignCreator(id, { client_approval: 'approved' }, profile?.nama || 'Bulk Action');
                }
                setPage(0);
                fetchListing(0, true);
              }
            }}>
              Bulk Approve Klien
            </button>
          )}

          {hasAccess && (
            <button className="btn btn-primary" onClick={() => {
              setIsAddModalOpen(true);
              setSearchQuery('');
              setNewCreatorId('');
            }}>
              + Tambah Creator
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-[16px] mb-[32px]">
        <div className={`metric cursor-pointer ${statusFilter === 'all' ? 'ring-2 ring-p300' : ''}`} onClick={() => setStatusFilter('all')}>
          <div className="mlbl">Total Creator</div>
          <div className="mval">{counts.all}</div>
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'approved' ? 'ring-2 ring-green-500 bg-green-50/50' : ''}`} onClick={() => setStatusFilter('approved')}>
          <div className="mlbl text-green-700">Approved</div>
          <div className="mval text-green-700">{counts.approved}</div>
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'pending' ? 'ring-2 ring-orange-400 bg-orange-50/50' : ''}`} onClick={() => setStatusFilter('pending')}>
          <div className="mlbl text-orange-600">Pending</div>
          <div className="mval text-orange-600">{counts.pending}</div>
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'alternate' ? 'ring-2 ring-purple-400 bg-purple-50/50' : ''}`} onClick={() => setStatusFilter('alternate')}>
          <div className="mlbl text-purple-600">Alternate</div>
          <div className="mval text-purple-600">{counts.alternate}</div>
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'not_approved' ? 'ring-2 ring-red-400 bg-red-50/50' : ''}`} onClick={() => setStatusFilter('not_approved')}>
          <div className="mlbl text-red-600">Not Approved</div>
          <div className="mval text-red-600">{counts.not_approved}</div>
        </div>
      </div>

      <div className="ccard mb-[24px] !p-0 overflow-hidden">
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between bg-slate-50 px-[16px] py-[12px] font-semibold text-text hover:bg-slate-100 transition-colors">
            <span>Rekap Harian (Progres Pencarian & Approval)</span>
            <span className="transition group-open:rotate-180">
              <ChevronDown className="w-5 h-5 text-text-soft" />
            </span>
          </summary>
          <div className="border-t border-line bg-white p-[16px] overflow-hidden">
            {dailyRecap.length === 0 ? (
              <p className="text-[13px] text-text-soft text-center py-[16px]">Belum ada progres terekam.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] text-left">
                  <thead className="bg-slate-50 border-b border-line">
                    <tr>
                      <th className="p-[12px] font-semibold text-text border-r border-line w-32">Tanggal</th>
                      <th className="p-[8px] border-r border-line text-center w-10">
                        <button 
                          onClick={() => setRecapStartIndex(Math.max(0, recapStartIndex - 1))}
                          disabled={recapStartIndex === 0}
                          className="p-[4px] hover:bg-slate-200 rounded disabled:opacity-30"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </th>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <th key={d.date} className="p-[12px] font-semibold text-text text-center border-r border-line min-w-[120px]">
                          {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </th>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => (
                        <th key={`empty-th-${i}`} className="p-[12px] border-r border-line min-w-[120px]"></th>
                      ))}
                      <th className="p-[8px] text-center w-10">
                        <button 
                          onClick={() => setRecapStartIndex(Math.min(Math.max(0, dailyRecap.length - 5), recapStartIndex + 1))}
                          disabled={recapStartIndex >= dailyRecap.length - 5}
                          className="p-[4px] hover:bg-slate-200 rounded disabled:opacity-30"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-line">
                      <td className="p-[12px] font-medium text-text-soft border-r border-line">Total Add</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`total-${d.date}`} className="p-[12px] text-center border-r border-line font-semibold text-text bg-slate-50/50">{d.total}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e1-${i}`} className="border-r border-line bg-slate-50/50"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="p-[12px] font-medium text-orange-600 border-r border-line">Pending</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`pending-${d.date}`} className="p-[12px] text-center border-r border-line font-semibold text-orange-600">{d.pending}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e2-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="p-[12px] font-medium text-green-600 border-r border-line">Approve</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`approve-${d.date}`} className="p-[12px] text-center border-r border-line font-semibold text-green-600">{d.approved}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e3-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b border-line">
                      <td className="p-[12px] font-medium text-red-600 border-r border-line">Not Approve</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`not_approve-${d.date}`} className="p-[12px] text-center border-r border-line font-semibold text-red-600">{d.not_approved}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e4-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr>
                      <td className="p-[12px] font-medium text-purple-600 border-r border-line">Alternate</td>
                      <td className="border-r border-line bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`alternate-${d.date}`} className="p-[12px] text-center border-r border-line font-semibold text-purple-600">{d.alternate}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e5-${i}`} className="border-r border-line"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-[24px] rounded-[16px] w-full max-w-md shadow-xl">
            <h3 className="text-[18px] font-bold mb-[16px]">Tambah Creator ke Campaign</h3>
            <form onSubmit={handleAddCreator} className="space-y-[16px]">
              <div>
                <label className="text-[13px] font-semibold text-text block mb-[6px]">Cari & Pilih Creator</label>
                <input 
                  type="text"
                  placeholder="Ketik username creator..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input mb-[8px]"
                />
                
                <div className="border border-line rounded-[8px] max-h-40 overflow-y-auto bg-slate-50">
                  {filteredCreators.length === 0 ? (
                    <div className="p-3 text-[13px] text-text-soft text-center">
                      {searchQuery ? "Creator tidak ditemukan" : "Ketik untuk mencari..."}
                    </div>
                  ) : (
                    filteredCreators.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => setNewCreatorId(c.id.toString())}
                        className={`p-[10px] text-[13px] cursor-pointer border-b border-line last:border-0 hover:bg-p50 transition-colors ${newCreatorId === c.id.toString() ? 'bg-p50 font-semibold text-p300' : ''}`}
                      >
                        @{c.username}
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-[16px]">
                <div>
                  <label className="text-[13px] font-semibold text-text block mb-[6px]">Price / Rate (Rp)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    className="input"
                  />
                  <p className="text-[11px] text-text-soft mt-[4px]">Isi 0 untuk Barter</p>
                </div>
                <div>
                  <label className="text-[13px] font-semibold text-text block mb-[6px]">Qty VT SOW</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={newQtyVt}
                    onChange={e => setNewQtyVt(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-[10px] mt-[24px]">
                <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={!newCreatorId}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="tbl-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>
                <button onClick={() => toggleSort('username')} className="flex items-center text-left font-semibold hover:text-p300 transition-colors">
                  Creator <SortIcon col="username" />
                </button>
              </th>
              <th className="text-right">Followers</th>
              <th className="text-right">Tier</th>
              <th className="text-center">Level</th>
              <th>Niche</th>
              <th>Tanggal & PIC</th>
              <th>Kerjasama</th>
              <th>
                <button onClick={() => toggleSort('price')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Price (Rp) <SortIcon col="price" />
                </button>
              </th>
              <th>
                <button onClick={() => toggleSort('qty_vt')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Qty VT SOW <SortIcon col="qty_vt" />
                </button>
              </th>
              <th>Tipe Konten</th>
              <th>
                <button onClick={() => toggleSort('approval')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Approval <SortIcon col="approval" />
                </button>
              </th>
              {isClientApprovalRequired && <th>Client Status</th>}
              <th className="text-right">GMV Creator</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {listingData.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={isClientApprovalRequired ? 11 : 10} className="text-center py-[32px] text-text-soft">
                  Belum ada creator di campaign ini.
                </td>
              </tr>
            ) : (
              listingData.map((cc) => {
                const creator = cc.creators;
                if (!creator) return null;
                const snaps = creator.creator_snapshots || [];
                const snapshot = snaps.length > 0 ? snaps.sort((a:any, b:any) => {
                  const tDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
                  if (tDiff !== 0) return tDiff;
                  return b.id - a.id;
                })[0] : null;
                const type = getCreatorType(snapshot?.audience_age || null);
                const gmvCreator = snapshot?.gmv_30d || 0;
                const isExpanded = expandedRows[cc.id];
                const isEditing = editingId === cc.id;
                const creatorVideos = cc.videos || [];

                return (
                  <React.Fragment key={cc.id}>
                    <tr className="group hover:bg-[#f8fafc] transition-colors">
                      <td>
                        <button onClick={() => toggleExpand(cc.id)} className="p-[4px] hover:bg-slate-200 rounded">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-text-soft" /> : <ChevronRight className="w-4 h-4 text-text-soft" />}
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center gap-[8px]">
                          <Link href={`/creator-pool/${creator.id}`} className="font-semibold text-p300 hover:underline block">
                            @{creator.username}
                          </Link>
                          {cc.tier === 'Auto-Detect' && <span className="px-[6px] py-[2px] bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded-full">AUTO</span>}
                        </div>
                        <span className="text-[12px] text-text-soft">{type}</span>
                      </td>
                      <td className="text-right text-[13px] font-medium text-text">
                        {snapshot?.followers ? snapshot.followers.toLocaleString() : '-'}
                      </td>
                      <td className="text-right text-[13px] font-medium text-text">
                        {snapshot?.tier || '-'}
                      </td>
                      <td className="text-center text-[13px] font-medium text-text">
                        {snapshot?.level || '-'}
                      </td>
                      <td className="text-[12px] text-text-soft">
                        <div className="flex flex-wrap gap-[4px] max-w-[150px]">
                           {creator.creator_niches?.map((cn: any, idx: number) => (
                             cn.niches?.nama ? <span key={idx} className="bg-slate-100 text-slate-600 px-[6px] py-[2px] rounded text-[10px]">{cn.niches.nama}</span> : null
                           ))}
                        </div>
                      </td>
                      <td>
                        <div className="text-[12px] text-text">
                          {cc.created_at ? new Date(cc.created_at).toLocaleDateString('id-ID') : '-'}
                        </div>
                        <div className="text-[11px] text-text-soft mt-[2px]">
                          Oleh: {cc.added_by_profile?.nama || 'System'}
                        </div>
                      </td>
                      <td className="capitalize text-[13px] font-medium">
                        {getJenisKerjasama(cc.price)}
                      </td>
                      <td>
                        {isEditing ? (
                          <input 
                            type="number" 
                            value={editPrice} 
                            onChange={e => setEditPrice(e.target.value)}
                            className="input w-24 !p-[4px]"
                          />
                        ) : (
                          <span className="text-[13px] font-semibold text-text">Rp {cc.price.toLocaleString()}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input 
                            type="number" 
                            min="1"
                            value={editQtyVt} 
                            onChange={e => setEditQtyVt(e.target.value)}
                            className="input w-16 !p-[4px] text-center"
                          />
                        ) : (
                          <span className="text-[13px] font-medium">{cc.qty_vt}</span>
                        )}
                      </td>
                      <td>
                        <span className="text-[13px] font-medium text-text">{cc.content_type || '-'}</span>
                      </td>
                      <td>
                        {isEditing ? (
                          <select 
                            value={editApproval} 
                            onChange={e => setEditApproval(e.target.value)}
                            className="select !p-[4px]"
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="alternate">Alternate</option>
                            <option value="not_approved">Not Approved</option>
                          </select>
                        ) : (
                          <span className={`badge ${
                            cc.approval === 'approved' ? 'b-approved' : 
                            cc.approval === 'not_approved' ? 'b-rejected' : 
                            cc.approval === 'alternate' ? 'b-alternate' : 'b-pending'
                          }`}>
                            {cc.approval}
                          </span>
                        )}
                      </td>
                      {isClientApprovalRequired && (
                        <td>
                          {isEditing ? (
                            <select 
                              value={editClientApproval} 
                              onChange={e => setEditClientApproval(e.target.value)}
                              className="select !p-[4px]"
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          ) : (
                            <span className={`badge ${
                              cc.client_approval === 'approved' ? 'b-success' : 
                              cc.client_approval === 'rejected' ? 'b-destructive' : 'b-neutral'
                            }`}>
                              {cc.client_approval === 'not_required' ? 'Pending' : cc.client_approval}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="text-right text-[13px] font-medium">
                        {gmvCreator > 0 ? `Rp ${gmvCreator.toLocaleString()}` : '-'}
                      </td>
                      <td className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-[4px]">
                            <button onClick={() => saveEdit(cc.id)} className="p-[6px] hover:bg-green-50 rounded text-green-600"><Check className="w-4 h-4" /></button>
                            <button onClick={cancelEdit} className="p-[6px] hover:bg-slate-100 rounded text-text-soft"><X className="w-4 h-4" /></button>
                          </div>
                        ) : hasAccess ? (
                          <div className="flex justify-end gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(cc)} className="p-[6px] hover:bg-p50 rounded">
                              <Edit2 className="w-4 h-4 text-text-soft hover:text-p300" />
                            </button>
                            <button onClick={() => handleDeleteCreator(cc.id)} className="p-[6px] hover:bg-red-50 rounded">
                              <Trash2 className="w-4 h-4 text-text-soft hover:text-red-600" />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    
                    {/* Expandable Video Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50 hover:bg-slate-50">
                        <td></td>
                        <td colSpan={isClientApprovalRequired ? 8 : 7} className="p-0 border-b-0">
                          <div className="py-[16px] pr-[16px]">
                            <div className="bg-white border border-line rounded-[12px] p-[16px]">
                              <h4 className="text-[12px] font-bold text-text-soft uppercase mb-[12px]">Daftar Video ({cc.qty_vt})</h4>
                              {creatorVideos.length > 0 ? (
                                <table className="w-full text-[13px]">
                                  <thead>
                                    <tr className="text-text-soft border-b border-line">
                                      <th className="font-semibold text-left pb-[8px] w-10">#</th>
                                      <th className="font-semibold text-left pb-[8px]">Konsep</th>
                                      <th className="font-semibold text-left pb-[8px]">Link Video</th>
                                      <th className="font-semibold text-left pb-[8px] w-32">VT Approval</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {creatorVideos.map((v: any) => (
                                      <tr key={v.id} className="border-b border-line last:border-0">
                                        <td className="py-[8px]">{v.urutan}</td>
                                        <td className="py-[8px]">{v.concept || '-'}</td>
                                        <td className="py-[8px]">
                                          {v.link_video ? (
                                            <a href={v.link_video} target="_blank" rel="noreferrer" className="text-p300 hover:underline break-all">
                                              {v.link_video}
                                            </a>
                                          ) : '-'}
                                        </td>
                                        <td className="py-[8px]">
                                          <span className={`badge ${v.vt_approval === 'approved' ? 'b-success' : v.vt_approval === 'reject' ? 'b-destructive' : 'b-neutral'}`}>
                                            {v.vt_approval}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                ) : (
                                  <p className="text-[13px] text-text-soft text-center py-[8px]">Belum ada video ditambahkan.</p>
                                )}

                                {/* Tambahan Detail Sesuai Request */}
                                <div className="mt-[24px] pt-[16px] border-t border-line">
                                  <h4 className="text-[12px] font-bold text-text-soft uppercase mb-[12px]">Detail & Catatan Kreator</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
                                    <div className="bg-slate-50 border border-line rounded-[8px] p-[12px]">
                                      <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[4px]">Status Pembayaran</h5>
                                      {isEditing ? (
                                        <select value={editStatusBayar} onChange={e=>setEditStatusBayar(e.target.value)} className="select !p-[4px]">
                                          <option value="belum">Belum</option>
                                          <option value="dp">DP</option>
                                          <option value="lunas">Lunas</option>
                                        </select>
                                      ) : (
                                        <p className="text-[13px] font-semibold text-text capitalize">{cc.status_bayar || '-'}</p>
                                      )}
                                    </div>
                                    <div className="bg-slate-50 border border-line rounded-[8px] p-[12px]">
                                      <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[4px]">Progress Sample</h5>
                                      {isEditing ? (
                                        <select value={editSampleProgress} onChange={e=>setEditSampleProgress(e.target.value)} className="select !p-[4px]">
                                          <option value="Done Req Sample">Done Req Sample</option>
                                          <option value="Sudah Proses Pengiriman">Sudah Proses Pengiriman</option>
                                          <option value="Sampai">Sampai</option>
                                          <option value="Kendala [FU!]">Kendala [FU!]</option>
                                        </select>
                                      ) : (
                                        <span className={`badge ${
                                          cc.sample_progress === 'Sampai' ? 'b-success' : 
                                          cc.sample_progress === 'Kendala [FU!]' ? 'b-destructive' : 
                                          cc.sample_progress === 'Sudah Proses Pengiriman' ? 'b-warning' : 'b-neutral'
                                        }`}>
                                          {cc.sample_progress || '-'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-2">
                                      <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[4px]">Notes Manager</h5>
                                      {isEditing ? (
                                        <textarea value={editNotesManager} onChange={e=>setEditNotesManager(e.target.value)} className="input h-16" placeholder="Catatan Manager..." />
                                      ) : (
                                        <p className="text-[13px] font-medium text-text whitespace-pre-wrap">{cc.notes_manager || '-'}</p>
                                      )}
                                    </div>
                                    <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-4">
                                      <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[4px]">Notes PIC ({cc.pic_assist || 'Belum di-assign'})</h5>
                                      {isEditing ? (
                                        <textarea value={editNotesPic} onChange={e=>setEditNotesPic(e.target.value)} className="input h-16" placeholder="Catatan PIC..." />
                                      ) : (
                                        <p className="text-[13px] font-medium text-text whitespace-pre-wrap">{cc.notes_pic || '-'}</p>
                                      )}
                                    </div>
                                    <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-4">
                                      <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[8px]">Informasi Tracking</h5>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-[8px] text-[12px]">
                                        <div>
                                          <span className="text-text-soft block mb-[2px]">Ditambahkan Oleh:</span>
                                          <span className="font-semibold text-text">
                                            {profiles.find(p => p.id === cc.added_by)?.nama || '-'} 
                                            {cc.created_at && <span className="text-text-soft ml-[4px] font-normal">({new Date(cc.created_at).toLocaleDateString('id-ID')})</span>}
                                          </span>
                                        </div>
                                        {cc.approval === 'approved' && cc.approved_by && (
                                          <div>
                                            <span className="text-text-soft block mb-[2px]">Di-approve Oleh:</span>
                                            <span className="font-semibold text-green-600">
                                              {profiles.find(p => p.id === cc.approved_by)?.nama || '-'} 
                                              {cc.approved_at && <span className="text-text-soft ml-[4px] font-normal">({new Date(cc.approved_at).toLocaleDateString('id-ID')})</span>}
                                            </span>
                                          </div>
                                        )}
                                        {cc.approval === 'not_approved' && cc.not_approved_by && (
                                          <div>
                                            <span className="text-text-soft block mb-[2px]">Ditolak Oleh:</span>
                                            <span className="font-semibold text-red-600">
                                              {profiles.find(p => p.id === cc.not_approved_by)?.nama || '-'} 
                                              {cc.not_approved_at && <span className="text-text-soft ml-[4px] font-normal">({new Date(cc.not_approved_at).toLocaleDateString('id-ID')})</span>}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {hasMore && listingData.length > 0 && (
        <div className="flex justify-center mt-[24px]">
          <button className="btn btn-outline w-[200px] justify-center" onClick={handleLoadMore} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 mr-[8px] animate-spin" /> : null}
            {isLoading ? "Memuat..." : "Muat Lebih Banyak"}
          </button>
        </div>
      )}

      {isLoading && listingData.length === 0 && (
         <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
         </div>
      )}
    </div>
  );
}
