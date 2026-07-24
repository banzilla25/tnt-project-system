"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { getCreatorType, getJenisKerjasama } from "@/utils/computed";
import { formatAbbreviated } from "@/utils/formatters";
import { ChevronDown, ChevronRight, ChevronLeft, Edit2, Check, X, Loader2, Trash2, Download, ArrowUp, ArrowDown, ArrowUpDown, Plus, AlertCircle, CheckCircle2, Save, Filter } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { exportToCSV } from "@/utils/exportCsv";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { MultiSelect } from "@/components/MultiSelect";
import { useCampaignFilter } from "@/providers/CampaignFilterProvider";
import { NotesTimeline } from "@/components/NotesTimeline";
import { CreatorRow } from "./CreatorRow";

const supabase = createClient();
const PAGE_SIZE = 100;

const extractLatestSnapshot = (creator: any) => {
  const snaps = creator?.creator_snapshots || [];
  const sortedSnaps = [...snaps].sort((a:any, b:any) => {
    const tDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
    if (tDiff !== 0) return tDiff;
    return b.id - a.id;
  });
  return sortedSnaps.reduce((acc: any, curr: any) => ({
    followers: acc.followers ?? curr.followers,
    tier: acc.tier ?? curr.tier,
    audience_age: acc.audience_age ?? curr.audience_age,
    level: acc.level ?? curr.level,
    ratecard: acc.ratecard ?? curr.ratecard,
    gmv_30d: acc.gmv_30d ?? curr.gmv_30d,
  }), { followers: null, tier: null, audience_age: null, level: null, ratecard: null, gmv_30d: null } as any);
};

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
  const { isCreatorVisible } = useCampaignFilter();

  const campaign = campaigns.find(c => c.id === campaignId);
  const isClientApprovalRequired = campaign?.require_client_approval || false;
  const campaignSkus = skus.filter(s => s.campaign_id === campaignId);

  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // --- Batch Edit System ---
  type PendingChange = {
    price?: number;
    qty_vt?: number;
    qty_live?: number;
    approval?: string;
    client_approval?: string;
    assigned_sku_ids?: number[];
    content_type?: string;
    followers?: number;
    level?: string;
    gmv_30d?: number;
    creator_id?: number;
    tier?: string;
    audience_age?: string;
    ratecard?: number;
    original: any;
  };
  const [pendingChanges, setPendingChanges] = useState<Map<number, PendingChange>>(new Map());
  const [editingCellId, setEditingCellId] = useState<string | null>(null); // "ccId-field" e.g. "123-price"
  const [showUnsavedFirst, setShowUnsavedFirst] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [batchSaveProgress, setBatchSaveProgress] = useState(0);

  // beforeunload protection
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingChanges.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingChanges.size]);

  // Auto-save debouncer (Google Sheets style)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (pendingChanges.size > 0 && !isBatchSaving) {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => {
        batchSaveAll();
      }, 2000); // 2 seconds debounce
    }
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [pendingChanges, isBatchSaving]);

  const getPendingValue = (ccId: number, field: keyof PendingChange, originalValue: any) => {
    const change = pendingChanges.get(ccId);
    if (change && change[field] !== undefined) return change[field];
    return originalValue;
  };

  const setCellChange = (ccId: number, field: string, value: any, cc: any) => {
    setPendingChanges(prev => {
      const next = new Map(prev);
      const snap = extractLatestSnapshot(cc.creators);
      const existing = next.get(ccId) || {
        original: {
          price: cc.price,
          qty_vt: cc.qty_vt,
          qty_live: cc.qty_live || 0,
          approval: cc.approval,
          client_approval: cc.client_approval || 'not_required',
          assigned_sku_ids: cc.assigned_sku_ids || [],
          content_type: cc.content_type || null,
          followers: snap.followers,
          level: snap.level,
          gmv_30d: snap.gmv_30d,
          creator_id: cc.creator_id,
          tier: snap.tier,
          audience_age: snap.audience_age,
          ratecard: snap.ratecard
        }
      };
      (existing as any)[field] = value;

      // Check if all changed fields match original
      const orig = existing.original;
      const fields = ['price', 'qty_vt', 'qty_live', 'approval', 'client_approval', 'assigned_sku_ids', 'content_type', 'followers', 'level', 'gmv_30d'] as const;
      let hasRealChange = false;
      for (const f of fields) {
        const changedVal = (existing as any)[f];
        if (changedVal !== undefined) {
          if (f === 'assigned_sku_ids') {
            if (JSON.stringify(changedVal) !== JSON.stringify(orig[f])) hasRealChange = true;
          } else {
            if (changedVal !== orig[f]) hasRealChange = true;
          }
        }
      }

      if (hasRealChange) {
        next.set(ccId, existing);
      } else {
        next.delete(ccId);
      }
      return next;
    });
  };

  const batchSaveAll = async () => {
    if (pendingChanges.size === 0) return;
    setIsBatchSaving(true);
    setBatchSaveProgress(0);
    const entries = Array.from(pendingChanges.entries());
    let done = 0;
    try {
      for (const [ccId, change] of entries) {
        const updates: any = {};
        if (change.price !== undefined) updates.price = change.price;
        if (change.qty_vt !== undefined) updates.qty_vt = change.qty_vt;
        if (change.qty_live !== undefined) updates.qty_live = change.qty_live;
        if (change.assigned_sku_ids !== undefined) updates.assigned_sku_ids = change.assigned_sku_ids;
        if (change.content_type !== undefined) updates.content_type = change.content_type;
        if (change.approval !== undefined) {
          updates.approval = change.approval;
          if (change.approval !== change.original.approval) {
            if (change.approval === 'approved') {
              updates.approved_by = profile?.id;
              updates.approved_at = new Date().toISOString();
            } else if (change.approval === 'not_approved' || change.approval === 'alternate') {
              updates.not_approved_by = profile?.id;
              updates.not_approved_at = new Date().toISOString();
            }
          }
        }
        if (isClientApprovalRequired && change.client_approval !== undefined) {
          updates.client_approval = change.client_approval;
        }

        if (Object.keys(updates).length > 0) {
          await updateCampaignCreator(ccId, updates, profile?.nama || 'System');
        }

        // Handle creator snapshot updates (excluding price which is now campaign-specific)
        if (change.followers !== undefined || change.level !== undefined || change.gmv_30d !== undefined) {
          if (change.original.creator_id) {
            const newFollowers = change.followers !== undefined ? change.followers : change.original.followers;
            const newLevel = change.level !== undefined ? change.level : change.original.level;
            const newGmv = change.gmv_30d !== undefined ? change.gmv_30d : change.original.gmv_30d;
            const newRatecard = change.original.ratecard;
            
            let newTier = change.original.tier;
            if (change.followers !== undefined) {
               const f = Number(newFollowers);
               if (f < 10000) newTier = 'Nano';
               else if (f < 100000) newTier = 'Micro';
               else if (f < 1000000) newTier = 'Macro';
               else newTier = 'Mega';
            }
            
            try {
              await useDatabaseStore.getState().addCreatorSnapshot({
                creator_id: change.original.creator_id,
                tanggal_update: new Date().toISOString(),
                followers: newFollowers,
                level: newLevel,
                gmv_30d: newGmv,
                tier: newTier, // inherit or recalculated
                audience_age: change.original.audience_age, // inherit
                ratecard: newRatecard, // inherit
                updated_by: profile?.nama || null
              });
            } catch (snapErr) {
              console.error("Failed to add snapshot:", snapErr);
            }
          }
        }

        done++;
        setBatchSaveProgress(Math.round((done / entries.length) * 100));
      }
      
      // Optimistic UI update to prevent flashing old data while fetchListing is running
      setListingData(prev => prev.map(cc => {
        const change = pendingChanges.get(cc.id);
        if (change) {
          return {
            ...cc,
            price: change.price !== undefined ? change.price : cc.price,
            qty_vt: change.qty_vt !== undefined ? change.qty_vt : cc.qty_vt,
            qty_live: change.qty_live !== undefined ? change.qty_live : cc.qty_live,
            approval: change.approval !== undefined ? change.approval : cc.approval,
            client_approval: change.client_approval !== undefined ? change.client_approval : cc.client_approval,
            assigned_sku_ids: change.assigned_sku_ids !== undefined ? change.assigned_sku_ids : cc.assigned_sku_ids,
            content_type: change.content_type !== undefined ? change.content_type : cc.content_type
          };
        }
        return cc;
      }));

      pendingChanges.clear();
      setPendingChanges(new Map());
      await fetchListing(page, false); // refetch silently
    } catch (error) {
      console.error("Batch save error:", error);
      alert("Terjadi kesalahan saat menyimpan perubahan.");
    } finally {
      setIsBatchSaving(false);
      setShowUnsavedFirst(false);
    }
  };

  // Legacy single-row edit state (kept for backwards compat with pencil icon)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSampleProgress, setEditSampleProgress] = useState<any>('Done Req Sample');
  const [editStatusBayar, setEditStatusBayar] = useState<any>('belum');
  const [editNotesManager, setEditNotesManager] = useState('');
  const [editNotesPic, setEditNotesPic] = useState('');

  // Niche Editing
  const [nicheModalOpen, setNicheModalOpen] = useState(false);
  const [nicheEditCreatorId, setNicheEditCreatorId] = useState<number | null>(null);
  const [nicheEditForm, setNicheEditForm] = useState<number[]>([]);
  const [isSavingNiche, setIsSavingNiche] = useState(false);

  const handleSaveNiche = async () => {
    if (!nicheEditCreatorId) return;
    setIsSavingNiche(true);
    try {
      await useDatabaseStore.getState().updateCreatorNiches(nicheEditCreatorId, nicheEditForm);
      await fetchListing(page, false);
      setNicheModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Gagal update niche");
    } finally {
      setIsSavingNiche(false);
    }
  };

  const [filterType, setFilterType] = useState<'all' | 'regular' | 'auto_detect'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'alternate' | 'not_approved'>('all');
  
  // New Multidimensional Filters
  const [filterTier, setFilterTier] = useState<string>('');
  const [filterContentType, setFilterContentType] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterNiche, setFilterNiche] = useState<string>('');
  const [filterAddedBy, setFilterAddedBy] = useState<string>('');
  const [filterActionBy, setFilterActionBy] = useState<string>('');
  const [filterNotes, setFilterNotes] = useState<string>('');
  const [filterUnattributed, setFilterUnattributed] = useState(false);
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
  const [tierCounts, setTierCounts] = useState<Record<string, Record<string, number>>>({
    all: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
    approved: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
    pending: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
    alternate: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
    not_approved: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
  });
  const [dailyRecap, setDailyRecap] = useState<any[]>([]);
  const [rawRecapData, setRawRecapData] = useState<any[]>([]);
  const [recapFilterPic, setRecapFilterPic] = useState<string>('');
  const [recapStartIndex, setRecapStartIndex] = useState(0);
  const [filterPendingWithVideo, setFilterPendingWithVideo] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [selectedCreators, setSelectedCreators] = useState<Set<number>>(new Set());
  const [bulkActionProcessing, setBulkActionProcessing] = useState(false);

  // Add Creator Modal State
  type DynamicRow = { id: string; username: string; price: string; qtyVt: string; qtyLive: string; contentType: string };
  type DragFillState = { active: boolean; startRowIdx: number; currentRowIdx: number; colName: keyof DynamicRow; value: string; };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [dynamicRows, setDynamicRows] = useState<DynamicRow[]>([{ id: Math.random().toString(36).substring(2, 9), username: '', price: '0', qtyVt: '1', qtyLive: '0', contentType: 'Video' }]);
  const [dragFill, setDragFill] = useState<DragFillState | null>(null);
  const [existingCreators, setExistingCreators] = useState<any[]>([]);
  const [missingCreators, setMissingCreators] = useState<any[]>([]);
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);

  const runBulkAutoDetect = async (usernamesToDetect: string[]) => {
    const usernames = usernamesToDetect.map(u => u.replace('@', '').trim().toLowerCase()).filter(Boolean);
    if (usernames.length === 0) return;
    
    setIsAutoDetecting(true);
    try {
      const { data: matchedCreators } = await supabase.from('creators')
        .select('id, username, creator_snapshots(ratecard, id)')
        .in('username', usernames);
        
      if (matchedCreators && matchedCreators.length > 0) {
        setDynamicRows(currentRows => {
          const newRows = [...currentRows];
          let updated = false;
          
          for (let i = 0; i < newRows.length; i++) {
            const row = newRows[i];
            const uname = row.username.replace('@', '').trim().toLowerCase();
            if (!uname) continue;
            
            const matched = matchedCreators.find((c: any) => c.username.toLowerCase() === uname);
            if (!matched) continue;
            
            const snaps = (matched.creator_snapshots || []).sort((a: any, b: any) => b.id - a.id);
            const mergedRatecard = snaps.reduce((acc: any, curr: any) => acc ?? curr.ratecard, null);
            
            if ((!row.price || row.price === '0') && mergedRatecard !== null) {
               newRows[i].price = mergedRatecard.toString();
               updated = true;
            }
          }
          return updated ? newRows : currentRows;
        });
      }
    } catch (e) {
      console.error(e);
    }
    setIsAutoDetecting(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragFill) {
        setDragFill(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragFill]);

  const handleFillHandleMouseDown = (rowIdx: number, colName: keyof DynamicRow, value: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDragFill({
      active: true,
      startRowIdx: rowIdx,
      currentRowIdx: rowIdx,
      colName,
      value
    });
  };

  const handleCellMouseEnter = (rowIdx: number, colName: keyof DynamicRow) => {
    if (!dragFill?.active || dragFill.colName !== colName) return;
    
    if (rowIdx !== dragFill.currentRowIdx) {
      setDragFill(prev => prev ? { ...prev, currentRowIdx: rowIdx } : null);
      
      const start = Math.min(dragFill.startRowIdx, rowIdx);
      const end = Math.max(dragFill.startRowIdx, rowIdx);
      
      setDynamicRows(prev => prev.map((r, i) => {
        if (i >= start && i <= end) {
          const updated = { ...r, [dragFill.colName]: dragFill.value };
          return updated;
        }
        return r;
      }));
    }
  };


  const COLUMNS: (keyof DynamicRow)[] = ['username', 'price', 'qtyVt', 'qtyLive', 'contentType'];

  const handleGlobalPaste = (e: React.ClipboardEvent<HTMLInputElement | HTMLSelectElement>, startRowIdx: number, startColName: keyof DynamicRow) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\n') && !text.includes('\t')) return;

    e.preventDefault();
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return;

    setDynamicRows(prevRows => {
      const newRows = [...prevRows];
      const startColIdx = COLUMNS.indexOf(startColName);
      if (startColIdx === -1) return prevRows;

      const pastedUsernames: string[] = [];

      lines.forEach((line, lineIdx) => {
        const rawCols = line.split('\t');
        let cols = rawCols;

        const targetRowIdx = startRowIdx + lineIdx;
        let rowDataToUpdate: Partial<DynamicRow> = {};
        
        cols.forEach((colVal, colOffset) => {
          const targetColIdx = startColIdx + colOffset;
          if (targetColIdx < COLUMNS.length) {
            const field = COLUMNS[targetColIdx];
            let cleanVal = colVal;
            
            if (field === 'username') cleanVal = cleanVal.replace('@', '').trim().toLowerCase();
            else if (['price', 'qtyVt', 'qtyLive'].includes(field)) cleanVal = cleanVal.replace(/[^0-9]/g, '');
            else cleanVal = cleanVal.trim();

            if (field === 'contentType') {
                const ctypeRaw = cleanVal.toLowerCase();
                let ctype = 'Video';
                if (ctypeRaw.includes('live') && ctypeRaw.includes('video')) ctype = 'Video & Live';
                else if (ctypeRaw.includes('live')) ctype = 'Live';
                rowDataToUpdate[field] = ctype;
            } else {
                rowDataToUpdate[field] = cleanVal as any;
            }
            
            if (field === 'username' && cleanVal) {
              pastedUsernames.push(cleanVal);
            }
          }
        });

        if (targetRowIdx < newRows.length) {
          Object.assign(newRows[targetRowIdx], rowDataToUpdate);
        } else {
          newRows.push({
            id: Math.random().toString(36).substring(2, 9),
            username: '',
            price: '0',
            qtyVt: '1',
            qtyLive: '0',
            contentType: 'Video',
            ...rowDataToUpdate
          } as DynamicRow);
        }
      });

      if (pastedUsernames.length > 0) {
        runBulkAutoDetect(pastedUsernames);
      }

      return newRows;
    });
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(tableSearch);
    }, 500);
    return () => clearTimeout(handler);
  }, [tableSearch]);

  const checkDuplicates = useCallback(async () => {
    let allData: any[] = [];
    let start = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('campaign_creators')
        .select(`
          id, campaign_id, creator_id, price, qty_vt, approval, sample_progress, status_bayar, notes_manager, notes_pic,
          creators ( username ),
          videos ( id, urutan, concept, link_video, vt_approval )
        `)
        .eq('campaign_id', campaignId)
        .range(start, start + pageSize - 1);

      if (error || !data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize) break;
      start += pageSize;
    }

    const groupings: Record<string, any[]> = {};
    for (const row of allData) {
      const uname = row.creators?.username?.toLowerCase() || `unknown_${row.id}`;
      const key = `${row.campaign_id}_${uname}`;
      if (!groupings[key]) groupings[key] = [];
      groupings[key].push(row);
    }

    const dups: any[] = [];
    for (const [key, rows] of Object.entries(groupings)) {
      if (rows.length > 1) {
        dups.push(rows);
      }
    }
    setDuplicateGroups(dups);
  }, [campaignId]);

  useEffect(() => {
    checkDuplicates();
  }, [checkDuplicates]);

  const fetchCounts = useCallback(async () => {
    // Fetch all data for accurate, deduplicated counting
    let allRecapData: any[] = [];
    let start = 0;
    const pageSize = 1000;
    while (true) {
      const { data } = await supabase
        .from('campaign_creators')
        .select(`
          id, approval, approved_at, created_at, added_by, tier, creator_id,
          creators ( username, creator_snapshots ( id, tier, tanggal_update ) )
        `)
        .eq('campaign_id', campaignId)
        .range(start, start + pageSize - 1);
        
      if (!data || data.length === 0) break;
      allRecapData = allRecapData.concat(data);
      if (data.length < pageSize) break;
      start += pageSize;
    }

    // Deduplicate by username (or fallback to id)
    const uniqueMap = new Map();
    for (const row of allRecapData) {
       const uname = row.creators?.username?.toLowerCase() || `unknown_${row.creator_id || row.id}`;
       if (!uniqueMap.has(uname)) {
          uniqueMap.set(uname, row);
       } else {
          // If duplicate exists, prefer 'approved' over others
          const existing = uniqueMap.get(uname);
          if (existing.approval !== 'approved' && row.approval === 'approved') {
              uniqueMap.set(uname, row);
          }
       }
    }
    const deduplicatedData = Array.from(uniqueMap.values());

    let approved = 0, pending = 0, alternate = 0, not_approved = 0;
    for (const row of deduplicatedData) {
       if (row.approval === 'approved') approved++;
       else if (row.approval === 'pending') pending++;
       else if (row.approval === 'alternate') alternate++;
       else if (row.approval === 'not_approved') not_approved++;
    }

    setCounts({ approved, pending, alternate, not_approved, all: deduplicatedData.length });
    setRawRecapData(deduplicatedData);
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

    // Calculate tier breakdowns for all statuses
    const tCounts: Record<string, Record<string, number>> = {
      all: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      approved: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      pending: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      alternate: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
      not_approved: { Nano: 0, Micro: 0, Macro: 0, Mega: 0 },
    };

    rawRecapData.forEach(r => {
      let snapshotTier = null;
      if (r.creators?.creator_snapshots) {
        // Sort snapshots by tanggal_update DESC, then id DESC
        const sortedSnaps = [...r.creators.creator_snapshots].sort((a: any, b: any) => {
          const tDiff = new Date(b.tanggal_update || 0).getTime() - new Date(a.tanggal_update || 0).getTime();
          if (tDiff !== 0) return tDiff;
          return (b.id || 0) - (a.id || 0);
        });
        // Find the most recent snapshot with a valid tier
        const validSnap = sortedSnaps.find((s: any) => s.tier);
        if (validSnap) snapshotTier = validSnap.tier;
      }
      let t = snapshotTier || r.tier;
      
      if (t) {
        t = t.toLowerCase();
        t = t.charAt(0).toUpperCase() + t.slice(1);
      }

      if (t && ['Nano', 'Micro', 'Macro', 'Mega'].includes(t)) {
        tCounts.all[t]++;
        if (r.approval === 'approved') tCounts.approved[t]++;
        else if (r.approval === 'alternate') tCounts.alternate[t]++;
        else if (r.approval === 'not_approved') tCounts.not_approved[t]++;
        else if (r.approval === 'pending') tCounts.pending[t]++;
      }
    });
    setTierCounts(tCounts);

  }, [rawRecapData, recapFilterPic]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const fetchIdRef = useRef(0);

  const fetchListing = useCallback(async (pageNum: number, isReset = false) => {
    const currentFetchId = ++fetchIdRef.current;
    setIsLoading(true);
    try {
      let selectQuery = `
        id, creator_id, price, qty_vt, qty_live, content_type, approval, client_approval, tier,
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
        videos${filterPendingWithVideo ? '!inner' : ''} (
          id, urutan, concept, link_video, vt_approval
        )
      `;

      let query: any = supabase.from('campaign_creators').select(selectQuery).eq('campaign_id', campaignId);

      // Filters
      if (filterType === 'auto_detect') query = query.eq('tier', 'Auto-Detect');
      if (filterType === 'regular') query = query.or('tier.neq.Auto-Detect,tier.is.null');
      
      if (filterPendingWithVideo) {
        query = query.eq('approval', 'pending');
      } else if (filterUnattributed) {
        query = query.eq('approval', 'pending');
        
        const { data: salesData } = await supabase
          .from('campaign_sales_summary')
          .select('creator_username')
          .eq('campaign_id', campaignId)
          .gt('gmv_organic', 0);
          
        const salesUsernames = (salesData || []).map(c => c.creator_username.toLowerCase());
        
        if (salesUsernames.length > 0) {
          query = query.in('creators.username', salesUsernames);
        } else {
          query = query.eq('id', -1);
        }
      } else if (statusFilter !== 'all') {
        query = query.eq('approval', statusFilter);
      }
      
      // Multi-dimensional filters
      // Multi-dimensional filters
      if (filterTier) {
        query = query.ilike('creators.creator_snapshots.tier', filterTier);
      }
      if (filterLevel) query = query.eq('creators.creator_snapshots.level', filterLevel);
      if (filterNiche) query = query.eq('creators.creator_niches.niche_id', filterNiche);
      if (filterAddedBy) query = query.eq('added_by', filterAddedBy);
      if (filterActionBy) query = query.or(`approved_by.eq.${filterActionBy},not_approved_by.eq.${filterActionBy}`);
      if (filterContentType) {
        if (filterContentType === 'Video') {
          query = query.or('content_type.eq.Video,and(content_type.in.("-",""),qty_vt.gte.1,qty_live.eq.0),and(content_type.is.null,qty_vt.gte.1,qty_live.eq.0)');
        } else if (filterContentType === 'Live') {
          query = query.or('content_type.eq.Live,and(content_type.in.("-",""),qty_vt.eq.0,qty_live.gte.1),and(content_type.is.null,qty_vt.eq.0,qty_live.gte.1)');
        } else if (filterContentType === 'Video & Live') {
          query = query.or('content_type.eq."Video & Live",and(content_type.in.("-",""),qty_vt.gte.1,qty_live.gte.1),and(content_type.is.null,qty_vt.gte.1,qty_live.gte.1)');
        }
      }
      
      if (filterNotes === 'Ada Notes') {
        query = query.or('and(notes_manager.not.is.null,notes_manager.neq.""),and(notes_pic.not.is.null,notes_pic.neq."")');
      }

      if (debouncedSearch) {
        query = query.or(`username.ilike.%${debouncedSearch}%,nama_asli.ilike.%${debouncedSearch}%`, { foreignTable: 'creators' });
      }

      // Pagination
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      // Always sort backend by ID desc to get newest first, then sort accurately on frontend
      if (filterNotes === 'Ada Notes') {
        query = query.order('id', { ascending: false }); // Fetch all matching notes to sort properly on frontend
      } else {
        query = query.order('id', { ascending: false }).range(from, to);
      }

      const { data, error } = await query;
      if (currentFetchId !== fetchIdRef.current) return; // Ignore stale fetch result
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

      // Deduplicate finalData by username to hide duplicates from the table UI
      const uniqueMap = new Map();
      for (const row of finalData) {
         const uname = row.creators?.username?.toLowerCase() || `unknown_${row.id}`;
         if (!uniqueMap.has(uname)) {
            uniqueMap.set(uname, row);
         } else {
            // Keep the approved one if there's a conflict
            const existing = uniqueMap.get(uname);
            if (existing.approval !== 'approved' && row.approval === 'approved') {
               uniqueMap.set(uname, row);
            }
         }
      }
      finalData = Array.from(uniqueMap.values());

      if (filterNotes === 'Ada Notes') {
        const parseNotesList = (raw: string) => {
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.filter((n: any) => n.isi && n.isi.trim() !== '');
            return [{ isi: raw, created_at: null }];
          } catch { return [{ isi: raw, created_at: null }]; }
        };

        finalData = finalData.filter(cc => {
          const mn = parseNotesList(cc.notes_manager);
          const pn = parseNotesList(cc.notes_pic);
          return mn.length > 0 || pn.length > 0;
        });

        finalData.sort((a, b) => {
          const getLatest = (cc: any) => {
            const mn = parseNotesList(cc.notes_manager);
            const pn = parseNotesList(cc.notes_pic);
            const all = [...mn, ...pn];
            if (all.length === 0) return 0;
            const validDates = all.filter(n => n.created_at).map(n => new Date(n.created_at).getTime());
            if (validDates.length > 0) {
              return Math.max(...validDates);
            }
            return 0; // If no valid dates, treat as old
          };
          return getLatest(b) - getLatest(a);
        });

        // Do not slice/paginate for this filter so user can see all at once
        setHasMore(false);
      } else {
        setHasMore((data || []).length === PAGE_SIZE);
      }

      if (isReset || filterNotes === 'Ada Notes') {
        setListingData(finalData);
      } else {
        setListingData(prev => [...prev, ...finalData]);
      }
    } catch (e) {
      if (currentFetchId === fetchIdRef.current) {
         console.error(e);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
         setIsLoading(false);
      }
    }
  }, [campaignId, filterType, statusFilter, debouncedSearch, sortConfig, filterTier, filterLevel, filterNiche, filterAddedBy, filterActionBy, filterPendingWithVideo, filterUnattributed, filterContentType, filterNotes]);

  useEffect(() => {
    fetchListing(page);
  }, [page, campaignId, filterType, statusFilter, debouncedSearch, sortConfig, filterTier, filterLevel, filterNiche, filterAddedBy, filterActionBy, filterPendingWithVideo, filterUnattributed, filterContentType, filterNotes]);

  useEffect(() => {
    setPage(0);
    fetchListing(0, true);
  }, [debouncedSearch, filterType, statusFilter, sortConfig, fetchListing, filterTier, filterLevel, filterNiche, filterAddedBy, filterActionBy, filterPendingWithVideo, filterUnattributed, filterContentType, filterNotes]);

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
    setEditSampleProgress(cc.sample_progress || 'Done Req Sample');
    setEditStatusBayar(cc.status_bayar || 'belum');
    setEditNotesManager(cc.notes_manager || '');
    setEditNotesPic(cc.notes_pic || '');
  };

  const saveEdit = async (ccId: number) => {
    if (!hasAccess) return;
    // Only save notes/sample_progress/status_bayar via legacy edit (non-batch fields)
    await updateCampaignCreator(ccId, {
      sample_progress: editSampleProgress,
      notes_manager: editNotesManager,
      notes_pic: editNotesPic,
    }, profile?.nama || 'System');
    setEditingId(null);
    setPage(0);
    fetchListing(0, true);
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

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAccess || isAddingBulk) return;

    setIsAddingBulk(true);

    try {
      const validRows = dynamicRows.filter(r => r.username.trim() !== '');
      if (validRows.length === 0) {
        setIsAddingBulk(false);
        return;
      }

      const usernames = validRows.map(r => r.username.replace('@', '').trim().toLowerCase());
      const uniqueUsernames = Array.from(new Set(usernames));

      // Fetch existing creators
      const { data: existingData, error: fetchErr } = await supabase.from('creators')
        .select(`
          id, username, added_by,
          creator_contacts(id),
          creator_snapshots(id),
          creator_niches(niche_id),
          campaign_creators( campaign_id, campaigns(nama) )
        `)
        .in('username', uniqueUsernames);

      if (fetchErr) throw fetchErr;

      const existingMap = new Map((existingData || []).map(c => [c.username.toLowerCase(), c]));
      
      const missing: any[] = [];
      const existing: any[] = [];

      for (const row of validRows) {
        const uname = row.username.replace('@', '').trim().toLowerCase();
        const found = existingMap.get(uname);
        if (found) {
          existing.push({ ...row, ...found });
        } else {
          missing.push(row);
        }
      }

      setExistingCreators(existing);
      setMissingCreators(missing);
      setModalStep(2);

    } catch (err: any) {
      console.error(err);
      alert('Gagal melakukan scan kreator: ' + (err.message || err.toString()));
    } finally {
      setIsAddingBulk(false);
    }
  };

  const handleRescanMissing = async () => {
    if (missingCreators.length === 0) return;
    setIsAddingBulk(true);
    try {
      const usernames = missingCreators.map(m => m.username.replace('@', '').trim().toLowerCase());
      
      const { data: foundInDb, error: fetchErr } = await supabase.from('creators')
        .select(`
          id, username, added_by,
          creator_contacts(id),
          creator_snapshots(id),
          creator_niches(niche_id),
          campaign_creators( campaign_id, campaigns(nama) )
        `)
        .in('username', usernames);
        
      if (fetchErr) throw fetchErr;
      
      if (foundInDb && foundInDb.length > 0) {
        const foundUsernames = new Set(foundInDb.map(c => c.username.toLowerCase()));
        
        const newExisting = missingCreators
          .filter(m => foundUsernames.has(m.username.replace('@', '').trim().toLowerCase()))
          .map(m => {
            const dbData = foundInDb.find(d => d.username.toLowerCase() === m.username.replace('@', '').trim().toLowerCase());
            return { ...m, ...dbData };
          });
          
        setExistingCreators(prev => [...prev, ...newExisting]);
        setMissingCreators(prev => prev.filter(m => !foundUsernames.has(m.username.replace('@', '').trim().toLowerCase())));
      } else {
        alert("Belum ada data kreator yang masuk di database. Silakan import/lengkapi dulu.");
      }
    } catch (err: any) {
      alert("Gagal scan ulang: " + err.message);
    } finally {
      setIsAddingBulk(false);
    }
  };

  const handleSubmitToCampaign = async (group: 'existing' | 'missing') => {
    if (!hasAccess || isAddingBulk) return;
    setIsAddingBulk(true);

    try {
      const rowsToProcess = group === 'existing' ? existingCreators : missingCreators;
      if (rowsToProcess.length === 0) return;

      let allCreators = [...rowsToProcess];

      if (group === 'missing') {
        const payloads = rowsToProcess.map(r => ({
          username: r.username.replace('@', '').trim().toLowerCase(),
          link_account: `https://www.tiktok.com/@${r.username.replace('@', '').trim().toLowerCase()}`,
          added_by: profile?.id
        }));

        const usernames = payloads.map(p => p.username);
        const { data: existingInDb } = await supabase.from('creators').select('id, username, added_by').in('username', usernames);
        const existingUsernames = new Set((existingInDb || []).map(c => c.username.toLowerCase()));
        
        const toInsert = payloads.filter(p => !existingUsernames.has(p.username.toLowerCase()));
        
        let insertedData: any[] = [];
        if (toInsert.length > 0) {
           const { data, error: insErr } = await supabase.from('creators').insert(toInsert).select('id, username, added_by');
           if (insErr) throw insErr;
           insertedData = data || [];
        }

        const allFetchedCreators = [...(existingInDb || []), ...insertedData];
        const insertedMap = new Map(allFetchedCreators.map(c => [c.username.toLowerCase(), c]));
        
        allCreators = rowsToProcess.map(r => {
          const uname = r.username.replace('@', '').trim().toLowerCase();
          return { ...r, ...insertedMap.get(uname) };
        });
      }

      // 3. Prepare campaign creators bulk payload
      const campaignPayloads = allCreators.map(c => ({
        campaign_id: campaignId,
        creator_id: c.id,
        tier: 'NANO',
        price: Number(c.price),
        qty_vt: Number(c.qtyVt),
        qty_live: Number(c.qtyLive) || 0,
        content_type: c.contentType || 'Video',
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

      // 4. Check if their USERNAME is already in the campaign to absolutely avoid duplication
      const { data: existingCcData } = await supabase.from('campaign_creators')
        .select(`
          creator_id,
          creators ( username )
        `)
        .eq('campaign_id', campaignId);
      
      const existingUsernames = new Set(
        (existingCcData || [])
          .map((cc: any) => cc.creators?.username?.toLowerCase())
          .filter(Boolean)
      );

      // Create a map to quickly look up usernames for the payloads
      const payloadUsernames = new Map(allCreators.map(c => [c.id, c.username?.toLowerCase()]));

      const newCampaignPayloads = campaignPayloads.filter(p => {
        const uname = payloadUsernames.get(p.creator_id);
        return uname ? !existingUsernames.has(uname) : true;
      });

      if (newCampaignPayloads.length > 0) {
        const { error: ccErr } = await supabase.from('campaign_creators').insert(newCampaignPayloads);
        if (ccErr) throw ccErr;
        

      }

      // Refresh to show changes immediately
      setPage(0);
      fetchListing(0, true);
      fetchCounts();

      alert(`Berhasil menambahkan ${newCampaignPayloads.length} kreator ke campaign!`);

      if (group === 'existing') {
        setExistingCreators([]);
      } else {
        setMissingCreators([]);
      }

      if (group === 'existing' && missingCreators.length === 0) {
        setIsAddModalOpen(false);
      } else if (group === 'missing' && existingCreators.length === 0) {
        // Keep modal open so they can click the redirect button
      }

    } catch (err: any) {
      console.error(err);
      alert('Gagal menambahkan kreator ke campaign: ' + (err.message || err.toString()));
    } finally {
      setIsAddingBulk(false);
    }
  };


  const handleExport = () => {
    const exportData = Array.from(new Map(listingData.map(c => [c.creators?.username?.toLowerCase() || c.id, c])).values()).map((cc: any) => {
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

  const renderTd = (colName: keyof DynamicRow, rowIdx: number, value: string, children: React.ReactNode, tdClassName: string = "py-2 pr-2") => {
    const isDraggingHere = dragFill && dragFill.active && dragFill.colName === colName && 
      rowIdx >= Math.min(dragFill.startRowIdx, dragFill.currentRowIdx) && 
      rowIdx <= Math.max(dragFill.startRowIdx, dragFill.currentRowIdx);

    return (
      <td 
        className={`relative group ${tdClassName}`}
        onMouseEnter={() => handleCellMouseEnter(rowIdx, colName)}
      >
        {children}
        <div 
          className="absolute bottom-0 right-2 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-150"
          onMouseDown={(e) => handleFillHandleMouseDown(rowIdx, colName, value, e)}
        />
        {isDraggingHere && (
          <div className="absolute inset-0 border-2 border-blue-400 pointer-events-none z-20 bg-blue-50/20" />
        )}
      </td>
    );
  };
  type StatusFilterType = 'pending' | 'approved' | 'alternate' | 'not_approved' | 'all';

  const handleCapsuleClick = (status: StatusFilterType, tier: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (statusFilter === status && filterTier === tier) {
      setStatusFilter('all');
      setFilterTier('');
    } else {
      setStatusFilter(status);
      setFilterTier(tier);
    }
  };

  const renderTierCapsules = (statusKey: StatusFilterType, baseColorClass: string, activeColorClass: string) => {
    const tCounts = tierCounts[statusKey] || { Nano: 0, Micro: 0, Macro: 0, Mega: 0 };
    const tiers = ['Nano', 'Micro', 'Macro', 'Mega'];
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {tiers.map(t => {
          const isActive = statusFilter === statusKey && filterTier === t;
          const count = tCounts[t] || 0;
          return (
            <div 
              key={t}
              onClick={(e) => handleCapsuleClick(statusKey, t, e)}
              className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer border transition-colors ${isActive ? activeColorClass : `bg-white ${baseColorClass} hover:bg-slate-100`}`}
            >
              <span className="font-semibold">{t}</span> {count}
            </div>
          );
        })}
      </div>
    );
  };

  let displayData = showUnsavedFirst
    ? [...listingData].sort((a, b) => {
        const aHas = pendingChanges.has(a.id) ? 0 : 1;
        const bHas = pendingChanges.has(b.id) ? 0 : 1;
        return aHas - bHas;
      })
    : [...listingData];
  
  // Apply Global Creator Filter
  displayData = displayData.filter((c: any) => isCreatorVisible(c.creators?.username));
  
  displayData = Array.from(new Map(displayData.map(c => [c.creators?.username?.toLowerCase() || c.id, c])).values());

  // Pre-calculate snapshots to prevent severe O(N log N) performance degradation during sorting
  displayData = displayData.map((c: any) => {
      c._cachedSnapshot = c._cachedSnapshot || extractLatestSnapshot(c.creators);
      return c;
  });

  // Frontend Sorting for 100% accuracy on all columns
  if (sortConfig.key !== 'id') {
    displayData.sort((a: any, b: any) => {
      let valA: any = 0;
      let valB: any = 0;
      
      if (sortConfig.key === 'username') {
        valA = a.creators?.username?.toLowerCase() || '';
        valB = b.creators?.username?.toLowerCase() || '';
      } else if (sortConfig.key === 'price') {
        valA = Number(a.price) || 0;
        valB = Number(b.price) || 0;
      } else if (sortConfig.key === 'qty_vt') {
        valA = Number(a.qty_vt) || 0;
        valB = Number(b.qty_vt) || 0;
      } else if (sortConfig.key === 'qty_live') {
        valA = Number(a.qty_live) || 0;
        valB = Number(b.qty_live) || 0;
      } else if (sortConfig.key === 'approval') {
        valA = a.approval || '';
        valB = b.approval || '';
      } else if (sortConfig.key === 'followers') {
        valA = Number(a._cachedSnapshot?.followers) || 0;
        valB = Number(b._cachedSnapshot?.followers) || 0;
      } else if (sortConfig.key === 'tier') {
        valA = a._cachedSnapshot?.tier || a.tier || '';
        valB = b._cachedSnapshot?.tier || b.tier || '';
      } else if (sortConfig.key === 'level') {
        valA = Number(a._cachedSnapshot?.level) || 0;
        valB = Number(b._cachedSnapshot?.level) || 0;
      } else if (sortConfig.key === 'content_type') {
        const getDerivedCT = (c: any) => {
          let ct = c.content_type || '-';
          if (ct === '-') {
            const v = Number(c.qty_vt) || 0;
            const l = Number(c.qty_live) || 0;
            if (v >= 1 && l === 0) ct = 'Video';
            else if (v === 0 && l >= 1) ct = 'Live';
            else if (v >= 1 && l >= 1) ct = 'Video & Live';
          }
          return ct;
        };
        valA = getDerivedCT(a);
        valB = getDerivedCT(b);
      } else if (sortConfig.key === 'gmv') {
        valA = Number(a._cachedSnapshot?.gmv_30d) || 0;
        valB = Number(b._cachedSnapshot?.gmv_30d) || 0;
      }

      if (valA < valB) return sortConfig.dir === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const toggleSelectAll = () => {
    if (selectedCreators.size === displayData.length && displayData.length > 0) {
      setSelectedCreators(new Set());
    } else {
      setSelectedCreators(new Set(displayData.map((c: any) => c.id).filter(Boolean)));
    }
  };

  const toggleSelectCreator = (id: number) => {
    setSelectedCreators(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkApproval = async (status: 'approved' | 'pending' | 'alternate' | 'not_approved') => {
    if (selectedCreators.size === 0) return;
    setBulkActionProcessing(true);
    try {
      const creatorIds = Array.from(selectedCreators);
      const { error } = await supabase.from('campaign_creators').update({ approval: status }).in('id', creatorIds);
      if (error) throw error;
      
      setListingData(prev => prev.map(c => {
         if (creatorIds.includes(c.id)) {
            return { ...c, approval: status };
         }
         return c;
      }));
      
      setSelectedCreators(new Set());
      fetchListing();
    } catch (err: any) {
      alert('Gagal melakukan aksi massal: ' + err.message);
    } finally {
      setBulkActionProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCreators.size === 0) return;
    if (!window.confirm(`Yakin ingin menghapus ${selectedCreators.size} kreator ini dari campaign?`)) return;
    setBulkActionProcessing(true);
    try {
      const creatorIds = Array.from(selectedCreators);
      const { error } = await supabase.from('campaign_creators').delete().in('id', creatorIds);
      if (error) throw error;
      
      setListingData(prev => prev.filter(c => !creatorIds.includes(c.id)));
      setSelectedCreators(new Set());
      fetchListing();
    } catch (err: any) {
      alert('Gagal menghapus massal: ' + err.message);
    } finally {
      setBulkActionProcessing(false);
    }
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
            <button 
              className={`btn ${duplicateGroups.length > 0 ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 animate-pulse' : 'btn-outline border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              onClick={() => {
                if (duplicateGroups.length > 0) setIsDuplicateModalOpen(true);
              }}
              disabled={duplicateGroups.length === 0}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Data Dobel ({duplicateGroups.length})
            </button>
          )}

          {hasAccess && (
            <button className="btn btn-primary" onClick={() => {
              router.push(`/campaigns/${campaignId}/listing/import-creator`);
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
          <select value={filterContentType} onChange={(e) => setFilterContentType(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5">
            <option value="">Semua Tipe Konten</option>
            <option value="Video">Video</option>
            <option value="Live">Live</option>
            <option value="Video & Live">Video & Live</option>
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
          <select value={filterNotes} onChange={(e) => setFilterNotes(e.target.value)} className="select !mb-0 min-w-[120px] md:w-auto flex-1 text-sm py-1.5 border-orange-300 bg-orange-50 text-orange-800">
            <option value="">Semua Notes</option>
            <option value="Ada Notes">Hanya Ada Notes</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox" 
              checked={filterPendingWithVideo}
              onChange={(e) => {
                setFilterPendingWithVideo(e.target.checked);
                if (e.target.checked) setStatusFilter('pending');
              }}
              className="rounded border-slate-300 text-p300 focus:ring-p300"
            />
            <span className="font-medium whitespace-nowrap">Pending ber-Video (Sisa)</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox" 
              checked={filterUnattributed}
              onChange={(e) => {
                setFilterUnattributed(e.target.checked);
                if (e.target.checked) {
                  setStatusFilter('pending');
                  setFilterPendingWithVideo(false);
                }
              }}
              className="rounded border-slate-300 text-p300 focus:ring-p300"
            />
            <span className="font-medium whitespace-nowrap">Unattributed (Pending + GMV)</span>
          </label>
          {(statusFilter !== 'all' || filterTier || filterLevel || filterNiche || filterAddedBy || filterActionBy || filterPendingWithVideo || filterUnattributed || filterContentType) && (
            <button 
              onClick={() => {
                setStatusFilter('all');
                setFilterTier('');
                setFilterLevel('');
                setFilterNiche('');
                setFilterAddedBy('');
                setFilterActionBy('');
                setFilterContentType('');
                setFilterNotes('');
                setFilterPendingWithVideo(false);
                setFilterUnattributed(false);
              }} 
              className="btn btn-outline text-red-500 border-red-200 hover:bg-red-50 flex-1 md:flex-none"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-[16px]">
        <div className={`metric cursor-pointer ${statusFilter === 'all' ? 'ring-2 ring-p300' : ''}`} onClick={() => setStatusFilter('all')}>
          <div className="mlbl">Total Creator</div>
          <div className="mval">{counts.all}</div>
          {renderTierCapsules('all', 'text-slate-500 border-slate-200', 'bg-slate-800 text-white border-slate-800')}
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'approved' ? 'ring-2 ring-green-500 bg-green-50/50' : ''}`} onClick={() => setStatusFilter('approved')}>
          <div className="mlbl text-green-700">Approved</div>
          <div className="mval text-green-700">{counts.approved}</div>
          {renderTierCapsules('approved', 'text-green-600 border-green-200', 'bg-green-700 text-white border-green-700')}
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'pending' ? 'ring-2 ring-orange-400 bg-orange-50/50' : ''}`} onClick={() => setStatusFilter('pending')}>
          <div className="mlbl text-orange-600">Pending</div>
          <div className="mval text-orange-600">{counts.pending}</div>
          {renderTierCapsules('pending', 'text-orange-600 border-orange-200', 'bg-orange-600 text-white border-orange-600')}
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'alternate' ? 'ring-2 ring-purple-400 bg-purple-50/50' : ''}`} onClick={() => setStatusFilter('alternate')}>
          <div className="mlbl text-purple-600">Alternate</div>
          <div className="mval text-purple-600">{counts.alternate}</div>
          {renderTierCapsules('alternate', 'text-purple-600 border-purple-200', 'bg-purple-600 text-white border-purple-600')}
        </div>
        <div className={`metric cursor-pointer ${statusFilter === 'not_approved' ? 'ring-2 ring-red-400 bg-red-50/50' : ''}`} onClick={() => setStatusFilter('not_approved')}>
          <div className="mlbl text-red-600">Not Approved</div>
          <div className="mval text-red-600">{counts.not_approved}</div>
          {renderTierCapsules('not_approved', 'text-red-600 border-red-200', 'bg-red-600 text-white border-red-600')}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative shadow-2xl">
            {isAutoDetecting && (
              <div className="absolute top-4 right-10 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in slide-in-from-top-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Mengecek database...</span>
              </div>
            )}
            <div className="p-[24px] flex flex-col min-h-0 flex-1 relative">
              <h3 className="text-[18px] font-bold mb-[16px]">Tambah Creator ke Campaign</h3>
            
            <div className="flex-1 overflow-y-auto min-h-0 pr-2">
              {modalStep === 1 && (
                <form onSubmit={handleScan} className="space-y-[16px]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2">Username</th>
                          <th className="pb-2">Rate Card (Rp)</th>
                          <th className="pb-2">Qty VT</th>
                          <th className="pb-2">Qty Live</th>
                          <th className="pb-2">Tipe Konten</th>
                          <th className="pb-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dynamicRows.map((row, index) => (
                          <tr key={row.id} className="border-b">
                            {renderTd('username', index, row.username, (
                              <input 
                                type="text"
                                required
                                value={row.username}
                                onChange={e => {
                                  const newRows = [...dynamicRows];
                                  newRows[index].username = e.target.value;
                                  setDynamicRows(newRows);
                                }}
                                onPaste={e => handleGlobalPaste(e, index, 'username')}
                                onBlur={e => {
                                  const val = e.target.value.replace('@', '').trim();
                                  if (val) runBulkAutoDetect([val]);
                                }}
                                className="input h-9 text-sm w-full"
                                placeholder="tanpa @"
                              />
                            ))}
                            {renderTd('price', index, row.price, (
                              <input 
                                type="number"
                                required
                                min="0"
                                value={row.price}
                                onPaste={e => handleGlobalPaste(e, index, 'price')}
                                onChange={e => {
                                  const newRows = [...dynamicRows];
                                  newRows[index].price = e.target.value;
                                  setDynamicRows(newRows);
                                }}
                                className="input h-9 text-sm w-full"
                              />
                            ))}
                            {renderTd('qtyVt', index, row.qtyVt, (
                              <input 
                                type="number"
                                required
                                min="0"
                                value={row.qtyVt}
                                onPaste={e => handleGlobalPaste(e, index, 'qtyVt')}
                                onChange={e => {
                                  const newRows = [...dynamicRows];
                                  newRows[index].qtyVt = e.target.value;
                                  setDynamicRows(newRows);
                                }}
                                className="input h-9 text-sm w-full"
                              />
                            ))}
                            {renderTd('qtyLive', index, row.qtyLive, (
                              <input 
                                type="number"
                                required
                                min="0"
                                value={row.qtyLive}
                                onPaste={e => handleGlobalPaste(e, index, 'qtyLive')}
                                onChange={e => {
                                  const newRows = [...dynamicRows];
                                  newRows[index].qtyLive = e.target.value;
                                  setDynamicRows(newRows);
                                }}
                                className="input h-9 text-sm w-full"
                              />
                            ))}
                            {renderTd('contentType', index, row.contentType, (
                              <select
                                value={row.contentType}
                                onPaste={e => handleGlobalPaste(e, index, 'contentType')}
                                onChange={e => {
                                  const newRows = [...dynamicRows];
                                  newRows[index].contentType = e.target.value;
                                  setDynamicRows(newRows);
                                }}
                                className="input h-9 text-sm w-full bg-white"
                              >
                                <option value="Video">Video</option>
                                <option value="Live">Live</option>
                                <option value="Video & Live">Video & Live</option>
                              </select>
                            ))}
                            <td className="py-2 text-center">
                              <button 
                                type="button" 
                                onClick={() => {
                                  if (dynamicRows.length > 1) {
                                    setDynamicRows(dynamicRows.filter(r => r.id !== row.id));
                                  }
                                }}
                                className="text-error hover:bg-error/10 p-1 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setDynamicRows([...dynamicRows, { id: Math.random().toString(36).substring(2, 9), username: '', price: '0', qtyVt: '1', qtyLive: '0', contentType: 'Video' }]);
                      }}
                      className="text-p500 text-sm font-semibold hover:underline flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Tambah Baris
                    </button>
                  </div>

                  <div className="flex justify-end gap-[10px] mt-[24px] pt-4 border-t">
                    <button type="button" className="btn btn-outline" onClick={() => setIsAddModalOpen(false)}>Batal</button>
                    <button type="submit" className="btn btn-primary" disabled={isAddingBulk}>
                      {isAddingBulk ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2 inline-block" /> Scanning...</>
                      ) : (
                        'Scan & Cek Database'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {modalStep === 2 && (
                <div className="space-y-6">
                  {/* Table 1: Existing Creators */}
                  <div className="border rounded-xl p-4">
                    <h4 className="font-bold text-p500 mb-2 flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2" /> 
                      Sudah Ada di Pool ({existingCreators.length})
                    </h4>
                    {existingCreators.length > 0 ? (
                      <>
                        <div className="max-h-40 overflow-y-auto border rounded mb-3">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="p-2 border-b">Username</th>
                                <th className="p-2 border-b">Rate Card</th>
                                <th className="p-2 border-b">Qty VT</th>
                              </tr>
                            </thead>
                            <tbody>
                              {existingCreators.map(c => (
                                <tr key={c.id} className="border-b">
                                  <td className="p-2">
                                    <div className="font-medium text-slate-800">@{c.username}</div>
                                    {c.campaign_creators && c.campaign_creators.length > 0 && (
                                      <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1">
                                        {c.campaign_creators.map((cc: any, idx: number) => (
                                          <span key={idx} className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[120px]" title={cc.campaigns?.nama}>
                                            {cc.campaigns?.nama || 'Campaign'}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2">Rp {Number(c.price).toLocaleString('id-ID')}</td>
                                  <td className="p-2">{c.qtyVt}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <button 
                          onClick={() => handleSubmitToCampaign('existing')}
                          disabled={isAddingBulk}
                          className="btn btn-primary w-full"
                        >
                          {isAddingBulk ? 'Memproses...' : 'Tambah ke Campaign'}
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-text-soft">Tidak ada kreator di kategori ini.</p>
                    )}
                  </div>

                  {/* Table 2: Missing Creators */}
                  <div className="border border-error/30 rounded-xl p-4 bg-error/5">
                    <h4 className="font-bold text-error mb-2 flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2" /> 
                      Belum Ada di Pool ({missingCreators.length})
                    </h4>
                    {missingCreators.length > 0 ? (
                      <>
                        <p className="text-xs text-error font-semibold mb-3">
                          Peringatan: Kreator ini belum terdaftar di Creator Pool. Jika Anda tambahkan ke campaign, Anda WAJIB melengkapinya nanti.
                        </p>
                        <div className="max-h-40 overflow-y-auto border rounded mb-3 border-error/20 bg-white">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-error/10 sticky top-0">
                              <tr>
                                <th className="p-2 border-b border-error/20">Username</th>
                                <th className="p-2 border-b border-error/20">Rate Card</th>
                                <th className="p-2 border-b border-error/20">Qty VT</th>
                              </tr>
                            </thead>
                            <tbody>
                              {missingCreators.map(c => (
                                <tr key={c.id} className="border-b border-error/10">
                                  <td className="p-2">@{c.username}</td>
                                  <td className="p-2">Rp {Number(c.price).toLocaleString('id-ID')}</td>
                                  <td className="p-2">{c.qtyVt}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex flex-col gap-2 mt-4 bg-slate-50 p-4 rounded-b-xl border-t border-slate-200">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleSubmitToCampaign('missing')}
                              disabled={isAddingBulk}
                              className="btn bg-error hover:bg-error-dark text-white flex-1"
                            >
                              {isAddingBulk ? 'Memproses...' : 'Import ke Campaign (Tanpa Snapshot)'}
                            </button>
                            <button 
                              onClick={() => {
                                const usernames = missingCreators.map(c => c.username.replace('@', '')).join(',');
                                window.open(`/creator-pool/import?usernames=${usernames}`, '_blank');
                              }}
                              className="btn border border-error text-error hover:bg-error/10 flex-1"
                            >
                              Lengkapi Data di Creator Pool
                            </button>
                          </div>
                          <button 
                            type="button"
                            onClick={handleRescanMissing}
                            disabled={isAddingBulk}
                            className="btn bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 w-full mt-2"
                          >
                            {isAddingBulk ? 'Mengecek...' : 'Cek Ulang (Jika sudah dilengkapi di tab sebelah)'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-text-soft">Tidak ada kreator di kategori ini.</p>
                    )}
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <button type="button" className="btn btn-outline" onClick={() => setModalStep(1)}>
                      Kembali Input
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => {
                      setIsAddModalOpen(false);
                      setModalStep(1);
                      setDynamicRows([{ id: Math.random().toString(36).substring(2, 9), username: '', price: '0', qtyVt: '1', qtyLive: '0', contentType: 'Video' }]);
                    }}>
                      Tutup Modal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Auto-Save Toast Banner */}
      {(pendingChanges.size > 0 || isBatchSaving) && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-none animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-slate-900/90 backdrop-blur-sm text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700/50">
            {isBatchSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                <span className="text-sm font-medium tracking-wide">Menyimpan ke database... {batchSaveProgress}%</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span className="text-sm font-medium tracking-wide text-amber-100">Menunggu {pendingChanges.size} perubahan (Autosave dalam 2d)...</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="tbl-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-10 text-center">
                {hasAccess && (
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-p300 focus:ring-p300 cursor-pointer w-4 h-4"
                    checked={displayData.length > 0 && selectedCreators.size === displayData.length}
                    onChange={toggleSelectAll}
                  />
                )}
              </th>
              <th className="w-10"></th>
              <th className="w-12 text-center text-text-soft">No.</th>
              <th>
                <button onClick={() => toggleSort('username')} className="flex items-center text-left font-semibold hover:text-p300 transition-colors">
                  Creator <SortIcon col="username" />
                </button>
              </th>
              <th className="text-right">
                <button onClick={() => toggleSort('followers')} className="flex items-center justify-end font-semibold hover:text-p300 transition-colors w-full">
                  Followers <SortIcon col="followers" />
                </button>
              </th>
              <th className="text-right">
                <button onClick={() => toggleSort('tier')} className="flex items-center justify-end font-semibold hover:text-p300 transition-colors w-full">
                  Tier <SortIcon col="tier" />
                </button>
              </th>
              <th className="text-center">
                <button onClick={() => toggleSort('level')} className="flex items-center justify-center font-semibold hover:text-p300 transition-colors w-full">
                  Level <SortIcon col="level" />
                </button>
              </th>
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
              <th>
                <button onClick={() => toggleSort('qty_live')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Qty Live SOW <SortIcon col="qty_live" />
                </button>
              </th>
              <th>
                <button onClick={() => toggleSort('content_type')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Tipe Konten <SortIcon col="content_type" />
                </button>
              </th>
              <th>Produk</th>
              <th>
                <button onClick={() => toggleSort('approval')} className="flex items-center font-semibold hover:text-p300 transition-colors">
                  Approval <SortIcon col="approval" />
                </button>
              </th>
              {isClientApprovalRequired && <th>Client Status</th>}
              <th className="text-right">
                <button onClick={() => toggleSort('gmv')} className="flex items-center justify-end font-semibold hover:text-p300 transition-colors w-full">
                  GMV Creator <SortIcon col="gmv" />
                </button>
              </th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              return displayData.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={isClientApprovalRequired ? 13 : 12} className="text-center py-[32px] text-text-soft">
                  Belum ada creator di campaign ini.
                </td>
              </tr>
            ) : (
              displayData.map((cc: any, index) => {
                const creator = cc.creators;
                if (!creator) return null;
                const hasPending = pendingChanges.has(cc.id);
                const snapshot = cc._cachedSnapshot;
                const type = getCreatorType(snapshot?.audience_age || null);
                const gmvCreator = snapshot?.gmv_30d || 0;
                const isExpanded = expandedRows[cc.id];
                const isEditing = editingId === cc.id;
                const creatorVideos = cc.videos || [];

                return (
                  <CreatorRow 
                    key={cc.id}
                    cc={cc}
                    index={index}
                    creator={creator}
                    snapshot={snapshot}
                    hasPending={hasPending}
                    pendingChange={pendingChanges.get(cc.id)}
                    isExpanded={isExpanded}
                    activeEditingField={editingCellId?.startsWith(`${cc.id}-`) ? editingCellId.split('-')[1] : null}
                    creatorVideos={creatorVideos}
                    hasAccess={hasAccess}
                    isSelected={selectedCreators.has(cc.id)}
                    toggleSelectCreator={toggleSelectCreator}
                    toggleExpand={toggleExpand}
                    setEditingCellId={setEditingCellId}
                    setCellChange={setCellChange}
                    getPendingValue={getPendingValue}
                    campaignSkus={campaignSkus}
                    setNicheEditCreatorId={setNicheEditCreatorId}
                    setNicheEditForm={setNicheEditForm}
                    setNicheModalOpen={setNicheModalOpen}
                    staffProfiles={staffProfiles}
                    isClientApprovalRequired={isClientApprovalRequired}
                    profile={profile}
                    isBatchSaving={isBatchSaving}
                    handleDeleteCreator={handleDeleteCreator}
                    updateCampaignCreator={updateCampaignCreator}
                    fetchListing={fetchListing}
                    page={page}
                  />
                );
              })
            );
            })()}
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

      {isDuplicateModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Duplicate Manager
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Ditemukan {duplicateGroups.length} kreator dengan data ganda. Silakan pilih data mana yang ingin dihapus. Data video pada baris yang dihapus akan otomatis dipindahkan ke baris yang dipertahankan.
                </p>
              </div>
              <button onClick={() => setIsDuplicateModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {duplicateGroups.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h4 className="text-lg font-bold text-slate-800">Semua Bersih!</h4>
                  <p className="text-slate-500">Tidak ada data ganda yang terdeteksi.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {duplicateGroups.map((group, gIdx) => (
                    <div key={gIdx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                          {gIdx + 1}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">@{group[0]?.creators?.username}</h4>
                          <span className="text-xs text-slate-500">Terdapat {group.length} baris data</span>
                        </div>
                      </div>
                      <div className="p-4 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                            <tr>
                              <th className="px-4 py-2 rounded-tl-lg">ID</th>
                              <th className="px-4 py-2">Status</th>
                              <th className="px-4 py-2">Harga</th>
                              <th className="px-4 py-2">Progres Sampel</th>
                              <th className="px-4 py-2">Status Bayar</th>
                              <th className="px-4 py-2">Video (Qty)</th>
                              <th className="px-4 py-2 rounded-tr-lg">Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.map((row: any, rIdx: number) => (
                              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${row.approval === 'approved' ? 'bg-green-100 text-green-700' : row.approval === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>
                                    {row.approval}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium">Rp {row.price?.toLocaleString('id-ID') || 0}</td>
                                <td className="px-4 py-3 text-slate-600">{row.sample_progress || '-'}</td>
                                <td className="px-4 py-3 text-slate-600">{row.status_bayar || 'belum'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-blue-600">{row.videos?.length || 0}</span>
                                    <span className="text-slate-400 text-xs">/ {row.qty_vt || 0}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <button 
                                    className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border-0 transition-colors"
                                    onClick={async () => {
                                      if (confirm(`Yakin ingin MENGHAPUS baris ID ${row.id} ini? \n\n(Jika ada video di baris ini, akan dipindahkan ke baris lain)`)) {
                                        const keepRow = group.find((r: any) => r.id !== row.id);
                                        try {
                                          if (row.videos && row.videos.length > 0 && keepRow) {
                                            for (const v of row.videos) {
                                              await supabase.from('videos').update({ campaign_creator_id: keepRow.id }).eq('id', v.id);
                                            }
                                          }
                                          await supabase.from('campaign_creators').delete().eq('id', row.id);
                                          
                                          setDuplicateGroups(prev => {
                                            const next = [...prev];
                                            next[gIdx] = next[gIdx].filter((r: any) => r.id !== row.id);
                                            if (next[gIdx].length <= 1) next.splice(gIdx, 1);
                                            return next;
                                          });
                                          fetchListing(0, true);
                                          fetchCounts();
                                        } catch (e) {
                                          alert("Gagal menghapus data dobel.");
                                        }
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" /> Hapus
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal Edit Niche */}
      <Dialog open={nicheModalOpen} onOpenChange={setNicheModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Niche Kreator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-500">
              Perubahan niche ini akan mengubah profil kreator secara global di semua campaign.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 border rounded-lg bg-slate-50">
              {niches.map(niche => (
                <label key={niche.id} className="flex items-center gap-2 text-sm p-2 border rounded cursor-pointer hover:bg-white transition-colors bg-transparent">
                  <input 
                    type="checkbox" 
                    checked={nicheEditForm.includes(niche.id)}
                    onChange={(e) => {
                      if(e.target.checked) setNicheEditForm([...nicheEditForm, niche.id]);
                      else setNicheEditForm(nicheEditForm.filter(id => id !== niche.id));
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  {niche.nama}
                </label>
              ))}
            </div>
            <button 
              className="btn btn-primary w-full" 
              onClick={handleSaveNiche}
              disabled={isSavingNiche}
            >
              {isSavingNiche ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Simpan Niche Global'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Bulk Action Toolbar */}
      {hasAccess && selectedCreators.size > 0 && (
        <div className="fixed bottom-[24px] left-1/2 -translate-x-1/2 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200 p-2 pr-4 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-p300 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-inner">
            {selectedCreators.size}
          </div>
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Creator Terpilih</span>
          <div className="w-[1px] h-[24px] bg-slate-200 mx-2"></div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleBulkApproval('approved')}
              disabled={bulkActionProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-green-50 text-green-700 hover:bg-green-100 transition-colors flex items-center gap-1"
            >
              {bulkActionProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set Approved'}
            </button>
            <button 
              onClick={() => handleBulkApproval('alternate')}
              disabled={bulkActionProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-1"
            >
              {bulkActionProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set Alternate'}
            </button>
            <button 
              onClick={() => handleBulkApproval('not_approved')}
              disabled={bulkActionProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-red-50 text-red-700 hover:bg-red-100 transition-colors flex items-center gap-1"
            >
              {bulkActionProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set Not Approved'}
            </button>
            <button 
              onClick={() => handleBulkApproval('pending')}
              disabled={bulkActionProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors flex items-center gap-1"
            >
              {bulkActionProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Set Pending'}
            </button>
            <div className="w-[1px] h-[24px] bg-slate-200 mx-1"></div>
            <button 
              onClick={handleBulkDelete}
              disabled={bulkActionProcessing}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-1"
            >
              {bulkActionProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trash2 className="w-3 h-3" /> Hapus</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
