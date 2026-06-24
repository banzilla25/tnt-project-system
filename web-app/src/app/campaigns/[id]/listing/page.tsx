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
import { useRouter } from "next/navigation";
import { MultiSelect } from "@/components/MultiSelect";

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
    campaigns, 
    campaign_creators, 
    creators, 
    creator_snapshots,
    videos,
    skus,
    niches,
    updateCampaignCreator, 
    deleteCampaignCreator 
  } = useDatabaseStore();

  const { profile, canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);
  const router = useRouter();

  const campaign = campaigns.find(c => c.id === campaignId);
  const isClientApprovalRequired = campaign?.require_client_approval || false;
  const campaignSkus = skus.filter(s => s.campaign_id === campaignId);

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
  const [editAssignedSkus, setEditAssignedSkus] = useState<number[]>([]);

  const [filterType, setFilterType] = useState<'all' | 'regular' | 'auto_detect'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'alternate' | 'not_approved'>('all');
  
  // New Multidimensional Filters
  const [filterTier, setFilterTier] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterNiche, setFilterNiche] = useState<string>('');
  const [filterAddedBy, setFilterAddedBy] = useState<string>('');
  const [filterActionBy, setFilterActionBy] = useState<string>('');
  const [staffProfiles, setStaffProfiles] = useState<{id: string, nama: string}[]>([]);

  useEffect(() => {
    supabase.from('profiles').select('id, nama').order('nama').then(({data}) => {
      if (data) setStaffProfiles(data);
    });
  }, []);

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
  const [dailyRecap, setDailyRecap] = useState<any[]>([]);
  const [rawRecapData, setRawRecapData] = useState<any[]>([]);
  const [recapFilterPic, setRecapFilterPic] = useState<string>('');
  const [recapStartIndex, setRecapStartIndex] = useState(0);

  // Add Creator Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [bulkUsernames, setBulkUsernames] = useState<string>('');
  const [newPrice, setNewPrice] = useState<string>('0');
  const [newQtyVt, setNewQtyVt] = useState<string>('1');
  const [isAddingBulk, setIsAddingBulk] = useState(false);

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
    const { data: recapData } = await supabase.from('campaign_creators').select('id, approval, approved_at, created_at, added_by').eq('campaign_id', campaignId);
    if (recapData) {
      setRawRecapData(recapData);
    }
  }, [campaignId]);

  useEffect(() => {
    let filteredData = rawRecapData;
    if (recapFilterPic) {
      filteredData = filteredData.filter(r => r.added_by === recapFilterPic);
    }
    const group: Record<string, { total: number, approved: number, pending: number, alternate: number, not_approved: number }> = {};
    filteredData.forEach(r => {
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
  }, [rawRecapData, recapFilterPic]);

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
        approved_by_profile:profiles!campaign_creators_approved_by_fkey ( nama ),
        not_approved_by_profile:profiles!campaign_creators_not_approved_by_fkey ( nama ),
        creators!inner (
          id, username, nama_asli, link_account,
          creator_snapshots${filterTier || filterLevel ? '!inner' : ''} ( id, audience_age, level, gmv_30d, tanggal_update, followers, tier ),
          creator_niches${filterNiche ? '!inner' : ''} ( niche_id, niches ( nama ) )
        ),
        videos (
          id, urutan, concept, link_video, vt_approval
        )
      `;

      let query: any = supabase.from('campaign_creators').select(selectQuery).eq('campaign_id', campaignId);

      // Filters
      if (filterType === 'auto_detect') query = query.eq('tier', 'Auto-Detect');
      if (filterType === 'regular') query = query.or('tier.neq.Auto-Detect,tier.is.null');
      if (statusFilter !== 'all') query = query.eq('approval', statusFilter);
      
      // Multi-dimensional filters
      if (filterTier) query = query.ilike('creators.creator_snapshots.tier', `%${filterTier}%`);
      if (filterLevel) query = query.eq('creators.creator_snapshots.level', filterLevel);
      if (filterNiche) query = query.eq('creators.creator_niches.niche_id', filterNiche);
      if (filterAddedBy) query = query.eq('added_by', filterAddedBy);
      if (filterActionBy) query = query.or(`approved_by.eq.${filterActionBy},not_approved_by.eq.${filterActionBy}`);

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

      let finalData = data || [];

      // Auto-detect videos from sales
      if (finalData.length > 0) {
        const creatorUsernames = finalData.map((cc: any) => cc.creators?.username).filter(Boolean);
        if (creatorUsernames.length > 0) {
          const { data: sData } = await supabase.from('sales')
            .select('content_uid, creator_username')
            .eq('campaign_id', campaignId)
            .in('creator_username', creatorUsernames)
            .not('content_uid', 'is', null)
            .neq('content_uid', '');
            
          if (sData && sData.length > 0) {
            finalData = finalData.map((cc: any) => {
              if (!cc.creators) return cc;
              const cName = cc.creators.username;
              const cSales = sData.filter(s => s.creator_username === cName);
              const uniqueUids = Array.from(new Set(cSales.map(s => s.content_uid)));
              
              const existingVids = cc.videos || [];
              const autoVids = [];
              
              for (const uid of uniqueUids) {
                if (!uid) continue;
                const exists = existingVids.some((v:any) => v.content_uid === uid);
                if (!exists) {
                  autoVids.push({
                    id: `auto_${uid}`,
                    concept: 'Auto-detected from Sales CSV',
                    link_video: `https://www.tiktok.com/@${cName}/video/${uid}`,
                    vt_approval: 'approved',
                    content_uid: uid,
                    urutan: 999
                  });
                }
              }
              
              return {
                ...cc,
                videos: [...existingVids, ...autoVids]
              };
            });
          }
        }
      }

      if (isReset) {
        setListingData(finalData);
      } else {
        setListingData(prev => [...prev, ...finalData]);
      }

      setHasMore((data || []).length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, filterType, statusFilter, debouncedSearch, sortConfig, filterTier, filterLevel, filterNiche, filterAddedBy, filterActionBy]);

  useEffect(() => {
    setPage(0);
    fetchListing(0, true);
  }, [debouncedSearch, filterType, statusFilter, sortConfig, fetchListing, filterTier, filterLevel, filterNiche, filterAddedBy, filterActionBy]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchListing(next, false);
  };


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
    setEditAssignedSkus(cc.assigned_sku_ids || []);
  };

  const saveEdit = async (ccId: number) => {
    if (!hasAccess) return;
    const oldCc = listingData.find(c => c.id === ccId);
    let extraUpdates: any = {};
    if (oldCc && oldCc.approval !== editApproval) {
      if (editApproval === 'approved') {
        extraUpdates.approved_by = profile?.id;
        extraUpdates.approved_at = new Date().toISOString();
      } else if (editApproval === 'not_approved' || editApproval === 'alternate') {
        extraUpdates.not_approved_by = profile?.id;
        extraUpdates.not_approved_at = new Date().toISOString();
      }
    }

    await updateCampaignCreator(ccId, {
      price: Number(editPrice),
      qty_vt: Number(editQtyVt),
      approval: editApproval,
      sample_progress: editSampleProgress,
      notes_manager: editNotesManager,
      notes_pic: editNotesPic,
      assigned_sku_ids: editAssignedSkus,
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
    if (!bulkUsernames.trim() || !hasAccess || isAddingBulk) return;

    setIsAddingBulk(true);

    try {
      const usernames = bulkUsernames.split('\n')
        .map(u => u.replace('@', '').trim().toLowerCase())
        .filter(u => u.length > 0);
      
      if (usernames.length === 0) {
        setIsAddingBulk(false);
        return;
      }

      // Unique usernames
      const uniqueUsernames = Array.from(new Set(usernames));

      // 1. Fetch existing creators to see which ones are missing and check completeness
      const { data: existingData, error: fetchErr } = await supabase.from('creators')
        .select(`
          id, username, added_by,
          creator_contacts(id),
          creator_snapshots(id),
          creator_niches(id)
        `)
        .in('username', uniqueUsernames);

      if (fetchErr) throw fetchErr;

      const existingMap = new Map((existingData || []).map(c => [c.username.toLowerCase(), c]));
      const missingUsernames = uniqueUsernames.filter(u => !existingMap.has(u));

      // 2. Insert missing creators
      let newlyInserted: any[] = [];
      if (missingUsernames.length > 0) {
        const payloads = missingUsernames.map(u => ({
          username: u,
          link_account: `https://www.tiktok.com/@${u}`,
          added_by: profile?.id
        }));

        const { data: insertedData, error: insErr } = await supabase.from('creators')
          .insert(payloads)
          .select('id, username, added_by');

        if (insErr) throw insErr;
        newlyInserted = insertedData || [];
      }

      // Combine existing and newly inserted
      const allCreators: any[] = [...(existingData || []), ...newlyInserted];

      // 3. Prepare campaign creators bulk payload
      const campaignPayloads = allCreators.map(c => ({
        campaign_id: campaignId,
        creator_id: c.id,
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
      }));

      // 4. Check if they are already in the campaign to avoid duplication
      const { data: existingCcData } = await supabase.from('campaign_creators')
        .select('creator_id')
        .eq('campaign_id', campaignId)
        .in('creator_id', allCreators.map(c => c.id));
      
      const existingCcSet = new Set((existingCcData || []).map(cc => cc.creator_id));
      const newCampaignPayloads = campaignPayloads.filter(p => !existingCcSet.has(p.creator_id));

      if (newCampaignPayloads.length > 0) {
        const { error: ccErr } = await supabase.from('campaign_creators').insert(newCampaignPayloads);
        if (ccErr) throw ccErr;
      }

      // 5. Check for incomplete records and takeover logic
      const usernamesToRedirect: string[] = [];
      const takeoverPromises: any[] = [];

      for (const c of allCreators) {
        const isComplete = c.creator_contacts && c.creator_contacts.length > 0 &&
                           c.creator_snapshots && c.creator_snapshots.length > 0 &&
                           c.creator_niches && c.creator_niches.length > 0;
        
        if (!isComplete) {
          if (c.added_by === profile?.id) {
            // It's incomplete and belongs to us, we MUST complete it
            usernamesToRedirect.push(c.username);
          } else {
            // It's incomplete but belongs to someone else. TAKEOVER RULE!
            const promise = (async () => {
              const { error } = await supabase.from('creators')
                .update({ added_by: profile?.id })
                .eq('id', c.id);
              if (error) throw error;
            })();
            takeoverPromises.push(promise);
            
            // Now we own it, so we MUST complete it
            usernamesToRedirect.push(c.username);
          }
        }
      }

      // Execute all takeover updates concurrently for maximum speed
      if (takeoverPromises.length > 0) {
        await Promise.all(takeoverPromises);
      }

      // 6. Handle Redirect or Close
      if (usernamesToRedirect.length > 0) {
        // Construct the draft payload
        const drafts = usernamesToRedirect.map((u) => ({
          id: Math.random().toString(36).substring(2, 9),
          username: u,
          followers: '',
          level: '',
          audience_age: '',
          gmv_30d: '',
          niche: '',
          mcn: '',
          ratecard: '',
          whatsapp: ''
        }));

        // Read existing drafts if any, append ours
        let existingDrafts: any[] = [];
        try {
          const saved = localStorage.getItem('tnt_import_draft_global');
          if (saved) {
             const parsed = JSON.parse(saved);
             if (Array.isArray(parsed)) existingDrafts = parsed;
          }
        } catch(e) {}
        
        const combinedDrafts = [...drafts, ...existingDrafts.filter(d => !usernamesToRedirect.includes(d.username))];
        localStorage.setItem('tnt_import_draft_global', JSON.stringify(combinedDrafts));

        // Alert user before redirecting
        alert(`Berhasil masuk ke Campaign! Namun ada ${usernamesToRedirect.length} kreator yang datanya belum lengkap. Anda akan dialihkan untuk melengkapinya.`);
        router.push('/creator-pool/import');
        return; // Don't reset state or refresh, just redirect
      }

      // If no redirect, close modal and refresh
      setIsAddModalOpen(false);
      setBulkUsernames('');
      setNewPrice('0');
      setNewQtyVt('1');
      setPage(0);
      fetchListing(0, true);
      fetchCounts();

    } catch (err: any) {
      alert("Gagal menambahkan kreator: " + err.message);
    } finally {
      setIsAddingBulk(false);
    }
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
            className="input min-w-[200px] md:w-auto"
          />
          <select 
            value={filterType}
            onChange={(e: any) => setFilterType(e.target.value)}
            className="select min-w-[150px] md:w-auto"
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
              setBulkUsernames('');
            }}>
              + Tambah Creator
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-[24px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Multi-dimensional Filter</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Tier</option>
            <option value="Nano">Nano</option>
            <option value="Micro">Micro</option>
            <option value="Macro">Macro</option>
            <option value="Mega">Mega</option>
          </select>
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Level</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
            <option value="4">Level 4</option>
            <option value="5">Level 5</option>
          </select>
          <select value={filterNiche} onChange={(e) => setFilterNiche(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Niche</option>
            {niches.map(n => (
              <option key={n.id} value={n.id}>{n.nama}</option>
            ))}
          </select>
          <select value={filterAddedBy} onChange={(e) => setFilterAddedBy(e.target.value)} className="select !mb-0 min-w-[140px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua PIC (Added By)</option>
            {staffProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
          <select value={filterActionBy} onChange={(e) => setFilterActionBy(e.target.value)} className="select !mb-0 min-w-[150px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua PIC (Approval)</option>
            {staffProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-[16px]">
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
            <div className="flex items-center gap-4">
              <span>Rekap Harian (Progres Pencarian & Approval)</span>
              <select 
                value={recapFilterPic} 
                onChange={(e) => setRecapFilterPic(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="select !mb-0 py-1 text-xs w-auto font-normal"
              >
                <option value="">Semua PIC</option>
                {staffProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.nama}</option>
                ))}
              </select>
            </div>
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
                <label className="text-[13px] font-semibold text-text block mb-[6px]">Cari & Pilih Creator (Bulk Input)</label>
                <textarea 
                  placeholder="Paste username creator di sini, pisahkan dengan baris (enter)..."
                  value={bulkUsernames}
                  onChange={e => setBulkUsernames(e.target.value)}
                  className="input min-h-[150px] font-mono text-sm resize-y"
                  required
                />
                <p className="text-[11px] text-text-soft mt-[4px]">Bisa copy-paste dari Excel. Satu baris untuk satu username. Tanpa tanda @.</p>
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
                <button type="submit" className="btn btn-primary" disabled={!bulkUsernames.trim() || isAddingBulk}>
                  {isAddingBulk ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2 inline-block" /> Menyimpan...
                    </>
                  ) : (
                    'Simpan'
                  )}
                </button>
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
              <th>Produk</th>
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
                <td colSpan={isClientApprovalRequired ? 12 : 11} className="text-center py-[32px] text-text-soft">
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
                        <a href={creator.link_account || `https://www.tiktok.com/@${creator.username}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-[4px] hover:opacity-80 transition-opacity">
                          <img src="/logo-tiktok-landscape-button.svg" alt="TikTok" className="h-[26px]" />
                        </a>
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
                      <td className="min-w-[150px]">
                        {isEditing ? (
                           <div className="w-full">
                            <MultiSelect 
                              options={campaignSkus.map(s => ({ id: s.id, label: s.nama_produk }))}
                              selectedIds={editAssignedSkus}
                              onChange={setEditAssignedSkus}
                              placeholder="Pilih Produk..."
                              emptyMessage="Belum ada produk"
                            />
                            {campaignSkus.length === 0 && (
                              <p className="text-[10px] text-orange-600 mt-1 leading-tight">
                                Jika produk belum ada di list, maka daftarkan di bagian tab Produk.
                              </p>
                            )}
                          </div>
                        ) : (
                           <div className="flex flex-wrap gap-1">
                             {cc.assigned_sku_ids && cc.assigned_sku_ids.length > 0 ? (
                               cc.assigned_sku_ids.map((id: number) => {
                                 const sku = campaignSkus.find(s => s.id === id);
                                 return sku ? <span key={id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded border border-blue-100">{sku.nama_produk}</span> : null;
                               })
                             ) : (
                               <span className="text-[11px] text-slate-400 italic">Belum di-set</span>
                             )}
                             {!isEditing && campaignSkus.length === 0 && (
                               <span className="text-[10px] text-red-500 block mt-1">Daftarkan produk di tab Produk</span>
                             )}
                           </div>
                        )}
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
                          <div className="flex flex-col items-center">
                            <span className={`badge ${
                              cc.approval === 'approved' ? 'b-approved' : 
                              cc.approval === 'not_approved' ? 'b-rejected' : 
                              cc.approval === 'alternate' ? 'b-alternate' : 'b-pending'
                            }`}>
                              {cc.approval}
                            </span>
                            {(cc.approval === 'approved' && cc.approved_by_profile) && (
                              <div className="text-[10px] text-text-soft mt-1 leading-tight text-center">Oleh: {cc.approved_by_profile.nama}</div>
                            )}
                            {(cc.approval === 'not_approved' && cc.not_approved_by_profile) && (
                              <div className="text-[10px] text-text-soft mt-1 leading-tight text-center">Oleh: {cc.not_approved_by_profile.nama}</div>
                            )}
                            {(cc.approval === 'alternate' && cc.not_approved_by_profile) && (
                              <div className="text-[10px] text-text-soft mt-1 leading-tight text-center">Oleh: {cc.not_approved_by_profile.nama}</div>
                            )}
                          </div>
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
                          <div className="flex justify-end gap-[4px] transition-opacity">
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
                        <td colSpan={isClientApprovalRequired ? 9 : 8} className="p-0 border-b-0">
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
                                      <p className="text-[13px] font-semibold text-text capitalize">{cc.status_bayar || '-'}</p>
                                      {isEditing && <p className="text-[10px] text-text-soft italic mt-1">Dikelola via Tab Keuangan</p>}
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
                                      <div className="flex justify-between items-center mb-[4px]">
                                        <h5 className="text-[11px] font-bold text-text-soft uppercase">Notes Manager</h5>
                                        {!isEditing && hasAccess && (
                                          <button onClick={() => startEdit(cc)} className="text-p300 hover:text-p400 flex items-center gap-1 text-[10px] font-medium"><Edit2 className="w-3 h-3"/> Edit</button>
                                        )}
                                      </div>
                                      {isEditing ? (
                                        <textarea value={editNotesManager} onChange={e=>setEditNotesManager(e.target.value)} className="input h-16" placeholder="Catatan Manager..." />
                                      ) : (
                                        <p className="text-[13px] font-medium text-text whitespace-pre-wrap">{cc.notes_manager || <span className="text-text-soft italic text-[11px]">(Klik Edit untuk menambah catatan)</span>}</p>
                                      )}
                                    </div>
                                    <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-4">
                                      <div className="flex justify-between items-center mb-[4px]">
                                        <h5 className="text-[11px] font-bold text-text-soft uppercase">Notes PIC ({cc.pic_assist || 'Belum di-assign'})</h5>
                                        {!isEditing && hasAccess && (
                                          <button onClick={() => startEdit(cc)} className="text-p300 hover:text-p400 flex items-center gap-1 text-[10px] font-medium"><Edit2 className="w-3 h-3"/> Edit</button>
                                        )}
                                      </div>
                                      {isEditing ? (
                                        <textarea value={editNotesPic} onChange={e=>setEditNotesPic(e.target.value)} className="input h-16" placeholder="Catatan PIC..." />
                                      ) : (
                                        <p className="text-[13px] font-medium text-text whitespace-pre-wrap">{cc.notes_pic || <span className="text-text-soft italic text-[11px]">(Klik Edit untuk menambah catatan)</span>}</p>
                                      )}
                                    </div>
                                    <div className="bg-slate-50 border border-line rounded-[8px] p-[12px] md:col-span-4">
                                      <h5 className="text-[11px] font-bold text-text-soft uppercase mb-[8px]">Informasi Tracking</h5>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-[8px] text-[12px]">
                                        <div>
                                          <span className="text-text-soft block mb-[2px]">Ditambahkan Oleh:</span>
                                          <span className="font-semibold text-text">
                                            {staffProfiles.find(p => p.id === cc.added_by)?.nama || 'Unknown'}
                                            {cc.created_at && <span className="text-text-soft font-normal ml-1">({new Date(cc.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})})</span>}
                                          </span>
                                        </div>
                                        {cc.approval === 'approved' && cc.approved_by && (
                                          <div>
                                            <span className="text-text-soft block mb-[2px]">Di-approve Oleh:</span>
                                            <span className="font-semibold text-green-600">
                                              {staffProfiles.find(p => p.id === cc.approved_by)?.nama || '-'} 
                                              {cc.approved_at && <span className="text-text-soft ml-[4px] font-normal">({new Date(cc.approved_at).toLocaleDateString('id-ID')})</span>}
                                            </span>
                                          </div>
                                        )}
                                        {cc.approval === 'not_approved' && cc.not_approved_by && (
                                          <div>
                                            <span className="text-text-soft block mb-[2px]">Ditolak Oleh:</span>
                                            <span className="font-semibold text-red-600">
                                              {staffProfiles.find(p => p.id === cc.not_approved_by)?.nama || '-'} 
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
