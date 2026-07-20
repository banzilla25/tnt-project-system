"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Save, Plus, AlertCircle, CheckCircle2, Wand2 } from "lucide-react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useAuth } from "@/providers/AuthProvider";

type SpreadsheetRow = {
  id: string;
  username: string;
  followers: string;
  gmv_30_days: string;
  rate_card: string;
  qty_vt: string;
  qty_live: string;
  content_type: string;
  
  status?: 'baru' | 'update' | 'error' | 'duplicate_campaign' | 'incomplete';
  errorMsg?: string;
  creatorId?: number;
  existingData?: any; 
  action?: 'update' | 'skip'; 
};

type DragFillState = {
  active: boolean;
  startRowIdx: number;
  currentRowIdx: number;
  colName: keyof SpreadsheetRow;
  value: string;
};

const getEmptyRow = (): SpreadsheetRow => ({
  id: Math.random().toString(36).substring(2, 9),
  username: '',
  followers: '',
  gmv_30_days: '',
  rate_card: '0',
  qty_vt: '1',
  qty_live: '0',
  content_type: 'Video',
});

const determineContentType = (vt: number, live: number) => {
  if (vt > 0 && live > 0) return 'Video & Live';
  if (vt > 0 && live === 0) return 'Video';
  if (vt === 0 && live > 0) return 'Live';
  return '';
};

