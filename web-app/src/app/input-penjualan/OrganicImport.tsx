"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Upload, AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, BarChart3, Users, Tags, ArrowRight, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient } from "@/utils/supabase/client";
import { useDatabaseStore } from "@/store/useDatabaseStore";

type PreviewRow = {
  campaign_id: number | null;
  creator_username: string;
  content_uid: string | null;
  product_id: string | null;
  sku_id?: number;
  tanggal: string;
  price: number;
  quantity: number;
  gmv: number;
  is_refund: boolean;
  content_type: string;
  order_id: string | null;
  order_status: string | null;
  commission_rate: string | null;
  attribution_type: string | null;
  tiktok_campaign_id: string | null;
  shop_code: string | null;
  video_views: number;
  video_likes: number;
  duration_str: string | null;
  video_product_rpm: number;
  raw_data: any;
};

type SkuInfo = { id: string; name: string };
type CreatorGMV = { username: string; gmv: number };

type PreviewStats = {
  totalRows: number;
  validRows: number;
  refunds: number;
  unmappedRows: number;
  totalGmv: number;
  uniqueCreators: number;
  mappedSkus: SkuInfo[];
  unmappedSkus: SkuInfo[];
  topCreators: CreatorGMV[];
  dateRange: string;
};

export default function OrganicImport() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [previewPage, setPreviewPage] = useState(1);
  
  const [previewPayload, setPreviewPayload] = useState<PreviewRow[]>([]);
  const [stats, setStats] = useState<PreviewStats | null>(null);
  const [result, setResult] = useState<{success: number; skipped: number; errors: string[]} | null>(null);
  const [showSkuTable, setShowSkuTable] = useState(false);
  const [showErrorLogs, setShowErrorLogs] = useState(false);
  
  // Ambil tabel SKU dari store global
  const { skus, campaigns, fetchData } = useDatabaseStore();
  const supabase = createClient();
  
  // State for inline SKU registration
  const [skuCampaignSelect, setSkuCampaignSelect] = useState<Record<string, string>>({});
  const [isRegisteringSku, setIsRegisteringSku] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const processFileLocally = () => {
    if (files.length === 0) return;
    setLoading(true);

    // Memberikan jeda 100ms agar browser sempat me-render animasi loading sebelum CPU terkunci
    setTimeout(async () => {
      let allData: any[] = [];
      try {
        for (const file of files) {
          const ext = file.name.split('.').pop()?.toLowerCase();
          
          if (ext === 'csv') {
            const data = await new Promise<any[]>((resolve, reject) => {
              Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (err) => reject(err)
              });
            });
            allData = allData.concat(data);
          } else if (ext === 'xlsx' || ext === 'xls') {
            const data = await new Promise<any[]>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
                  const workbook = XLSX.read(dataArr, { type: 'array' });
                  const firstSheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[firstSheetName];
                  const jsonData = XLSX.utils.sheet_to_json(worksheet);
                  resolve(jsonData as any[]);
                } catch (error) {
                  reject(error);
                }
              };
              reader.onerror = reject;
              reader.readAsArrayBuffer(file);
            });
            allData = allData.concat(data);
          } else {
            alert(`Format file ${file.name} tidak didukung. File ini akan dilewati.`);
          }
        }
        
        generatePreview(allData);
      } catch (error: any) {
        alert("Error membaca file: " + error.message);
        setLoading(false);
      }
    }, 100);
  };

  const handleRegisterSku = async (productId: string, productName: string) => {
    const campaignId = skuCampaignSelect[productId];
    if (!campaignId) {
      alert("Mohon pilih Campaign terlebih dahulu untuk SKU ini!");
      return;
    }
    
    setIsRegisteringSku(productId);
    try {
      const { error } = await supabase.from('skus').insert({
        product_id: productId,
        nama_produk: productName,
        campaign_id: parseInt(campaignId)
      });
      if (error) throw error;
      
      alert(`SKU ${productName} berhasil didaftarkan! Memuat ulang data...`);
      await fetchData(); // Refresh global state to get new SKU
      processFileLocally(); // Re-scan the file
    } catch (e: any) {
      alert("Gagal mendaftarkan SKU: " + e.message);
    } finally {
      setIsRegisteringSku(null);
    }
  };

  const generatePreview = (data: any[]) => {
    const isSalesFormat = data.some((row: any) => row['Order ID']);
    const isAwarenessFormat = data.some((row: any) => row['Video ID'] && row['Affiliate video GMV']);
    const isLiveFormat = data.some((row: any) => row['Livestream room ID'] && row['Affiliate LIVE GMV']);

    if (!isSalesFormat && !isAwarenessFormat && !isLiveFormat) {
      alert("Format file tidak dikenali. Pastikan ini adalah Laporan Pesanan (Sales), Laporan Video, atau Laporan Livestream dari TikTok.");
      setLoading(false);
      return;
    }

    // Buat Dictionary Mapping
    const skuMapping: Record<string, number> = {};
    const skuNameMapping: Record<string, string> = {};
    const skuIdMapping: Record<string, number> = {};
    const tiktokToCampaigns: Record<string, number[]> = {};

    skus?.forEach(s => {
      if (s.product_id) {
        skuMapping[s.product_id.toString()] = s.campaign_id;
        skuNameMapping[s.product_id.toString()] = s.nama_produk;
        skuIdMapping[s.product_id.toString()] = s.id;
      }
    });

    campaigns?.forEach(c => {
      if (c.tiktok_campaign_ids && c.tiktok_campaign_ids.length > 0) {
        c.tiktok_campaign_ids.forEach(tid => {
          if (!tiktokToCampaigns[tid]) tiktokToCampaigns[tid] = [];
          tiktokToCampaigns[tid].push(c.id);
        });
      }
    });

    let validRows = data;
    if (isAwarenessFormat) {
      validRows = data.filter((row: any) => row['Date'] !== 'Summary' && row['Video ID'] && row['Video ID'] !== '-');
    } else if (isLiveFormat) {
      validRows = data.filter((row: any) => row['Date'] !== 'Summary' && row['Livestream room ID'] && row['Livestream room ID'] !== '-');
    } else {
      validRows = data.filter((row: any) => row['Order ID']);
    }

    let refundCount = 0;
    let unmappedRowsCount = 0;
    let totalGmv = 0;
    
    const uniqueCreators = new Set<string>();
    const creatorGmvMap = new Map<string, number>();
    
    const mappedSkusMap = new Map<string, string>(); // id -> name
    const unmappedSkusMap = new Map<string, string>(); // id -> name

    const payload: PreviewRow[] = [];

    let minDate = new Date('2099-01-01').getTime();
    let maxDate = new Date('1970-01-01').getTime();

    const parseTikTokDate = (dateStr: string) => {
      if (!dateStr) return new Date().toISOString();
      try {
        if (dateStr.includes('/')) {
          const parts = dateStr.split(' ');
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
            // DD/MM/YYYY -> YYYY-MM-DD
            const isoStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${parts[1] || '00:00:00'}.000Z`;
            const d = new Date(isoStr);
            if (!isNaN(d.getTime())) return d.toISOString();
          }
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.toISOString();
        return new Date().toISOString();
      } catch (e) {
        return new Date().toISOString();
      }
    };

    for (const row of validRows) {
      let isRefund = false;
      let rawProductId = '';
      let productName = '';
      let price = 0;
      let quantity = 0;
      let gmv = 0;
      let creatorUsername = '';
      let contentUid = '';
      let tanggal = '';
      let contentType = 'Video';
      let orderId = '';
      let orderStatus = '';
      let commissionRate = '';
      let attributionType = '';
      let tiktokCampaignId = '';
      let shopCode = '';
      let videoViews = 0;
      let videoLikes = 0;
      let durationStr = '';
      let videoProductRpm = 0;

      if (isSalesFormat) {
        const isRefundStr = row['Fully returned or refunded'] || 'No';
        isRefund = isRefundStr.trim().toLowerCase() === 'yes';

        tiktokCampaignId = row['Partner campaign ID']?.toString() || '';
        shopCode = row['Shop code']?.toString() || '';

        rawProductId = row['Product ID']?.toString() || '';
        productName = row['Product Name']?.toString() || skuNameMapping[rawProductId] || 'Unknown Product';
        price = Math.round(parseFloat(row['Price'] || 0));
        quantity = parseInt(row['Quantity'] || 0);
        gmv = Math.round(price * quantity);
        const rawUsername = row['Creator Username'] || row['Creator'] || row['Kreator'] || row['Username'] || '';
        creatorUsername = rawUsername.replace('@', '').toLowerCase();
        
        const liveIdRaw = row['Live ID'] || row['Live stream ID'] || row['Livestream ID'] || '';
        if (liveIdRaw && liveIdRaw !== '-' && liveIdRaw !== '0') {
           contentUid = liveIdRaw.toString();
           contentType = 'Live';
        } else {
           contentUid = row['Content ID']?.toString() || '';
           contentType = row['Content Type'] || 'Video';
        }
        
        tanggal = parseTikTokDate(row['Time Created']?.toString() || '');
        // Super Composite Key sama persis dengan backend: Order ID + SKU ID + Creator + Product ID
        const orderIdRaw = row['Order ID']?.toString() || '';
        const skuIdStr = row['SKU ID']?.toString() || '';
        orderId = `${orderIdRaw}_${skuIdStr}_${creatorUsername}_${rawProductId}`;
        orderStatus = row['Order settlement status'] || row['Order Status'] || '';
        commissionRate = row['Standard affiliate partner commission rate']?.toString() || '';
        attributionType = row['Attribution type']?.toString() || '';
      } else if (isLiveFormat) {
        // Live Format - HANYA UPDATE AWARENESS
        rawProductId = row['Product ID']?.toString() || '';
        productName = row['Product name']?.toString() || row['Product Name']?.toString() || skuNameMapping[rawProductId] || 'Unknown Product';
        gmv = 0; 
        quantity = 0;
        price = 0;
        tiktokCampaignId = row['Campaign ID']?.toString() || '';
        shopCode = row['Shop ID']?.toString() || '';
        const rawUsername = row['Creator name'] || '';
        creatorUsername = rawUsername.replace('@', '').toLowerCase();
        contentUid = row['Livestream room ID']?.toString() || '';
        tanggal = parseTikTokDate(row['Date']?.toString() || row['LIVE time info']?.toString() || '');
        contentType = 'Livestream';
        orderId = ''; 
        orderStatus = 'Completed'; 
        videoViews = parseInt(row['LIVE views'] || 0);
        videoLikes = parseInt(row['LIVE likes'] || 0);
        durationStr = row['Duration']?.toString() || '';
        const rpmStr = row['LIVE product RPM']?.toString() || '0';
        videoProductRpm = Math.round(parseFloat(rpmStr.replace(/[^0-9]/g, '')) || 0);
      } else {
        // Awareness Format - HANYA UPDATE AWARENESS
        rawProductId = row['Product ID']?.toString() || '';
        productName = row['Product name']?.toString() || row['Product Name']?.toString() || skuNameMapping[rawProductId] || 'Unknown Product';
        gmv = 0; 
        quantity = 0;
        price = 0;
        tiktokCampaignId = row['Campaign ID']?.toString() || '';
        shopCode = row['Shop ID']?.toString() || '';
        const rawUsername = row['Creator name'] || '';
        creatorUsername = rawUsername.replace('@', '').toLowerCase();
        contentUid = row['Video ID']?.toString() || '';
        tanggal = parseTikTokDate(row['Post time']?.toString() || '');
        contentType = 'Video';
        orderId = ''; 
        orderStatus = 'Completed'; 
        videoViews = parseInt(row['Video views'] || 0);
        videoLikes = parseInt(row['Video likes'] || 0);
        durationStr = row['Duration']?.toString() || '';
        const rpmStr = row['Video product RPM']?.toString() || '0';
        videoProductRpm = Math.round(parseFloat(rpmStr.replace(/[^0-9]/g, '')) || 0);
      }

      // SMART ROUTING
      let mappedCampaignId = null;

      if (rawProductId && skuMapping[rawProductId]) {
        mappedCampaignId = skuMapping[rawProductId]; // Priority 1: SKU
      } else if (tiktokCampaignId && tiktokToCampaigns[tiktokCampaignId]) {
        const possibleCampaigns = tiktokToCampaigns[tiktokCampaignId];
        if (possibleCampaigns.length === 1) {
           mappedCampaignId = possibleCampaigns[0]; // Priority 2: Safe Campaign ID fallback
        }
      }

      if (!mappedCampaignId) {
        unmappedRowsCount++;
        if (rawProductId) unmappedSkusMap.set(rawProductId, productName);
        // Tetap simpan baris ini dengan campaign_id = null
      } else {
        if (rawProductId) mappedSkusMap.set(rawProductId, productName);
      }

      // Update Date Range
      const rowDate = new Date(tanggal).getTime();
      if (!isNaN(rowDate)) {
        if (rowDate < minDate) minDate = rowDate;
        if (rowDate > maxDate) maxDate = rowDate;
      }

      if (isRefund) {
        refundCount++;
        gmv = 0; // Set GMV to 0 so it overwrites the positive GMV in database correctly
      }

      // Hitung agregat untuk data yang VALID saja
      totalGmv += gmv;
      if (creatorUsername) {
        uniqueCreators.add(creatorUsername);
        creatorGmvMap.set(creatorUsername, (creatorGmvMap.get(creatorUsername) || 0) + gmv);
      }

      payload.push({
        campaign_id: mappedCampaignId,
        creator_username: creatorUsername,
        content_uid: contentUid || null,
        product_id: rawProductId || null,
        sku_id: rawProductId ? skuIdMapping[rawProductId] : undefined,
        tanggal: tanggal,
        price: price,
        quantity: quantity,
        gmv: gmv,
        is_refund: isRefund,
        content_type: contentType,
        order_id: orderId || null,
        order_status: orderStatus || null,
        commission_rate: commissionRate || null,
        attribution_type: attributionType || null,
        tiktok_campaign_id: tiktokCampaignId || null,
        shop_code: shopCode || null,
        video_views: videoViews,
        video_likes: videoLikes,
        duration_str: durationStr || null,
        video_product_rpm: videoProductRpm,
        raw_data: row
      });
    }

    // ====== DEDUP ANTAR FILE ======
    // Jika user upload beberapa file, hapus baris duplikat berdasarkan composite key (order_id)
    const seenOrderIds = new Set<string>();
    const dedupedPayload = payload.filter(row => {
      if (!row.order_id) return true; // baris tanpa order_id tetap diproses
      if (seenOrderIds.has(row.order_id)) return false; // buang duplikat
      seenOrderIds.add(row.order_id);
      return true;
    });
    const dupCount = payload.length - dedupedPayload.length;

    // Top 3 Creators by GMV
    const topCreators = Array.from(creatorGmvMap.entries())
      .map(([username, gmv]) => ({ username, gmv }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 3);

    // Array SKU
    const mappedSkusArray = Array.from(mappedSkusMap.entries()).map(([id, name]) => ({ id, name }));
    const unmappedSkusArray = Array.from(unmappedSkusMap.entries()).map(([id, name]) => ({ id, name }));

    let dateRangeStr = "Unknown Date";
    if (minDate <= maxDate) {
      const formatDate = (ts: number) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      dateRangeStr = `${formatDate(minDate)} - ${formatDate(maxDate)}`;
    }

    setPreviewPayload(dedupedPayload);
    setStats({
      totalRows: data.length,
      validRows: dedupedPayload.length,
      refunds: refundCount,
      unmappedRows: unmappedRowsCount + dupCount,
      totalGmv,
      uniqueCreators: uniqueCreators.size,
      mappedSkus: mappedSkusArray,
      unmappedSkus: unmappedSkusArray,
      topCreators,
      dateRange: dateRangeStr
    });
    setStep(2);
    setLoading(false);
  };

  const executeImport = async () => {
    setStep(3);
    setLoading(true);
    setResult(null);
    setProgress({ current: 0, total: previewPayload.length });
    
    let successCount = 0;
    const errors: string[] = [];
    
    // Deduplicate payload correctly based on type
    const salesMap = new Map<string, any>();
    const videoMap = new Map<string, any>();
    
    for (const item of previewPayload) {
      if (item.order_id) {
        // Sales Route
        if (salesMap.has(item.order_id)) {
          const existing = salesMap.get(item.order_id);
          existing.gmv += item.gmv;
          existing.quantity += item.quantity;
        } else {
          salesMap.set(item.order_id, { ...item }); 
        }
      } else if (item.content_uid) {
        // Engagement Route (Custom Report)
        if (!videoMap.has(item.content_uid)) {
          videoMap.set(item.content_uid, { ...item });
        }
      }
    }
    
    const uniqueSalesPayload = Array.from(salesMap.values());
    const uniqueVideoPayload = Array.from(videoMap.values());
    const uniquePayload = [...uniqueSalesPayload, ...uniqueVideoPayload];
    const total = uniquePayload.length;
    const chunkSize = 1000;
    
    for (let i = 0; i < total; i += chunkSize) {
      const chunk = uniquePayload.slice(i, i + chunkSize);
      
      const salesChunk = chunk
        .filter(c => c.order_id)
        .map(c => {
          const { video_views, video_likes, duration_str, video_product_rpm, ...salesData } = c;
          return salesData;
        });

      const videoChunk = chunk
        .filter(c => !c.order_id && c.content_uid)
        .map(c => ({
          content_uid: c.content_uid,
          creator_username: c.creator_username,
          post_time: c.tanggal,
          video_views: c.video_views,
          video_likes: c.video_likes,
          duration_str: c.duration_str,
          video_product_rpm: c.video_product_rpm
        }));
      
      const { error } = salesChunk.length > 0 ? await supabase.from('sales').upsert(salesChunk as any, { onConflict: 'order_id' }) : { error: null };
      
      if (videoChunk.length > 0) {
        await supabase.from('organic_videos').upsert(videoChunk as any, { onConflict: 'content_uid' });
      }

      if (error) {
        errors.push(`Gagal batch baris ${i}: ${error.message}`);
      } else {
        successCount += chunk.length;
      }
      
      setProgress({ current: Math.min(i + chunkSize, total), total });
    }

    // ====== AUTO-ASSIGN SKUS ======
    try {
      const uniqueUsernames = Array.from(new Set(uniquePayload.map(p => p.creator_username).filter(Boolean)));
      if (uniqueUsernames.length > 0) {
        // 1. Fetch existing creators
        const { data: existingCreators } = await supabase.from('creators').select('id, username').in('username', uniqueUsernames);
        const creatorMap = new Map(existingCreators?.map(c => [c.username, c.id]) || []);
        
        // 2. Insert missing creators
        const missingUsernames = uniqueUsernames.filter(u => !creatorMap.has(u));
        if (missingUsernames.length > 0) {
          const { data: newCreators, error: errInsert } = await supabase.from('creators').insert(
            missingUsernames.map(u => ({ username: u, added_by: 'system' }))
          ).select('id, username');
          if (!errInsert && newCreators) {
            newCreators.forEach(c => creatorMap.set(c.username, c.id));
          }
        }

        // 3. Group by campaign -> creator -> set of sku_ids
        const assignments: Record<number, Record<number, Set<number>>> = {};
        for (const item of uniquePayload) {
          const cId = creatorMap.get(item.creator_username);
          if (cId && item.campaign_id && item.sku_id) {
            if (!assignments[item.campaign_id]) assignments[item.campaign_id] = {};
            if (!assignments[item.campaign_id][cId]) assignments[item.campaign_id][cId] = new Set();
            assignments[item.campaign_id][cId].add(item.sku_id);
          }
        }

        // 4. Update campaign_creators
        for (const campIdStr of Object.keys(assignments)) {
          const campId = parseInt(campIdStr);
          const creatorIds = Object.keys(assignments[campId]).map(Number);
          
          if (creatorIds.length === 0) continue;

          const { data: existingCc } = await supabase.from('campaign_creators')
            .select('id, creator_id, assigned_sku_ids')
            .eq('campaign_id', campId)
            .in('creator_id', creatorIds);
            
          const ccMap = new Map(existingCc?.map(cc => [cc.creator_id, cc]) || []);
          
          const newCcsToInsert = [];

          for (const cId of creatorIds) {
            const newSkus = Array.from(assignments[campId][cId]);
            const existing = ccMap.get(cId);
            
            if (existing) {
              const currentSkus = existing.assigned_sku_ids || [];
              const merged = Array.from(new Set([...currentSkus, ...newSkus]));
              if (merged.length !== currentSkus.length) {
                await supabase.from('campaign_creators').update({ assigned_sku_ids: merged }).eq('id', existing.id);
              }
            } else {
              newCcsToInsert.push({
                campaign_id: campId,
                creator_id: cId,
                assigned_sku_ids: newSkus,
                approval: 'pending',
                client_approval: 'not_required',
                status_bayar: 'belum',
                qty_vt: 1,
                price: 0
              });
            }
          }
          if (newCcsToInsert.length > 0) {
            await supabase.from('campaign_creators').insert(newCcsToInsert);
          }
        }
      }
    } catch (autoAssignErr: any) {
      errors.push(`Gagal Auto-Assign Produk: ${autoAssignErr.message}`);
    }
    // ==============================
    
    setResult({ success: successCount, skipped: total - successCount, errors });
    setStep(4);
    setLoading(false);
  };

  const reset = () => {
    setFiles([]);
    setStep(1);
    setPreviewPayload([]);
    setStats(null);
    setResult(null);
    setPreviewPage(1);
  };

  return (
    <Card className="border-0 shadow-md rounded-2xl overflow-hidden bg-white">
      {/* Wizard Header */}
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
          <span className={`text-sm font-medium ${step >= 1 ? 'text-slate-900' : 'text-slate-500'}`}>Pilih File</span>
          <div className="w-8 h-[2px] bg-slate-200 mx-1"></div>
          
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
          <span className={`text-sm font-medium ${step >= 2 ? 'text-slate-900' : 'text-slate-500'}`}>Preview</span>
          <div className="w-8 h-[2px] bg-slate-200 mx-1"></div>
          
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
          <span className={`text-sm font-medium ${step >= 3 ? 'text-slate-900' : 'text-slate-500'}`}>Import</span>
        </div>
      </div>

      <CardContent className="p-6">
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 text-sm">Smart Routing Aktif!</p>
                <p className="text-sm text-amber-800 mt-1">
                  Data otomatis dipisah ke masing-masing Campaign. Data dengan SKU/Campaign ID yang <b>belum terdaftar</b> akan tetap disimpan ke database, namun statusnya <b>belum terpetakan</b> sampai Anda mendaftarkan SKU tersebut di Campaign.
                </p>
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer" onClick={() => document.getElementById('organic-upload')?.click()}>
              <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="font-semibold text-lg mb-1 text-slate-700">Upload File Export Partner Center</p>
              <p className="text-sm text-slate-500 mb-6">Mendukung format .csv dan .xlsx dari TikTok</p>
              <input 
                type="file" 
                multiple
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                className="hidden" 
                id="organic-upload"
                onChange={handleFileUpload}
              />
              <Button variant="secondary" className="pointer-events-none rounded-xl">
                Pilih File Komputer
              </Button>
              {files.length > 0 && (
                <div className="mt-4 text-sm text-indigo-600 font-bold bg-indigo-100/50 py-2 px-4 rounded-lg inline-block">
                  Terpilih: {files.length} file <br/>
                  <span className="text-xs font-normal text-indigo-500">{files.map(f => f.name).join(', ')}</span>
                </div>
              )}
            </div>

            <Button 
              className="w-full h-12 rounded-xl text-base bg-indigo-600 hover:bg-indigo-700 text-white" 
              disabled={files.length === 0 || loading} 
              onClick={processFileLocally}
            >
              {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Menganalisa File (Harap Tunggu)...</> : 'Lanjut ke Preview'}
            </Button>
          </div>
        )}

        {step === 2 && stats && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {stats.unmappedRows > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-amber-900 mb-1">Ada Data Belum Terpetakan!</h4>
                  <p className="text-sm text-amber-800">
                    Ada <b>{stats.unmappedRows} baris</b> data yang SKU-nya belum terdaftar. Data ini <b>tetap akan disimpan ke database</b>, namun belum masuk ke total GMV Campaign mana pun. Harap daftarkan ID Produk di bawah ini ke menu "SKU Campaign" jika ingin data tersebut dihitung.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-green-900 mb-1">Semua SKU Terdaftar!</h4>
                  <p className="text-sm text-green-800">Bagus! Semua produk di dalam file ini cocok dengan SKU yang sudah Bapak daftarkan di sistem.</p>
                </div>
              </div>
            )}

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-indigo-900 mb-1">Rentang Tanggal Data:</p>
              <p className="text-lg font-bold text-indigo-700">{stats.dateRange}</p>
              <p className="text-xs text-indigo-600 mt-1">Pastikan ini adalah rentang tanggal yang benar sebelum klik Import.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <BarChart3 className="w-5 h-5 text-emerald-600 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Total GMV (Masuk)</p>
                <p className="text-lg font-bold text-slate-900">Rp {(stats.totalGmv / 1000000).toFixed(1)}M</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-1">Rp {stats.totalGmv.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Baris Data Valid</p>
                <p className="text-lg font-bold text-slate-900">{stats.validRows.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">{stats.refunds} refund dilewati</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <Users className="w-5 h-5 text-purple-600 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Kreator Unik</p>
                <p className="text-lg font-bold text-slate-900">{stats.uniqueCreators}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                <Tags className="w-5 h-5 text-amber-600 mb-2" />
                <p className="text-xs text-slate-500 font-medium">Belum Terpetakan</p>
                <p className="text-lg font-bold text-amber-600">{stats.unmappedRows}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Leaderboard Manual Verification */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-3 border-b border-slate-200">
                  <p className="font-bold text-sm text-slate-800">Top 3 Kreator (Verifikasi Manual)</p>
                </div>
                <div className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 text-slate-500 text-xs">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Username</th>
                        <th className="px-4 py-2 text-right font-medium">Total GMV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.topCreators.length > 0 ? stats.topCreators.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">@{c.username}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            Rp {c.gmv.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={2} className="px-4 py-3 text-center text-slate-500">Tidak ada data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SKU Detective Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                <div 
                  className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => setShowSkuTable(!showSkuTable)}
                >
                  <div className="flex items-center gap-2">
                    {showSkuTable ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                    <p className="font-bold text-sm text-slate-800">Daftar SKU Ditemukan</p>
                  </div>
                  <span className="text-xs bg-white px-2 py-1 rounded border border-slate-200 font-medium">
                    {stats.mappedSkus.length + stats.unmappedSkus.length} Produk
                  </span>
                </div>
                {showSkuTable && (
                  <div className="overflow-y-auto max-h-[250px] flex-1">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50/50 text-slate-500 sticky top-0 backdrop-blur-sm">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium w-16">Status</th>
                          <th className="px-4 py-2 text-left font-medium">Product ID</th>
                          <th className="px-4 py-2 text-left font-medium">Nama Produk</th>
                          <th className="px-4 py-2 text-left font-medium w-64">Daftarkan ke Campaign</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stats.unmappedSkus.map(sku => (
                          <tr key={sku.id} className="bg-amber-50/50 hover:bg-amber-50">
                            <td className="px-4 py-2"><span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">TERTUNDA</span></td>
                            <td className="px-4 py-2 font-mono text-amber-700">{sku.id}</td>
                            <td className="px-4 py-2 text-amber-900 max-w-[150px] truncate" title={sku.name}>{sku.name}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <select 
                                  className="border border-slate-200 rounded px-2 py-1 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                                  value={skuCampaignSelect[sku.id] || ''}
                                  onChange={(e) => setSkuCampaignSelect(prev => ({...prev, [sku.id]: e.target.value}))}
                                >
                                  <option value="">-- Pilih Campaign --</option>
                                  {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>{c.nama}</option>
                                  ))}
                                </select>
                                <button 
                                  onClick={() => handleRegisterSku(sku.id, sku.name)}
                                  disabled={isRegisteringSku === sku.id || !skuCampaignSelect[sku.id]}
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                  {isRegisteringSku === sku.id ? '...' : 'Simpan'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {stats.mappedSkus.map(sku => (
                          <tr key={sku.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2"><span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">TERDAFTAR</span></td>
                            <td className="px-4 py-2 font-mono text-slate-600">{sku.id}</td>
                            <td className="px-4 py-2 text-slate-700 max-w-[150px] truncate" title={sku.name}>{sku.name}</td>
                            <td className="px-4 py-2">
                              <span className="text-[10px] text-slate-400 font-medium italic">Terkoneksi</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* PREVIEW TABLE */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-6 shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">Preview Data yang akan Di-import</h3>
                <div className="text-sm text-slate-500">
                  Total {previewPayload.length.toLocaleString()} baris valid
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="p-3 font-semibold">No</th>
                      <th className="p-3 font-semibold">Tanggal</th>
                      <th className="p-3 font-semibold">Kreator</th>
                      <th className="p-3 font-semibold">ID Konten/Order</th>
                      <th className="p-3 font-semibold">GMV (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewPayload.slice((previewPage - 1) * 50, previewPage * 50).map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-slate-400">{(previewPage - 1) * 50 + idx + 1}</td>
                        <td className="p-3">{new Date(row.tanggal).toLocaleDateString('id-ID')}</td>
                        <td className="p-3 font-medium text-slate-700">@{row.creator_username}</td>
                        <td className="p-3 font-mono text-xs text-slate-500">{row.order_id || row.content_uid}</td>
                        <td className="p-3 text-emerald-600 font-semibold">{row.gmv.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewPayload.length > 50 && (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Halaman {previewPage} dari {Math.ceil(previewPayload.length / 50)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewPage(p => Math.max(1, p - 1))} disabled={previewPage === 1}>Sebelumnya</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreviewPage(p => Math.min(Math.ceil(previewPayload.length / 50), p + 1))} disabled={previewPage >= Math.ceil(previewPayload.length / 50)}>Selanjutnya</Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" className="w-1/3 h-12 rounded-xl border-slate-300 text-slate-600" onClick={() => setStep(1)}>
                Batal / Ganti File
              </Button>
              <Button className="w-2/3 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700" onClick={executeImport} disabled={stats.validRows === 0}>
                {stats.validRows > 0 ? `Import ${stats.validRows.toLocaleString()} Baris Data` : 'Tidak ada data valid'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-500">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Mengimpor Data...</h3>
              <p className="text-slate-500 text-sm mb-6">Jangan tutup halaman ini. Menyimpan secara rombongan (bulk upsert).</p>
              
              <div className="w-80 max-w-full">
                <div className="flex justify-between text-xs font-bold mb-2 text-slate-700">
                  <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} Baris</span>
                  <span>{Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && result && (
          <div className="py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-2xl flex items-start gap-4 mb-6 ${result.errors.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              {result.errors.length > 0 ? (
                <AlertCircle className="w-10 h-10 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="w-10 h-10 text-emerald-500 shrink-0" />
              )}
              
              <div className="flex-1">
                <h3 className={`text-xl font-bold mb-2 ${result.errors.length > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {result.errors.length > 0 ? 'Import Selesai dengan Beberapa Peringatan' : 'Import Sukses 100%!'}
                </h3>
                <p className={`text-sm mb-4 ${result.errors.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  Semua data valid berhasil dimasukkan / di-update ke dalam database. Laporan GMV di Dashboard akan otomatis menyesuaikan dengan data terbaru ini.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/60 p-4 rounded-xl border border-white shadow-sm flex flex-col justify-center items-center text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">Total Data Ter-Update</p>
                    <p className="text-3xl font-bold text-slate-800">{result.success.toLocaleString()} <span className="text-sm font-normal">baris</span></p>
                  </div>
                  {result.skipped > 0 && (
                    <div className="bg-red-50/60 p-4 rounded-xl border border-red-100 shadow-sm flex flex-col justify-center items-center text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70 text-red-700">Data Gagal</p>
                      <p className="text-3xl font-bold text-red-600">{result.skipped.toLocaleString()} <span className="text-sm font-normal">baris</span></p>
                    </div>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-4 bg-white/50 rounded-xl border border-amber-100 text-xs overflow-hidden">
                    <div 
                      className="p-3 font-bold text-amber-900 flex items-center justify-between cursor-pointer hover:bg-amber-50/50 transition-colors"
                      onClick={() => setShowErrorLogs(!showErrorLogs)}
                    >
                      <div className="flex items-center gap-2">
                        {showErrorLogs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span>Log Error ({result.errors.length})</span>
                      </div>
                    </div>
                    {showErrorLogs && (
                      <div className="p-4 pt-0 border-t border-amber-100">
                        <ul className="list-disc pl-4 space-y-1 text-amber-800 font-mono mt-2">
                          {result.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                          {result.errors.length > 50 && <li>...dan {result.errors.length - 50} error lainnya.</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button className="w-full h-12 rounded-xl text-base bg-slate-900 hover:bg-slate-800 text-white" onClick={reset}>
              Upload File Lainnya
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
