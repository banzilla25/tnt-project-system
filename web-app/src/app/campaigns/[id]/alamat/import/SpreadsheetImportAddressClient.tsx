"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { useDatabaseStore } from "@/store/useDatabaseStore";

type SpreadsheetRow = {
  id: string;
  username: string;
  whatsapp: string;
  nama_penerima: string;
  nama_jalan: string;
  provinsi: string;
  kabupaten_kota: string;
  kecamatan: string;
  kelurahan: string;
  kode_pos: string;
  
  status?: 'baru' | 'update' | 'error';
  errorMsg?: string;
  ccId?: number; // campaign_creator_id
  creatorId?: number; // creator_id
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
  whatsapp: '',
  nama_penerima: '',
  nama_jalan: '',
  provinsi: '',
  kabupaten_kota: '',
  kecamatan: '',
  kelurahan: '',
  kode_pos: '',
});

export default function SpreadsheetImportAddressClient() {
  const router = useRouter();
  const { id } = useParams();
  const campaignId = Number(id);
  const supabase = createClient();
  const { campaigns } = useDatabaseStore();
  
  const campaign = campaigns.find(c => c.id === campaignId);
  
  const [rows, setRows] = useState<SpreadsheetRow[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`tnt_import_alamat_${campaignId}`);
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
  const [isImporting, setIsImporting] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [dragFill, setDragFill] = useState<DragFillState | null>(null);

  const runBulkAutoDetect = async (usernamesToDetect: string[]) => {
    const usernames = usernamesToDetect.map(u => u.trim().toLowerCase()).filter(Boolean);
    if (usernames.length === 0 || !campaignId) return;
    
    setIsAutoDetecting(true);
    try {
      const { data: matchedCCs } = await supabase.from('campaign_creators')
        .select('id, creators!inner(id, username)')
        .eq('campaign_id', campaignId)
        .in('creators.username', usernames);
        
      if (matchedCCs && matchedCCs.length > 0) {
        setRows(currentRows => {
          const newRows = [...currentRows];
          let updated = false;
          
          for (let i = 0; i < newRows.length; i++) {
            const row = newRows[i];
            const uname = row.username.trim().toLowerCase();
            if (!uname) continue;
            
            const matched = matchedCCs.find((cc: any) => cc.creators.username.toLowerCase() === uname);
            if (!matched) {
              if (row.status !== 'error') {
                newRows[i] = { ...row, status: 'error', errorMsg: 'Kreator tidak ditemukan di campaign ini' };
                updated = true;
              }
              continue;
            }

            if (row.ccId !== matched.id) {
              newRows[i] = {
                ...row,
                ccId: matched.id,
                creatorId: matched.creators.id,
                status: 'update',
                errorMsg: undefined
              };
              updated = true;
            }
          }
          return updated ? newRows : currentRows;
        });
      } else {
        setRows(currentRows => currentRows.map(row => {
          if (row.username.trim() && !row.ccId) return { ...row, status: 'error', errorMsg: 'Kreator tidak ditemukan di campaign ini' };
          return row;
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAutoDetecting(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`tnt_import_alamat_${campaignId}`, JSON.stringify(rows.map(r => ({ ...r, status: undefined, errorMsg: undefined }))));
    }
  }, [rows, campaignId]);

  const handlePaste = (e: React.ClipboardEvent, startRowIndex: number, startColName: keyof SpreadsheetRow) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('Text');
    if (!pastedData) return;

    const rowStrings = pastedData.split(/\r\n|\n|\r/);
    const columns = ['username', 'whatsapp', 'nama_penerima', 'nama_jalan', 'provinsi', 'kabupaten_kota', 'kecamatan', 'kelurahan', 'kode_pos'];
    const startColIndex = columns.indexOf(startColName as string);
    if (startColIndex === -1) return;

    const newRows = [...rows];
    let addedCount = 0;
    const usernamesToDetect: string[] = [];

    rowStrings.forEach((rowString, i) => {
      const cellValues = rowString.split('\t');
      if (cellValues.length === 1 && !cellValues[0]) return;

      const targetRowIndex = startRowIndex + i;
      while (targetRowIndex >= newRows.length) {
        newRows.push(getEmptyRow());
      }

      cellValues.forEach((val, j) => {
        const targetColName = columns[startColIndex + j] as keyof SpreadsheetRow;
        if (targetColName) {
          let cleanedVal = val.replace(/^"|"$/g, '').trim();
          if (targetColName === 'username') cleanedVal = cleanedVal.replace(/^@/, '');
          (newRows[targetRowIndex] as any)[targetColName] = cleanedVal;
          if (targetColName === 'username' && cleanedVal) {
            usernamesToDetect.push(cleanedVal);
          }
        }
      });
      newRows[targetRowIndex].status = undefined;
      newRows[targetRowIndex].errorMsg = undefined;
      addedCount++;
    });

    setRows(newRows);
    if (usernamesToDetect.length > 0) {
      runBulkAutoDetect(usernamesToDetect);
    }
  };

  const handleDragFillStart = (rowIdx: number, colName: keyof SpreadsheetRow, value: string) => {
    setDragFill({ active: true, startRowIdx: rowIdx, currentRowIdx: rowIdx, colName, value });
  };

  const handleDragFillEnter = (rowIdx: number) => {
    if (dragFill?.active) {
      setDragFill({ ...dragFill, currentRowIdx: rowIdx });
    }
  };

  const handleDragFillEnd = () => {
    if (!dragFill?.active) return;
    const { startRowIdx, currentRowIdx, colName, value } = dragFill;
    const min = Math.min(startRowIdx, currentRowIdx);
    const max = Math.max(startRowIdx, currentRowIdx);

    const newRows = [...rows];
    let hasUsernameChanges = false;
    const usernamesToDetect: string[] = [];
    
    for (let i = min; i <= max; i++) {
      if ((newRows[i] as any)[colName] !== value) {
        (newRows[i] as any)[colName] = value;
        newRows[i].status = undefined;
        newRows[i].errorMsg = undefined;
        if (colName === 'username' && value) {
          hasUsernameChanges = true;
          usernamesToDetect.push(value);
        }
      }
    }
    setRows(newRows);
    setDragFill(null);
    if (hasUsernameChanges) runBulkAutoDetect(usernamesToDetect);
  };

  useEffect(() => {
    const handleMouseUp = () => handleDragFillEnd();
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragFill]);

  const updateCell = (idx: number, field: keyof SpreadsheetRow, value: string) => {
    const newRows = [...rows];
    let cleaned = value;
    if (field === 'username') cleaned = cleaned.replace(/^@/, '');
    
    newRows[idx] = { ...newRows[idx], [field]: cleaned, status: undefined, errorMsg: undefined };
    setRows(newRows);
  };

  const handleUsernameBlur = (idx: number) => {
    const uname = rows[idx].username;
    if (uname) runBulkAutoDetect([uname]);
  };

  const addRows = (count = 1) => {
    const newRows = Array(count).fill(null).map(getEmptyRow);
    setRows([...rows, ...newRows]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const clearAll = () => {
    if (confirm("Kosongkan semua data?")) {
      setRows(Array(5).fill(null).map(getEmptyRow));
      localStorage.removeItem(`tnt_import_alamat_${campaignId}`);
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
    const toDetect = rows.map(r => r.username).filter(Boolean);
    await runBulkAutoDetect(toDetect);
    
    // validasi manual
    const validated = [...rows];
    let hasErrors = false;
    for (let i = 0; i < validated.length; i++) {
      const row = validated[i];
      if (!row.username.trim() && !row.nama_jalan.trim()) continue;
      
      if (!row.username.trim()) {
        row.status = 'error';
        row.errorMsg = 'Username wajib diisi';
        hasErrors = true;
      } else if (!row.ccId) {
        row.status = 'error';
        row.errorMsg = 'Kreator tidak ditemukan di campaign ini';
        hasErrors = true;
      } else {
        row.status = 'baru'; // siap insert
      }
    }
    setRows(validated);
    setIsVerifying(false);
  };

  const saveToDatabase = async () => {
    const validRows = rows.filter(r => r.username.trim() && r.status !== 'error' && r.ccId);
    if (validRows.length === 0) {
      alert("Tidak ada data valid yang bisa disimpan.");
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of validRows) {
      try {
        // 1. Dapatkan creator_addresses yang existing untuk update
        const { data: existingAddr } = await supabase.from('creator_addresses')
          .select('id, resi')
          .eq('campaign_creator_id', row.ccId)
          .maybeSingle();

        const payload = {
          campaign_creator_id: row.ccId,
          nama_penerima: row.nama_penerima,
          nama_jalan: row.nama_jalan,
          provinsi: row.provinsi,
          kabupaten_kota: row.kabupaten_kota,
          kecamatan: row.kecamatan,
          kelurahan: row.kelurahan,
          kode_pos: row.kode_pos
        };

        if (existingAddr) {
          await supabase.from('creator_addresses').update(payload).eq('id', existingAddr.id);
        } else {
          await supabase.from('creator_addresses').insert(payload);
        }

        // 2. Cek histori creator_address_book jika berbeda, tambahkan
        if (row.nama_jalan && row.creatorId) {
          const { data: addressBook } = await supabase.from('creator_address_book')
            .select('id')
            .eq('creator_id', row.creatorId)
            .ilike('alamat_jalan', row.nama_jalan);
          
          if (!addressBook || addressBook.length === 0) {
            await supabase.from('creator_address_book').insert({
              creator_id: row.creatorId,
              label: `Alamat Campaign ${campaign?.nama || ''}`,
              nama_penerima: row.nama_penerima,
              alamat_jalan: row.nama_jalan,
              provinsi: row.provinsi,
              kota: row.kabupaten_kota,
              kecamatan: row.kecamatan,
              kodepos: row.kode_pos
            });
          }
        }

        // 3. Tambahkan ke creator_contacts jika whatsapp diisi dan belum ada
        if (row.whatsapp && row.creatorId) {
          // bersihkan 0 pertama atau karakter non angka
          const cleanWa = row.whatsapp.replace(/\D/g, '');
          if (cleanWa) {
            const { data: contacts } = await supabase.from('creator_contacts')
              .select('id')
              .eq('creator_id', row.creatorId)
              .like('nomor', `%${cleanWa}%`);
              
            if (!contacts || contacts.length === 0) {
              await supabase.from('creator_contacts').insert({
                creator_id: row.creatorId,
                nomor: row.whatsapp.startsWith('0') ? row.whatsapp : `0${cleanWa}`,
                status: 'aktif'
              });
            }
          }
        }
        
        // Tandai row selesai
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'baru' } : r));
        successCount++;
      } catch (err: any) {
        console.error(err);
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', errorMsg: err.message } : r));
        failCount++;
      }
    }

    setIsImporting(false);
    alert(`Import selesai!\nBerhasil: ${successCount}\nGagal: ${failCount}`);
    if (failCount === 0) {
      localStorage.removeItem(`tnt_import_alamat_${campaignId}`);
      router.back(); // kembali ke alamat
    }
  };

  const TableHeader = ({ title, width }: { title: string, width?: string }) => (
    <th className={`px-2 py-2 text-left font-semibold text-slate-600 border-b border-r border-slate-300 bg-slate-100 whitespace-nowrap text-xs shadow-sm sticky top-0 z-10 ${width || 'w-48'}`}>
      {title}
    </th>
  );

  const TableCell = ({ 
    idx, 
    field, 
    placeholder,
    width
  }: { 
    idx: number, 
    field: keyof SpreadsheetRow, 
    placeholder?: string,
    width?: string
  }) => {
    return (
      <td 
        className={`relative p-0 border-b border-r border-slate-300 group ${getDragHighlightClass(idx, field)}`}
        onMouseEnter={() => handleDragFillEnter(idx)}
      >
        <input 
          type="text"
          value={(rows[idx] as any)[field] || ''}
          onChange={(e) => updateCell(idx, field, e.target.value)}
          onPaste={(e) => handlePaste(e, idx, field)}
          onBlur={() => field === 'username' ? handleUsernameBlur(idx) : null}
          placeholder={placeholder || ''}
          className={`w-full h-full min-h-[36px] px-3 py-1 outline-none text-sm transition-colors
            ${rows[idx].status === 'error' ? 'bg-red-50 focus:bg-red-50 text-red-700' : 'focus:bg-blue-50'}
            ${width || 'w-48 min-w-[12rem]'}
          `}
        />
        <div 
          className="absolute right-0 bottom-0 w-2 h-2 bg-blue-500 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onMouseDown={(e) => {
            e.preventDefault();
            handleDragFillStart(idx, field, (rows[idx] as any)[field]);
          }}
        />
      </td>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      {/* Header Bar */}
      <div className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Import Alamat Massal</h1>
            <p className="text-xs text-slate-500">Paste data dari Excel ke tabel di bawah ini.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={clearAll} className="text-slate-600 bg-white shadow-sm hover:bg-slate-50">
            Bersihkan
          </Button>
          <Button onClick={verifyData} disabled={isVerifying || isAutoDetecting} className="bg-slate-800 hover:bg-slate-900 text-white shadow-sm min-w-[120px]">
            {isVerifying ? 'Memeriksa...' : isAutoDetecting ? 'Mendeteksi...' : 'Cek Data'}
          </Button>
          <Button onClick={saveToDatabase} disabled={isImporting} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm min-w-[140px]">
            {isImporting ? 'Menyimpan...' : (
              <><Save className="w-4 h-4 mr-2" /> Simpan Ke Database</>
            )}
          </Button>
        </div>
      </div>

      {/* Spreadsheet Area */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
        <Card className="shadow-xl bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-full">
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="w-12 px-2 py-2 bg-slate-100 border-b border-r border-slate-300 sticky top-0 z-10 text-center text-xs font-semibold text-slate-500">No</th>
                  <th className="w-10 px-2 py-2 bg-slate-100 border-b border-r border-slate-300 sticky top-0 z-10"></th>
                  <TableHeader title="Username *" width="w-48" />
                  <TableHeader title="No Whatsapp" width="w-40" />
                  <TableHeader title="Nama Penerima" width="w-48" />
                  <TableHeader title="Nama Jalan" width="w-64" />
                  <TableHeader title="Provinsi" width="w-40" />
                  <TableHeader title="Kab/Kota" width="w-40" />
                  <TableHeader title="Kecamatan" width="w-40" />
                  <TableHeader title="Kelurahan" width="w-40" />
                  <TableHeader title="Kode Pos" width="w-32" />
                  <TableHeader title="Status" width="w-48" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className={`${row.status === 'error' ? 'bg-red-50/30' : 'hover:bg-slate-50/50'} transition-colors`}>
                    <td className="border-b border-r border-slate-300 bg-slate-50 text-center text-xs text-slate-500 select-none">
                      {idx + 1}
                    </td>
                    <td className="border-b border-r border-slate-300 text-center">
                      <button 
                        onClick={() => removeRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Hapus baris"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                    <TableCell idx={idx} field="username" placeholder="@username" width="w-48" />
                    <TableCell idx={idx} field="whatsapp" placeholder="08..." width="w-40" />
                    <TableCell idx={idx} field="nama_penerima" width="w-48" />
                    <TableCell idx={idx} field="nama_jalan" width="w-64" />
                    <TableCell idx={idx} field="provinsi" width="w-40" />
                    <TableCell idx={idx} field="kabupaten_kota" width="w-40" />
                    <TableCell idx={idx} field="kecamatan" width="w-40" />
                    <TableCell idx={idx} field="kelurahan" width="w-40" />
                    <TableCell idx={idx} field="kode_pos" width="w-32" />
                    <td className={`p-3 border-b border-slate-300 text-xs w-48 truncate
                      ${row.status === 'error' ? 'text-red-600 font-medium' : ''}
                      ${row.status === 'update' ? 'text-blue-600' : ''}
                      ${row.status === 'baru' ? 'text-green-600' : ''}
                    `}>
                      {row.status === 'error' && <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {row.errorMsg}</span>}
                      {row.status === 'update' && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Siap diupdate</span>}
                      {row.status === 'baru' && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Siap ditambahkan</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="flex-none p-4 bg-white border-t border-slate-200 flex justify-between items-center shadow-sm z-20">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => addRows(1)} className="text-slate-600">
                <Plus className="w-4 h-4 mr-1" /> Tambah 1 Baris
              </Button>
              <Button variant="outline" size="sm" onClick={() => addRows(10)} className="text-slate-600">
                <Plus className="w-4 h-4 mr-1" /> Tambah 10 Baris
              </Button>
            </div>
            <div className="text-sm text-slate-500 font-medium">
              Total {rows.length} baris
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