export default function SpreadsheetImportCreatorClient() {
  const router = useRouter();
  const { id } = useParams();
  const campaignId = Number(id);
  const supabase = createClient();
  const { campaigns } = useDatabaseStore();
  const { profile, canEditCampaign } = useAuth();
  
  const campaign = campaigns.find(c => c.id === campaignId);
  const isClientApprovalRequired = campaign?.require_client_approval || false;
  const hasAccess = canEditCampaign(campaignId);
  
  const [rows, setRows] = useState<SpreadsheetRow[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`tnt_import_creator_${campaignId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
    }
    return Array(5).fill(null).map(getEmptyRow);
  });
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [dragFill, setDragFill] = useState<DragFillState | null>(null);

  // Popup state
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [duplicateRows, setDuplicateRows] = useState<SpreadsheetRow[]>([]);
  const [incompleteRows, setIncompleteRows] = useState<SpreadsheetRow[]>([]);

  useEffect(() => {
    localStorage.setItem(`tnt_import_creator_${campaignId}`, JSON.stringify(rows));
  }, [rows, campaignId]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragFill) {
        setDragFill(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragFill]);

  const handleDragFillStart = (idx: number, colName: keyof SpreadsheetRow, value: string) => {
    setDragFill({ active: true, startRowIdx: idx, currentRowIdx: idx, colName, value });
  };

  const handleDragFillEnter = (idx: number) => {
    if (dragFill && dragFill.active) {
      setDragFill({ ...dragFill, currentRowIdx: idx });
      
      setRows(prev => {
        const newRows = [...prev];
        const min = Math.min(dragFill.startRowIdx, idx);
        const max = Math.max(dragFill.startRowIdx, idx);
        
        for (let i = min; i <= max; i++) {
          let val = dragFill.value;
          (newRows[i] as any)[dragFill.colName] = val;
          
          if (dragFill.colName === 'qty_vt' || dragFill.colName === 'qty_live') {
            const vt = Number(newRows[i].qty_vt) || 0;
            const live = Number(newRows[i].qty_live) || 0;
            newRows[i].content_type = determineContentType(vt, live);
          }
        }
        return newRows;
      });
    }
  };

  const handlePaste = (e: React.ClipboardEvent, startRowIdx: number, startColName: keyof SpreadsheetRow) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    if (pasteData.includes('\t') || pasteData.includes('\n')) {
      e.preventDefault();
      
      const parsedRows: string[][] = [];
      let currentRow: string[] = [];
      let currentCell = '';
      let inQuotes = false;
      
      for (let i = 0; i < pasteData.length; i++) {
        const char = pasteData[i];
        const nextChar = pasteData[i+1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            currentCell += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === '\t' && !inQuotes) {
          currentRow.push(currentCell.trim());
          currentCell = '';
        } else if (char === '\n' && !inQuotes) {
          currentRow.push(currentCell.trim());
          if (currentRow.some(c => c !== '')) {
            parsedRows.push(currentRow);
          }
          currentRow = [];
          currentCell = '';
        } else if (char === '\r' && !inQuotes) {
          // ignore \r
        } else {
          currentCell += char;
        }
      }
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) {
          parsedRows.push(currentRow);
        }
      }

      const columns: (keyof SpreadsheetRow)[] = ['username', 'followers', 'gmv_30_days', 'rate_card', 'qty_vt', 'qty_live'];
      const startColIdx = columns.indexOf(startColName);
      if (startColIdx === -1) return;

      const newRows = [...rows];
      
      // Ensure enough rows
      const requiredRows = startRowIdx + parsedRows.length;
      if (requiredRows > newRows.length) {
        const rowsToAdd = requiredRows - newRows.length;
        for (let i = 0; i < rowsToAdd; i++) {
          newRows.push(getEmptyRow());
        }
      }

      for (let i = 0; i < parsedRows.length; i++) {
        const targetRowIndex = startRowIdx + i;
        const pasteRow = parsedRows[i];
        
        for (let j = 0; j < pasteRow.length; j++) {
          const targetColIdx = startColIdx + j;
          if (targetColIdx < columns.length) {
            const targetColName = columns[targetColIdx];
            let cleanedVal = pasteRow[j];
            
            if (targetColName === 'username') {
              cleanedVal = cleanedVal.replace(/^@/, '').toLowerCase();
            } else if (['followers', 'gmv_30_days', 'rate_card', 'qty_vt', 'qty_live'].includes(targetColName)) {
              cleanedVal = cleanedVal.replace(/\D/g, '');
              if (!cleanedVal && ['qty_vt', 'qty_live', 'rate_card'].includes(targetColName)) cleanedVal = '0';
            }
            
            (newRows[targetRowIndex] as any)[targetColName] = cleanedVal;
          }
        }
        
        // Recompute content type
        const vt = Number(newRows[targetRowIndex].qty_vt) || 0;
        const live = Number(newRows[targetRowIndex].qty_live) || 0;
        newRows[targetRowIndex].content_type = determineContentType(vt, live);
        
        newRows[targetRowIndex].status = undefined;
        newRows[targetRowIndex].errorMsg = undefined;
      }
      
      setRows(newRows);
    }
  };

  const updateCell = (idx: number, field: keyof SpreadsheetRow, value: string) => {
    const newRows = [...rows];
    let cleaned = value;
    
    if (field === 'username') cleaned = cleaned.replace(/^@/, '').toLowerCase();
    else if (['followers', 'gmv_30_days', 'rate_card', 'qty_vt', 'qty_live'].includes(field)) {
      cleaned = cleaned.replace(/\D/g, '');
    }
    
    newRows[idx] = { ...newRows[idx], [field]: cleaned, status: undefined, errorMsg: undefined };
    
    if (field === 'qty_vt' || field === 'qty_live') {
      const vt = Number(newRows[idx].qty_vt) || 0;
      const live = Number(newRows[idx].qty_live) || 0;
      newRows[idx].content_type = determineContentType(vt, live);
    }
    
    setRows(newRows);
  };

  const handleAutofillRatecard = async () => {
    const validRows = rows.filter(r => r.username.trim() !== '' && (!r.rate_card || r.rate_card === '0'));
    if (validRows.length === 0) {
      alert("Semua kreator sudah memiliki Rate Card > 0, atau tidak ada Username yang diisi.");
      return;
    }
    
    setIsAutoDetecting(true);
    try {
      const usernames = validRows.map(r => r.username.trim());
      const { data: matchedCreators } = await supabase.from('creators')
        .select('username, creator_snapshots(ratecard, id)')
        .in('username', usernames);
        
      if (matchedCreators && matchedCreators.length > 0) {
        setRows(currentRows => {
          const newRows = [...currentRows];
          let updatedCount = 0;
          
          for (let i = 0; i < newRows.length; i++) {
            const row = newRows[i];
            const uname = row.username.trim();
            if (!uname || (row.rate_card && row.rate_card !== '0')) continue;
            
            const matched = matchedCreators.find((c: any) => c.username.toLowerCase() === uname);
            if (!matched) continue;
            
            const snaps = (matched.creator_snapshots || []).sort((a: any, b: any) => b.id - a.id);
            const mergedRatecard = snaps.reduce((acc: any, curr: any) => acc ?? curr.ratecard, null);
            
            if (mergedRatecard !== null && mergedRatecard > 0) {
               newRows[i].rate_card = mergedRatecard.toString();
               updatedCount++;
            }
          }
          if (updatedCount > 0) alert(`Berhasil autofill ratecard untuk ${updatedCount} kreator.`);
          else alert("Tidak ada data ratecard terbaru yang ditemukan untuk di-autofill.");
          return newRows;
        });
      } else {
        alert("Tidak ada data ratecard terbaru yang ditemukan untuk di-autofill.");
      }
    } catch (e) {
      console.error(e);
      alert("Gagal melakukan autofill ratecard.");
    }
    setIsAutoDetecting(false);
  };

  const clearAll = () => {
    if (confirm("Kosongkan semua data?")) {
      setRows(Array(5).fill(null).map(getEmptyRow));
      localStorage.removeItem(`tnt_import_creator_${campaignId}`);
    }
  };

  const getDragHighlightClass = (rowIdx: number, colName: keyof SpreadsheetRow) => {
    if (!dragFill?.active || dragFill.colName !== colName) return '';
    const min = Math.min(dragFill.startRowIdx, dragFill.currentRowIdx);
    const max = Math.max(dragFill.startRowIdx, dragFill.currentRowIdx);
    if (rowIdx >= min && rowIdx <= max) return 'bg-blue-100 ring-1 ring-blue-400';
    return '';
  };

  const verifyData = async () => {
    setIsVerifying(true);
    
    const validated = [...rows];
    const toCheckUsernames = validated.filter(r => r.username.trim()).map(r => r.username.trim());
    
    // Fetch central creators DB for snapshot data
    const { data: existingData } = await supabase.from('creators')
      .select('id, username, creator_snapshots(id, ratecard, followers, gmv_30_days)')
      .in('username', toCheckUsernames);
      
    // Fetch existing campaign_creators for dup check
    const { data: campaignCreatorsData } = await supabase.from('campaign_creators')
      .select('creator_id, price, qty_vt, qty_live, creators(username)')
      .eq('campaign_id', campaignId);
      
    const campaignMap = new Map((campaignCreatorsData || []).map(cc => [cc.creators?.username?.toLowerCase(), cc]));
    const existingMap = new Map((existingData || []).map(c => [c.username.toLowerCase(), c]));

    let hasDuplicates = false;
    let hasIncompletes = false;

    for (let i = 0; i < validated.length; i++) {
      const row = validated[i];
      if (!row.username.trim()) continue;
      
      const vt = Number(row.qty_vt) || 0;
      const live = Number(row.qty_live) || 0;
      
      if (vt === 0 && live === 0) {
        row.status = 'error';
        row.errorMsg = 'Minimal salah satu (Qty VT / Qty Live) harus > 0';
        continue;
      }
      
      const uname = row.username.trim();
      const dbCreator = existingMap.get(uname);
      const campaignCreator = campaignMap.get(uname);
      
      let currentFollowers = row.followers;
      let currentGmv = row.gmv_30_days;

      if (dbCreator) {
        row.creatorId = dbCreator.id;
        const snaps = (dbCreator.creator_snapshots || []).sort((a: any, b: any) => b.id - a.id);
        const lastSnap = snaps[0] || {};
        
        if (!row.followers && lastSnap.followers) currentFollowers = lastSnap.followers.toString();
        if (!row.gmv_30_days && lastSnap.gmv_30_days) currentGmv = lastSnap.gmv_30_days.toString();
        
        row.followers = currentFollowers;
        row.gmv_30_days = currentGmv;
      }

      if (campaignCreator) {
        row.status = 'duplicate_campaign';
        row.existingData = campaignCreator;
        row.action = 'skip';
        hasDuplicates = true;
      } else {
        if (!currentFollowers || !currentGmv) {
          row.status = 'incomplete';
          hasIncompletes = true;
        } else {
          row.status = 'baru';
        }
      }
    }
    
    setRows(validated);
    setIsVerifying(false);

    if (hasDuplicates || hasIncompletes) {
      setDuplicateRows(validated.filter(r => r.status === 'duplicate_campaign'));
      setIncompleteRows(validated.filter(r => r.status === 'incomplete'));
      setShowConfirmPopup(true);
      return false;
    } else {
      return true;
    }
  };

  const handleSimpan = async () => {
    const isReady = await verifyData();
    if (isReady) {
      executeSaveToDatabase();
    }
  };

  const handleUpdateIncomplete = (idx: number, field: 'followers' | 'gmv_30_days', val: string) => {
    const cleaned = val.replace(/\D/g, '');
    const newInc = [...incompleteRows];
    newInc[idx][field] = cleaned;
    
    if (newInc[idx].followers && newInc[idx].gmv_30_days) {
      newInc[idx].status = 'baru';
    } else {
      newInc[idx].status = 'incomplete';
    }
    
    setIncompleteRows(newInc);
    
    // Also sync back to main rows
    const rowId = newInc[idx].id;
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: cleaned, status: newInc[idx].status } : r));
  };

  const handleUpdateAction = (id: string, action: 'update' | 'skip') => {
    setDuplicateRows(prev => prev.map(r => r.id === id ? { ...r, action } : r));
    setRows(prev => prev.map(r => r.id === id ? { ...r, action } : r));
  };

  const handleUpdateAllAction = (action: 'update' | 'skip') => {
    setDuplicateRows(prev => prev.map(r => ({ ...r, action })));
    setRows(prev => prev.map(r => r.status === 'duplicate_campaign' ? { ...r, action } : r));
  };

  const executeSaveToDatabase = async () => {
    setShowConfirmPopup(false);
    const dataToSave = rows.filter(r => r.username.trim() && r.status !== 'error' && r.status !== 'incomplete');
    
    if (dataToSave.length === 0) {
      alert("Tidak ada data valid yang bisa disimpan.");
      return;
    }

    setIsImporting(true);
    setSaveProgress({ current: 0, total: dataToSave.length });

    const BATCH_SIZE = 25;
    let successCount = 0;
    let hasErrors = false;
    
    for (let i = 0; i < dataToSave.length; i += BATCH_SIZE) {
      const batch = dataToSave.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (row) => {
        try {
          let cid = row.creatorId;
          
          // 1. Create creator if doesn't exist
          if (!cid) {
            const { data: newCreator, error: insErr } = await supabase.from('creators').insert({
              username: row.username,
              link_account: `https://www.tiktok.com/@${row.username}`,
              added_by: profile?.id
            }).select('id').single();
            if (insErr) throw insErr;
            cid = newCreator.id;
          }
          
          // 3. Campaign Creators Insert/Update
          if (row.status === 'duplicate_campaign' && row.action === 'skip') {
            // Skip everything for this row
            setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'berhasil' } : r));
            return;
          }
          
          // 2. Upsert snapshot (only if we are actually adding/updating this row)
          const { data: existingSnaps } = await supabase.from('creator_snapshots')
            .select('id, followers, gmv_30_days, ratecard')
            .eq('creator_id', cid)
            .order('id', { ascending: false })
            .limit(1);
            
          const lastSnap = existingSnaps?.[0];
          const newFollowers = Number(row.followers) || 0;
          const newGmv = Number(row.gmv_30_days) || 0;
          const newRateCard = Number(row.rate_card) || 0;
          
          if (!lastSnap || lastSnap.followers !== newFollowers || lastSnap.gmv_30_days !== newGmv || lastSnap.ratecard !== newRateCard) {
            await supabase.from('creator_snapshots').insert({
              creator_id: cid,
              followers: newFollowers,
              gmv_30_days: newGmv,
              ratecard: newRateCard,
              likes: lastSnap?.likes || 0,
              avg_views: lastSnap?.avg_views || 0,
              engagement_rate: lastSnap?.engagement_rate || 0,
            });
          }

          if (row.status === 'duplicate_campaign' && row.action === 'update' && row.existingData) {
            // Update
            await supabase.from('campaign_creators').update({
              price: newRateCard,
              qty_vt: Number(row.qty_vt) || 0,
              qty_live: Number(row.qty_live) || 0,
              content_type: row.content_type
            }).eq('campaign_id', campaignId).eq('creator_id', cid);
            successCount++;
          } else {
            // Insert new
            await supabase.from('campaign_creators').insert({
              campaign_id: campaignId,
              creator_id: cid,
              tier: 'NANO',
              price: newRateCard,
              qty_vt: Number(row.qty_vt) || 0,
              qty_live: Number(row.qty_live) || 0,
              content_type: row.content_type,
              approval: 'pending',
              pic_assist: profile?.nama || '-',
              status_bayar: 'belum',
              client_approval: isClientApprovalRequired ? 'pending' : 'not_required',
              added_by: profile?.id
            });
            successCount++;
          }
          
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'berhasil' } : r));
        } catch (err: any) {
          console.error(err);
          hasErrors = true;
          setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', errorMsg: err.message } : r));
        }
      }));
      
      setSaveProgress(prev => ({ ...prev, current: Math.min(prev.current + BATCH_SIZE, prev.total) }));
    }

    setIsImporting(false);
    setSaveProgress({ current: 0, total: 0 });
    alert(`Import selesai!\nBerhasil memproses ${successCount} kreator.`);
  };

  const TableHeader = ({ title, width }: { title: string, width?: string }) => (
    <th className={`px-2 py-2 text-left font-semibold text-slate-600 border-b border-r border-slate-300 bg-slate-100 whitespace-nowrap text-xs shadow-sm sticky top-0 z-10 ${width || 'w-48'}`}>
      {title}
    </th>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      <div className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Import Kreator Massal</h1>
            <p className="text-xs text-slate-500">Paste data dari Excel ke tabel di bawah ini.</p>
            <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Peringatan: Kolom <b>Followers</b> dan <b>GMV 30 Days</b> wajib diisi. <b>Tipe Konten</b> akan terisi otomatis.</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleAutofillRatecard} disabled={isAutoDetecting} className="text-blue-600 border-blue-200 hover:bg-blue-50">
            <Wand2 className="w-4 h-4 mr-2" /> Autofill Ratecard
          </Button>
          <Button variant="outline" onClick={clearAll} className="text-slate-600 bg-white shadow-sm hover:bg-slate-50">
            Bersihkan
          </Button>
          <Button onClick={verifyData} disabled={isVerifying || isAutoDetecting} className="bg-slate-800 hover:bg-slate-900 text-white shadow-sm min-w-[120px]">
            {isVerifying ? 'Memeriksa...' : 'Cek Data'}
          </Button>
          <Button onClick={handleSimpan} disabled={isImporting} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm min-w-[140px]">
            {isImporting ? `Menyimpan ${saveProgress.current}/${saveProgress.total}...` : (
              <><Save className="w-4 h-4 mr-2" /> Simpan Ke Database</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
        <Card className="shadow-xl bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="w-12 px-2 py-2 bg-slate-100 border-b border-r border-slate-300 sticky top-0 z-10 text-center text-xs font-semibold text-slate-500">No</th>
                  <TableHeader title="Username *" width="w-48" />
                  <TableHeader title="Followers *" width="w-32" />
                  <TableHeader title="GMV 30 Days *" width="w-40" />
                  <TableHeader title="Rate Card (Rp)" width="w-40" />
                  <TableHeader title="Qty VT" width="w-24" />
                  <TableHeader title="Qty Live" width="w-24" />
                  <TableHeader title="Tipe Konten" width="w-32" />
                  <TableHeader title="Keterangan" width="w-64" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const hasError = row.status === 'error' || row.status === 'incomplete';
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50">
                      <td className="px-2 py-1 border-b border-r border-slate-300 text-center text-xs text-slate-400 font-mono bg-slate-50">
                        {idx + 1}
                      </td>
                      
                      {/* USERNAME */}
                      <td className="relative p-0 border-b border-r border-slate-300 group" onMouseEnter={() => handleDragFillEnter(idx)}>
                        <input type="text" value={row.username} onChange={(e) => updateCell(idx, 'username', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'username')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors ${hasError ? 'bg-red-50 text-red-700' : 'focus:bg-blue-50'} w-48`} />
                      </td>
                      
                      {/* FOLLOWERS */}
                      <td className="relative p-0 border-b border-r border-slate-300 group" onMouseEnter={() => handleDragFillEnter(idx)}>
                        <input type="text" value={row.followers} onChange={(e) => updateCell(idx, 'followers', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'followers')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors ${!row.followers && row.status === 'incomplete' ? 'bg-amber-50 text-amber-700' : 'focus:bg-blue-50'} w-32`} />
                        <div className="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10" onMouseDown={(e) => { e.preventDefault(); handleDragFillStart(idx, 'followers', row.followers); }} />
                      </td>
                      
                      {/* GMV */}
                      <td className="relative p-0 border-b border-r border-slate-300 group" onMouseEnter={() => handleDragFillEnter(idx)}>
                        <input type="text" value={row.gmv_30_days} onChange={(e) => updateCell(idx, 'gmv_30_days', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'gmv_30_days')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors ${!row.gmv_30_days && row.status === 'incomplete' ? 'bg-amber-50 text-amber-700' : 'focus:bg-blue-50'} w-40`} />
                        <div className="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10" onMouseDown={(e) => { e.preventDefault(); handleDragFillStart(idx, 'gmv_30_days', row.gmv_30_days); }} />
                      </td>
                      
                      {/* RATE CARD */}
                      <td className="relative p-0 border-b border-r border-slate-300 group" onMouseEnter={() => handleDragFillEnter(idx)}>
                        <input type="text" value={row.rate_card} onChange={(e) => updateCell(idx, 'rate_card', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'rate_card')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-40`} />
                        <div className="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10" onMouseDown={(e) => { e.preventDefault(); handleDragFillStart(idx, 'rate_card', row.rate_card); }} />
                      </td>
                      
                      {/* QTY VT */}
                      <td className="relative p-0 border-b border-r border-slate-300 group" onMouseEnter={() => handleDragFillEnter(idx)}>
                        <input type="text" value={row.qty_vt} onChange={(e) => updateCell(idx, 'qty_vt', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'qty_vt')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-24`} />
                        <div className="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10" onMouseDown={(e) => { e.preventDefault(); handleDragFillStart(idx, 'qty_vt', row.qty_vt); }} />
                      </td>
                      
                      {/* QTY LIVE */}
                      <td className="relative p-0 border-b border-r border-slate-300 group" onMouseEnter={() => handleDragFillEnter(idx)}>
                        <input type="text" value={row.qty_live} onChange={(e) => updateCell(idx, 'qty_live', e.target.value)} onPaste={(e) => handlePaste(e, idx, 'qty_live')} className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors focus:bg-blue-50 w-24`} />
                        <div className="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10" onMouseDown={(e) => { e.preventDefault(); handleDragFillStart(idx, 'qty_live', row.qty_live); }} />
                      </td>
                      
                      {/* TIPE KONTEN */}
                      <td className="p-0 border-b border-r border-slate-300 bg-slate-50">
                        <div className="w-full h-full min-h-[36px] px-3 py-1 text-sm flex items-center font-medium text-slate-700 w-32">
                          {row.content_type}
                        </div>
                      </td>
                      
                      {/* KETERANGAN */}
                      <td className="p-2 border-b border-r border-slate-300 align-top w-64 text-xs">
                        {row.status === 'error' && (
                          <div className="text-red-600 flex items-center gap-1 font-medium bg-red-50 p-1.5 rounded"><AlertCircle className="w-3.5 h-3.5" /> {row.errorMsg}</div>
                        )}
                        {row.status === 'incomplete' && (
                          <div className="text-amber-600 flex items-center gap-1 font-medium bg-amber-50 p-1.5 rounded"><AlertCircle className="w-3.5 h-3.5" /> Followers/GMV belum lengkap</div>
                        )}
                        {row.status === 'baru' && (
                          <div className="text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 p-1.5 rounded"><CheckCircle2 className="w-3.5 h-3.5" /> Siap ditambahkan</div>
                        )}
                        {row.status === 'berhasil' && (
                          <div className="text-blue-600 flex items-center gap-1 font-medium bg-blue-50 p-1.5 rounded"><CheckCircle2 className="w-3.5 h-3.5" /> Data berhasil tersimpan</div>
                        )}
                        {row.status === 'duplicate_campaign' && (
                          <div className="text-rose-600 flex flex-col gap-1.5 font-medium bg-rose-50 p-2 rounded border border-rose-100">
                            <div className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Sudah ada di listing</div>
                            <div className="flex gap-1 mt-1">
                              <button onClick={() => handleUpdateAction(row.id, 'update')} className={`flex-1 py-1 px-2 text-[10px] rounded border ${row.action === 'update' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}>Update</button>
                              <button onClick={() => handleUpdateAction(row.id, 'skip')} className={`flex-1 py-1 px-2 text-[10px] rounded border ${row.action === 'skip' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-600 border-slate-300'}`}>Lewati</button>
                            </div>
                            
                            {(row.existingData?.price?.toString() !== row.rate_card || row.existingData?.qty_vt?.toString() !== row.qty_vt || row.existingData?.qty_live?.toString() !== row.qty_live) && (
                               <div className="text-[10px] text-slate-500 mt-1 font-normal bg-white p-1.5 rounded">
                                 <div>Old Rate: <b>{row.existingData?.price || 0}</b></div>
                                 <div>Old Qty VT: <b>{row.existingData?.qty_vt || 0}</b></div>
                                 <div>Old Qty Live: <b>{row.existingData?.qty_live || 0}</b></div>
                               </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 border-t border-slate-200 p-2 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, getEmptyRow()])} className="text-slate-600 bg-white">
              <Plus className="w-4 h-4 mr-1" /> Tambah Baris
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, ...Array(5).fill(null).map(getEmptyRow)])} className="text-slate-600 bg-white">
              <Plus className="w-4 h-4 mr-1" /> Tambah 5 Baris
            </Button>
          </div>
        </Card>
      </div>

      {/* CONFIRMATION POPUP */}
      {showConfirmPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-full">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Konfirmasi Import Kreator</h2>
              <p className="text-slate-500 text-sm mt-1">Selesaikan duplikasi dan data yang belum lengkap sebelum menyimpan.</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              
              {/* SECTION 1: DUPLICATES */}
              {duplicateRows.length > 0 && (
                <div className="border border-rose-200 rounded-lg overflow-hidden">
                  <div className="bg-rose-50 px-4 py-3 border-b border-rose-200 flex justify-between items-center">
                    <h3 className="font-semibold text-rose-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Kreator Sudah Ada di Listing ({duplicateRows.length} kreator)
                    </h3>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdateAllAction('update')} className="text-xs font-medium px-3 py-1.5 bg-white border border-rose-200 text-rose-700 rounded shadow-sm hover:bg-rose-100 transition">Update Semua</button>
                      <button onClick={() => handleUpdateAllAction('skip')} className="text-xs font-medium px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded shadow-sm hover:bg-slate-100 transition">Lewati Semua</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs">
                        <tr>
                          <th className="px-4 py-3 font-medium">Username</th>
                          <th className="px-4 py-3 font-medium">Rate Card (Lama → Baru)</th>
                          <th className="px-4 py-3 font-medium">Qty VT (Lama → Baru)</th>
                          <th className="px-4 py-3 font-medium">Qty Live (Lama → Baru)</th>
                          <th className="px-4 py-3 font-medium">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {duplicateRows.map(r => {
                          const oldRate = r.existingData?.price?.toString() || '0';
                          const oldVt = r.existingData?.qty_vt?.toString() || '0';
                          const oldLive = r.existingData?.qty_live?.toString() || '0';
                          
                          const rateDiff = oldRate !== r.rate_card;
                          const vtDiff = oldVt !== r.qty_vt;
                          const liveDiff = oldLive !== r.qty_live;
                          
                          return (
                            <tr key={`dup_${r.id}`} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-700">@{r.username}</td>
                              <td className={`px-4 py-3 ${rateDiff ? 'bg-amber-50 text-amber-800' : 'text-slate-600'}`}>Rp {Number(oldRate).toLocaleString()} → <b>Rp {Number(r.rate_card).toLocaleString()}</b></td>
                              <td className={`px-4 py-3 ${vtDiff ? 'bg-amber-50 text-amber-800' : 'text-slate-600'}`}>{oldVt} → <b>{r.qty_vt}</b></td>
                              <td className={`px-4 py-3 ${liveDiff ? 'bg-amber-50 text-amber-800' : 'text-slate-600'}`}>{oldLive} → <b>{r.qty_live}</b></td>
                              <td className="px-4 py-3">
                                <div className="flex bg-slate-100 rounded p-1 w-max">
                                  <button onClick={() => handleUpdateAction(r.id, 'update')} className={`px-3 py-1 text-xs font-medium rounded ${r.action === 'update' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Update</button>
                                  <button onClick={() => handleUpdateAction(r.id, 'skip')} className={`px-3 py-1 text-xs font-medium rounded ${r.action === 'skip' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Lewati</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* SECTION 2: INCOMPLETE */}
              {incompleteRows.length > 0 && (
                <div className="border border-amber-200 rounded-lg overflow-hidden">
                  <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
                    <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Data Belum Lengkap ({incompleteRows.filter(r => r.status === 'incomplete').length} kreator)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs">
                        <tr>
                          <th className="px-4 py-3 font-medium">Username</th>
                          <th className="px-4 py-3 font-medium w-48">Followers</th>
                          <th className="px-4 py-3 font-medium w-48">GMV 30 Days</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {incompleteRows.map((r, idx) => {
                          const missF = !r.followers;
                          const missG = !r.gmv_30_days;
                          return (
                            <tr key={`inc_${r.id}`} className={r.status === 'baru' ? 'bg-emerald-50/30' : 'bg-white'}>
                              <td className="px-4 py-3 font-medium text-slate-700">@{r.username}</td>
                              <td className="px-4 py-3">
                                <input type="text" value={r.followers} onChange={e => handleUpdateIncomplete(idx, 'followers', e.target.value)} placeholder="0" className={`w-full px-3 py-1.5 text-sm border rounded ${missF ? 'border-red-300 focus:border-red-500 outline-none focus:ring-1 ring-red-500' : 'border-slate-200'}`} />
                              </td>
                              <td className="px-4 py-3">
                                <input type="text" value={r.gmv_30_days} onChange={e => handleUpdateIncomplete(idx, 'gmv_30_days', e.target.value)} placeholder="0" className={`w-full px-3 py-1.5 text-sm border rounded ${missG ? 'border-red-300 focus:border-red-500 outline-none focus:ring-1 ring-red-500' : 'border-slate-200'}`} />
                              </td>
                              <td className="px-4 py-3">
                                {r.status === 'baru' ? (
                                  <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium"><CheckCircle2 className="w-3 h-3 mr-1"/> Lengkap</span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs font-medium">Wajib diisi</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowConfirmPopup(false)} className="text-slate-600 bg-white">Batal</Button>
              <Button onClick={executeSaveToDatabase} disabled={incompleteRows.some(r => r.status === 'incomplete') || isImporting} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[200px]">
                {incompleteRows.some(r => r.status === 'incomplete') ? 'Lengkapi data di atas' : isImporting ? 'Menyimpan...' : 'Lanjutkan Import'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
