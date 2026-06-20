"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { getCreatorType, getJenisKerjasama } from "@/utils/computed";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
          creator_snapshots ( audience_age, level, gmv_30d, tanggal_update )
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
      not_approved_at: null
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
    <div className="space-y-4">
      <div className="flex justify-between items-start mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold">Daftar Creator</h2>
          <p className="text-sm text-slate-500">Kelola status dan rate card creator di campaign ini. (Paginated)</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center justify-end">
          <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export
          </Button>
          <input 
            type="text" 
            placeholder="Cari username..." 
            value={tableSearch} 
            onChange={e => setTableSearch(e.target.value)} 
            className="p-2 border border-slate-300 rounded-md text-sm min-w-[200px]"
          />
          <select 
            value={filterType}
            onChange={(e: any) => setFilterType(e.target.value)}
            className="p-2 border border-slate-300 rounded-md text-sm bg-white"
          >
            <option value="all">Semua Tipe</option>
            <option value="regular">Reguler (Manual)</option>
            <option value="auto_detect">Auto-Detect</option>
          </select>
          {isClientApprovalRequired && hasAccess && (
            <Button variant="outline" onClick={async () => {
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
            </Button>
          )}

          {hasAccess && (
            <Button onClick={() => {
              setIsAddModalOpen(true);
              setSearchQuery('');
              setNewCreatorId('');
            }}>
              + Tambah Creator
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className={`cursor-pointer transition-all border-none shadow-sm hover:shadow-md ${statusFilter === 'all' ? 'ring-2 ring-blue-500 bg-blue-50/50' : 'bg-white'}`} onClick={() => setStatusFilter('all')}>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Creator</p>
            <h3 className={`text-2xl font-bold ${statusFilter === 'all' ? 'text-blue-700' : 'text-slate-800'}`}>{counts.all}</h3>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-all border-none shadow-sm hover:shadow-md ${statusFilter === 'approved' ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : 'bg-white'}`} onClick={() => setStatusFilter('approved')}>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Approved</p>
            <h3 className={`text-2xl font-bold ${statusFilter === 'approved' ? 'text-emerald-700' : 'text-emerald-600'}`}>{counts.approved}</h3>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-all border-none shadow-sm hover:shadow-md ${statusFilter === 'pending' ? 'ring-2 ring-amber-500 bg-amber-50/50' : 'bg-white'}`} onClick={() => setStatusFilter('pending')}>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Pending</p>
            <h3 className={`text-2xl font-bold ${statusFilter === 'pending' ? 'text-amber-700' : 'text-amber-500'}`}>{counts.pending}</h3>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-all border-none shadow-sm hover:shadow-md ${statusFilter === 'alternate' ? 'ring-2 ring-purple-500 bg-purple-50/50' : 'bg-white'}`} onClick={() => setStatusFilter('alternate')}>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Alternate</p>
            <h3 className={`text-2xl font-bold ${statusFilter === 'alternate' ? 'text-purple-700' : 'text-purple-600'}`}>{counts.alternate}</h3>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-all border-none shadow-sm hover:shadow-md ${statusFilter === 'not_approved' ? 'ring-2 ring-rose-500 bg-rose-50/50' : 'bg-white'}`} onClick={() => setStatusFilter('not_approved')}>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Not Approved</p>
            <h3 className={`text-2xl font-bold ${statusFilter === 'not_approved' ? 'text-rose-700' : 'text-rose-600'}`}>{counts.not_approved}</h3>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6 overflow-hidden">
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between bg-slate-50 px-4 py-3 font-medium text-slate-700 hover:bg-slate-100">
            <span>Rekap Harian (Progres Pencarian & Approval)</span>
            <span className="transition group-open:rotate-180">
              <ChevronDown className="w-5 h-5" />
            </span>
          </summary>
          <div className="border-t border-slate-200 bg-white p-4 overflow-hidden">
            {dailyRecap.length === 0 ? (
              <p className="text-sm text-slate-500 text-center">Belum ada progres terekam.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="p-3 font-semibold text-slate-600 border-r w-32">Tanggal</th>
                      <th className="p-2 border-r text-center w-10">
                        <button 
                          onClick={() => setRecapStartIndex(Math.max(0, recapStartIndex - 1))}
                          disabled={recapStartIndex === 0}
                          className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </th>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <th key={d.date} className="p-3 font-semibold text-slate-800 text-center border-r min-w-[120px]">
                          {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </th>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => (
                        <th key={`empty-th-${i}`} className="p-3 border-r min-w-[120px]"></th>
                      ))}
                      <th className="p-2 text-center w-10">
                        <button 
                          onClick={() => setRecapStartIndex(Math.min(Math.max(0, dailyRecap.length - 5), recapStartIndex + 1))}
                          disabled={recapStartIndex >= dailyRecap.length - 5}
                          className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-3 font-medium text-slate-600 border-r">Total Add</td>
                      <td className="border-r bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`total-${d.date}`} className="p-3 text-center border-r font-semibold text-slate-700 bg-slate-50/50">{d.total}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e1-${i}`} className="border-r bg-slate-50/50"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3 font-medium text-amber-600 border-r">Pending</td>
                      <td className="border-r bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`pending-${d.date}`} className="p-3 text-center border-r font-semibold text-amber-600">{d.pending}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e2-${i}`} className="border-r"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3 font-medium text-emerald-600 border-r">Approve</td>
                      <td className="border-r bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`approve-${d.date}`} className="p-3 text-center border-r font-semibold text-emerald-600">{d.approved}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e3-${i}`} className="border-r"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3 font-medium text-rose-600 border-r">Not Approve</td>
                      <td className="border-r bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`not_approve-${d.date}`} className="p-3 text-center border-r font-semibold text-rose-600">{d.not_approved}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e4-${i}`} className="border-r"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-purple-600 border-r">Alternate</td>
                      <td className="border-r bg-slate-50"></td>
                      {dailyRecap.slice(recapStartIndex, recapStartIndex + 5).map(d => (
                        <td key={`alternate-${d.date}`} className="p-3 text-center border-r font-semibold text-purple-600">{d.alternate}</td>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - dailyRecap.slice(recapStartIndex, recapStartIndex + 5).length) }).map((_, i) => <td key={`e5-${i}`} className="border-r"></td>)}
                      <td className="bg-slate-50"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      </Card>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-lg">
            <h3 className="text-lg font-bold mb-4">Tambah Creator ke Campaign</h3>
            <form onSubmit={handleAddCreator} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Cari & Pilih Creator</label>
                <input 
                  type="text"
                  placeholder="Ketik username creator..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 mb-2 text-sm"
                />
                
                <div className="border border-slate-200 rounded-md max-h-40 overflow-y-auto bg-slate-50">
                  {filteredCreators.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 text-center">
                      {searchQuery ? "Creator tidak ditemukan" : "Ketik untuk mencari..."}
                    </div>
                  ) : (
                    filteredCreators.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => setNewCreatorId(c.id.toString())}
                        className={`p-2 text-sm cursor-pointer border-b border-slate-100 last:border-0 hover:bg-blue-50 transition-colors ${newCreatorId === c.id.toString() ? 'bg-blue-100 font-medium text-blue-700' : ''}`}
                      >
                        @{c.username}
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Price / Rate (Rp)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">Isi 0 untuk Barter</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Qty VT SOW</label>
                  <input 
                    type="number"
                    required
                    min="1"
                    value={newQtyVt}
                    onChange={e => setNewQtyVt(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Batal</Button>
                <Button type="submit" disabled={!newCreatorId}>Simpan</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>
                <button onClick={() => toggleSort('username')} className="flex items-center text-left font-semibold hover:text-blue-600 transition-colors">
                  Creator <SortIcon col="username" />
                </button>
              </TableHead>
              <TableHead>Tanggal & PIC</TableHead>
              <TableHead>Kerjasama</TableHead>
              <TableHead>
                <button onClick={() => toggleSort('price')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                  Price (Rp) <SortIcon col="price" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => toggleSort('qty_vt')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                  Qty VT SOW <SortIcon col="qty_vt" />
                </button>
              </TableHead>
              <TableHead>Tipe Konten</TableHead>
              <TableHead>
                <button onClick={() => toggleSort('approval')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                  Approval <SortIcon col="approval" />
                </button>
              </TableHead>
              {isClientApprovalRequired && <TableHead>Client Status</TableHead>}
              <TableHead className="text-right">GMV Creator</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listingData.length === 0 && !isLoading ? (
              <TableRow>
                <TableCell colSpan={isClientApprovalRequired ? 11 : 10} className="text-center py-8 text-slate-500">
                  Belum ada creator di campaign ini.
                </TableCell>
              </TableRow>
            ) : (
              listingData.map((cc) => {
                const creator = cc.creators;
                if (!creator) return null;
                const snaps = creator.creator_snapshots || [];
                const snapshot = snaps.length > 0 ? snaps.sort((a:any, b:any) => new Date(b.tanggal_update).getTime() - new Date(a.tanggal_update).getTime())[0] : null;
                const type = getCreatorType(snapshot?.audience_age || null);
                const gmvCreator = snapshot?.gmv_30d || 0;
                const isExpanded = expandedRows[cc.id];
                const isEditing = editingId === cc.id;
                const creatorVideos = cc.videos || [];

                return (
                  <React.Fragment key={cc.id}>
                    <TableRow className="group">
                      <TableCell>
                        <button onClick={() => toggleExpand(cc.id)} className="p-1 hover:bg-slate-100 rounded">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href={`/creator-pool/${creator.id}`} className="font-semibold text-blue-600 hover:underline block">
                            @{creator.username}
                          </Link>
                          {cc.tier === 'Auto-Detect' && <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded-full">AUTO</span>}
                        </div>
                        <span className="text-xs text-slate-500">{type} • Tier {cc.tier || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-slate-600">
                          {cc.created_at ? new Date(cc.created_at).toLocaleDateString('id-ID') : '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Oleh: {cc.added_by_profile?.nama || 'System'}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize text-sm">
                        {getJenisKerjasama(cc.price)}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <input 
                            type="number" 
                            value={editPrice} 
                            onChange={e => setEditPrice(e.target.value)}
                            className="w-24 p-1 border border-slate-300 rounded text-sm"
                          />
                        ) : (
                          <span className="text-sm">Rp {cc.price.toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <input 
                            type="number" 
                            min="1"
                            value={editQtyVt} 
                            onChange={e => setEditQtyVt(e.target.value)}
                            className="w-16 p-1 border border-slate-300 rounded text-sm text-center"
                          />
                        ) : (
                          <span className="text-sm">{cc.qty_vt}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-slate-700">{cc.content_type || '-'}</span>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <select 
                            value={editApproval} 
                            onChange={e => setEditApproval(e.target.value)}
                            className="p-1 border border-slate-300 rounded text-sm bg-white"
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="alternate">Alternate</option>
                            <option value="not_approved">Not Approved</option>
                          </select>
                        ) : (
                          <Badge variant={
                            cc.approval === 'approved' ? 'success' : 
                            cc.approval === 'not_approved' ? 'destructive' : 
                            cc.approval === 'alternate' ? 'warning' : 'secondary'
                          }>
                            {cc.approval}
                          </Badge>
                        )}
                      </TableCell>
                      {isClientApprovalRequired && (
                        <TableCell>
                          {isEditing ? (
                            <select 
                              value={editClientApproval} 
                              onChange={e => setEditClientApproval(e.target.value)}
                              className="p-1 border border-slate-300 rounded text-sm bg-white"
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          ) : (
                            <Badge variant={
                              cc.client_approval === 'approved' ? 'success' : 
                              cc.client_approval === 'rejected' ? 'destructive' : 'secondary'
                            }>
                              {cc.client_approval === 'not_required' ? 'Pending' : cc.client_approval}
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right text-sm font-medium">
                        {gmvCreator > 0 ? `Rp ${gmvCreator.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => saveEdit(cc.id)} className="h-8 w-8 text-green-600"><Check className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={cancelEdit} className="h-8 w-8 text-slate-400"><X className="w-4 h-4" /></Button>
                          </div>
                        ) : hasAccess ? (
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" onClick={() => startEdit(cc)} className="h-8 w-8">
                              <Edit2 className="w-4 h-4 text-slate-400 hover:text-blue-600" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteCreator(cc.id)} className="h-8 w-8">
                              <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                    
                    {/* Expandable Video Row */}
                    {isExpanded && (
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableCell></TableCell>
                        <TableCell colSpan={isClientApprovalRequired ? 8 : 7} className="p-0 border-b-0">
                          <div className="py-4 pr-4">
                            <div className="bg-white border border-slate-200 rounded-lg p-4">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Daftar Video ({cc.qty_vt})</h4>
                              {creatorVideos.length > 0 ? (
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-slate-500 border-b border-slate-100">
                                      <th className="font-normal text-left pb-2 w-10">#</th>
                                      <th className="font-normal text-left pb-2">Konsep</th>
                                      <th className="font-normal text-left pb-2">Link Video</th>
                                      <th className="font-normal text-left pb-2 w-32">VT Approval</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {creatorVideos.map((v: any) => (
                                      <tr key={v.id} className="border-b border-slate-50 last:border-0">
                                        <td className="py-2">{v.urutan}</td>
                                        <td className="py-2">{v.concept || '-'}</td>
                                        <td className="py-2">
                                          {v.link_video ? (
                                            <a href={v.link_video} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                                              {v.link_video}
                                            </a>
                                          ) : '-'}
                                        </td>
                                        <td className="py-2">
                                          <Badge variant={v.vt_approval === 'approved' ? 'success' : v.vt_approval === 'reject' ? 'destructive' : 'secondary'}>
                                            {v.vt_approval}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                ) : (
                                  <p className="text-sm text-slate-500 text-center py-2">Belum ada video ditambahkan.</p>
                                )}

                                {/* Tambahan Detail Sesuai Request */}
                                <div className="mt-6 pt-4 border-t border-slate-100">
                                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Detail & Catatan Kreator</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                      <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status Pembayaran</h5>
                                      {isEditing ? (
                                        <select value={editStatusBayar} onChange={e=>setEditStatusBayar(e.target.value)} className="w-full text-sm p-1 border rounded bg-white">
                                          <option value="belum">Belum</option>
                                          <option value="dp">DP</option>
                                          <option value="lunas">Lunas</option>
                                        </select>
                                      ) : (
                                        <p className="text-sm font-medium text-slate-800 capitalize">{cc.status_bayar || '-'}</p>
                                      )}
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                      <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-1">Progress Sample</h5>
                                      {isEditing ? (
                                        <select value={editSampleProgress} onChange={e=>setEditSampleProgress(e.target.value)} className="w-full text-sm p-1 border rounded bg-white">
                                          <option value="Done Req Sample">Done Req Sample</option>
                                          <option value="Sudah Proses Pengiriman">Sudah Proses Pengiriman</option>
                                          <option value="Sampai">Sampai</option>
                                          <option value="Kendala [FU!]">Kendala [FU!]</option>
                                        </select>
                                      ) : (
                                        <Badge variant={
                                          cc.sample_progress === 'Sampai' ? 'success' : 
                                          cc.sample_progress === 'Kendala [FU!]' ? 'destructive' : 
                                          cc.sample_progress === 'Sudah Proses Pengiriman' ? 'warning' : 'secondary'
                                        }>
                                          {cc.sample_progress || '-'}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 md:col-span-2">
                                      <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes Manager</h5>
                                      {isEditing ? (
                                        <textarea value={editNotesManager} onChange={e=>setEditNotesManager(e.target.value)} className="w-full text-sm p-1 border rounded h-16 bg-white" placeholder="Catatan Manager..." />
                                      ) : (
                                        <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{cc.notes_manager || '-'}</p>
                                      )}
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 md:col-span-4">
                                      <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes PIC ({cc.pic_assist || 'Belum di-assign'})</h5>
                                      {isEditing ? (
                                        <textarea value={editNotesPic} onChange={e=>setEditNotesPic(e.target.value)} className="w-full text-sm p-1 border rounded h-16 bg-white" placeholder="Catatan PIC..." />
                                      ) : (
                                        <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{cc.notes_pic || '-'}</p>
                                      )}
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 md:col-span-4">
                                      <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Informasi Tracking</h5>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                        <div>
                                          <span className="text-slate-500 block mb-0.5">Ditambahkan Oleh:</span>
                                          <span className="font-medium text-slate-800">
                                            {profiles.find(p => p.id === cc.added_by)?.nama || '-'} 
                                            {cc.created_at && <span className="text-slate-400 ml-1">({new Date(cc.created_at).toLocaleDateString('id-ID')})</span>}
                                          </span>
                                        </div>
                                        {cc.approval === 'approved' && cc.approved_by && (
                                          <div>
                                            <span className="text-slate-500 block mb-0.5">Di-approve Oleh:</span>
                                            <span className="font-medium text-green-600">
                                              {profiles.find(p => p.id === cc.approved_by)?.nama || '-'} 
                                              {cc.approved_at && <span className="text-slate-400 ml-1">({new Date(cc.approved_at).toLocaleDateString('id-ID')})</span>}
                                            </span>
                                          </div>
                                        )}
                                        {cc.approval === 'not_approved' && cc.not_approved_by && (
                                          <div>
                                            <span className="text-slate-500 block mb-0.5">Ditolak Oleh:</span>
                                            <span className="font-medium text-red-600">
                                              {profiles.find(p => p.id === cc.not_approved_by)?.nama || '-'} 
                                              {cc.not_approved_at && <span className="text-slate-400 ml-1">({new Date(cc.not_approved_at).toLocaleDateString('id-ID')})</span>}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && listingData.length > 0 && (
        <div className="flex justify-center mt-6">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoading} className="w-[200px]">
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isLoading ? "Memuat..." : "Muat Lebih Banyak"}
          </Button>
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
