"use client";

import React, { useState, useEffect } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useDraftLocalStorage } from "@/hooks/useDraftLocalStorage";
// Replaced standard UI imports
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import { AlertCircle, Link as LinkIcon, Save, Edit2, Loader2, ChevronDown, ChevronRight, Plus, PlayCircle, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { useAuth } from "@/providers/AuthProvider";

export default function CampaignVideoPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  
  const { 
    creators, 
    videos,
    sales,
    skus,
    fetchData,
    campaigns
  } = useDatabaseStore();

  const { canEditCampaign } = useAuth();
  const hasAccess = canEditCampaign(campaignId);

  const campaign = campaigns.find(c => c.id === campaignId);

  const isAwareness = campaign?.tipe_campaign === 'awareness';

  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [localVideos, setLocalVideos] = useDraftLocalStorage<any[]>(`draft_videos_campaign_${campaignId}`, []);
  const [listingData, setListingData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!previewOpen || !previewUrl) return;
    const existingScript = document.querySelector('script[src="https://www.tiktok.com/embed.js"]');
    if (existingScript) existingScript.remove();
    const timer = setTimeout(() => {
      const script = document.createElement('script');
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    }, 100);
    return () => clearTimeout(timer);
  }, [previewOpen, previewUrl]);

  const supabase = createClient();

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // New Filters & Sort states
  const [filterSow, setFilterSow] = useState('all');
  const [filterSales, setFilterSales] = useState('all');
  const [filterSku, setFilterSku] = useState('all');
  const [sortBy, setSortBy] = useState('none');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [clientPage, setClientPage] = useState(1);
  const [viewMode, setViewMode] = useState<'creator' | 'video'>('creator');
  const CLIENT_PAGE_SIZE = 50;

  useEffect(() => {
    setClientPage(1);
  }, [filterSow, filterSales, filterSku, sortBy, debouncedSearch, viewMode]);
  
  const toggleGroup = (id: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };
  
  const PAGE_SIZE = 50;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchApprovedCreators = async (pageNum: number, isReset: boolean = false) => {
    setIsLoading(true);
    try {
      const supabaseClient = createClient();
      let query: any = supabaseClient
        .from('campaign_creators')
        .select('*, creators!inner(*), videos(*)')
        .eq('campaign_id', campaignId)
        .eq('approval', 'approved');

      if (campaign?.require_client_approval) {
        query = query.eq('client_approval', 'approved');
      }

      if (debouncedSearch) {
        query = query.ilike('creators.username', `%${debouncedSearch}%`);
      }

      // Remove the limit to prepare for looping
      query = query.order('id', { ascending: false });

      let allResults: any[] = [];
      let currentFrom = 0;
      let hasMoreDb = true;

      while (hasMoreDb) {
         // Create a fresh query for this page to avoid mutating the base query state improperly in some SDK versions
         let pageQuery = supabaseClient
            .from('campaign_creators')
            .select('*, creators!inner(*), videos(*)')
            .eq('campaign_id', campaignId)
            .eq('approval', 'approved');
            
         if (campaign?.require_client_approval) {
           pageQuery = pageQuery.eq('client_approval', 'approved');
         }
         if (debouncedSearch) {
           pageQuery = pageQuery.ilike('creators.username', `%${debouncedSearch}%`);
         }
         
         const { data, error } = await pageQuery.order('id', { ascending: false }).range(currentFrom, currentFrom + 999);
         if (error) throw error;
         
         if (data && data.length > 0) {
            allResults.push(...data);
            currentFrom += 1000;
         }
         if (!data || data.length < 1000) {
            hasMoreDb = false;
         }
      }

      const results = allResults;
      setHasMore(false); // We fetched everything, no server pagination

      const creatorUsernames = results.map((cc: any) => cc.creators?.username).filter(Boolean);
      let localSalesData: any[] = [];
      let localOrganicVideos: any[] = [];

      const CHUNK_SIZE = 300;
      for (let i = 0; i < creatorUsernames.length; i += CHUNK_SIZE) {
        const chunk = creatorUsernames.slice(i, i + CHUNK_SIZE);
        
        if (chunk.length > 0) {
          let sQuery = supabaseClient
            .from('sales')
            .select('id, campaign_id, creator_username, content_uid, gmv, quantity, raw_data, product_id, tanggal')
            .eq('campaign_id', campaignId)
            .in('creator_username', chunk);

          if (campaign?.start_date) sQuery = sQuery.gte('tanggal', campaign.start_date);
          if (campaign?.end_date) sQuery = sQuery.lte('tanggal', campaign.end_date);

          const { data: sData } = await sQuery;
          if (sData) localSalesData.push(...sData);

          let oQuery = supabaseClient
            .from('organic_videos')
            .select('*')
            .in('creator_username', chunk);
            
          if (campaign?.start_date) oQuery = oQuery.gte('post_time', campaign.start_date);
          if (campaign?.end_date) oQuery = oQuery.lte('post_time', campaign.end_date);

          const { data: oData } = await oQuery;
          if (oData) localOrganicVideos.push(...oData);
        }
      }

      const allVideosFromDb = results.flatMap((cc: any) => cc.videos || []);
      
      // Auto-detect videos from sales
      const autoVideos: any[] = [];
      results.forEach((cc: any) => {
        const creator = cc.creators;
        if (!creator) return;
        
        const creatorSales = localSalesData.filter((s: any) => s.creator_username === creator.username && s.content_uid);
        const uniqueVideoIds = new Set<string>();
        
        creatorSales.forEach((s: any) => {
          let vid = s.content_uid;
          if (vid && vid.startsWith('video_')) {
            const parts = vid.split('_');
            if (parts.length >= 2) vid = parts[1];
          }

          if (vid && !uniqueVideoIds.has(vid)) {
            uniqueVideoIds.add(vid);
            
            // Check if exists in db using the true video ID or vt_code
            const existsInDb = allVideosFromDb.some((v: any) => 
               v.campaign_creator_id === cc.id && 
               (v.content_uid === vid || v.vt_code === vid || v.content_uid === s.content_uid)
            );
            
            if (!existsInDb) {
               // Try to match product_id from sales to skus table
               const matchingSku = skus.find(sku => sku.product_id === s.product_id && sku.campaign_id === campaignId);
               
               autoVideos.push({
                 id: `auto_${vid}`,
                 campaign_creator_id: cc.id,
                 urutan: 999, // Will be re-assigned later
                 concept: 'Auto-detected from Sales CSV',
                 link_video: `https://www.tiktok.com/@${creator.username}/video/${vid}`,
                 content_uid: vid,
                 sku_id: matchingSku ? matchingSku.id : null,
                 vt_approval: 'approved'
               });
            }
          }
        });
      });

      const allVideos = [...allVideosFromDb, ...autoVideos];
      
      if (isReset) {
         setLocalVideos(allVideos);
      } else {
         setLocalVideos((prev: any[]) => {
            const existingIds = new Set(prev.map(p => p.id));
            return [...prev, ...allVideos.filter(v => !existingIds.has(v.id))];
         });
      }
      
      // We also need to store this localSalesData and localOrganicVideos so the render function can calculate GMV per video
      setListingData(prev => {
         if (isReset) {
            return results.map((cc: any) => ({
                ...cc,
                _localSales: localSalesData.filter((s: any) => s.creator_username === cc.creators?.username),
                _localOrganicVideos: localOrganicVideos.filter((v: any) => v.creator_username === cc.creators?.username)
            }));
         } else {
            const existingIds = new Set(prev.map(p => p.id));
            const newResults = results.filter((r: any) => !existingIds.has(r.id)).map((cc: any) => ({
                ...cc,
                _localSales: localSalesData.filter((s: any) => s.creator_username === cc.creators?.username),
                _localOrganicVideos: localOrganicVideos.filter((v: any) => v.creator_username === cc.creators?.username)
            }));
            return [...prev, ...newResults];
         }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      setPage(0);
      fetchApprovedCreators(0, true);
    }
  }, [campaignId, campaign?.require_client_approval, debouncedSearch]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchApprovedCreators(next, false);
  };

  const handleVideoChange = (ccId: number, urutan: number, field: string, value: string) => {
    setLocalVideos((prev: any[]) => {
      const exists = prev.find(v => v.campaign_creator_id === ccId && v.urutan === urutan);
      if (exists) {
        return prev.map(v => 
          v.campaign_creator_id === ccId && v.urutan === urutan ? { ...v, [field]: value } : v
        );
      } else {
        return [...prev, {
          campaign_creator_id: ccId,
          urutan: urutan,
          [field]: value
        }];
      }
    });
  };

  const isShortLink = (link: string) => {
    return link && (link.includes('vt.tiktok.com') || link.includes('vm.tiktok.com'));
  };

  const handleSaveVT = async (ccId: number) => {
    setSaving(prev => ({ ...prev, [ccId]: true }));
    try {
      const creatorVideos = localVideos.filter(vid => vid.campaign_creator_id === ccId);
      
      // Validasi semua link sebelum save
      for (const v of creatorVideos) {
        if (v.link_video) {
          if (isShortLink(v.link_video)) {
             alert('Sistem tidak bisa menyimpan link pendek (vt.tiktok.com). Harap copy link panjang dari PC.');
             setSaving(prev => ({ ...prev, [ccId]: false }));
             return;
          }
          
          const match = v.link_video.match(/video\/(\d+)/);
          if (!match) {
             alert(`Format link tidak valid: ${v.link_video}\\nHarap gunakan format: https://www.tiktok.com/@username/video/123456789`);
             setSaving(prev => ({ ...prev, [ccId]: false }));
             return;
          }
        }
      }

      for (const v of creatorVideos) {
        let finalContentUid = v.content_uid;
        if (v.link_video) {
           const match = v.link_video.match(/video\/(\d+)/);
           if (match) finalContentUid = match[1];
        }

        if (v.id && typeof v.id === 'number') {
          await supabase.from('videos').update({
            concept: v.concept,
            link_video: v.link_video,
            content_uid: finalContentUid,
            sku_id: v.sku_id ? Number(v.sku_id) : null
          }).eq('id', v.id);
        } else {
          await supabase.from('videos').insert({
            campaign_creator_id: ccId,
            urutan: v.urutan,
            concept: v.concept,
            link_video: v.link_video,
            content_uid: finalContentUid,
            sku_id: v.sku_id ? Number(v.sku_id) : null,
            vt_approval: 'approved'
          });
        }
      }
      
      await fetchData(); 
      
      // Update local storage to remove this creator's drafted items
      setLocalVideos((prev: any[]) => prev.filter(v => v.campaign_creator_id !== ccId));
      
      alert('Perubahan berhasil disimpan');
    } catch (error) {
      console.error('Error saving videos:', error);
      alert('Gagal menyimpan video');
    } finally {
      setSaving(prev => ({ ...prev, [ccId]: false }));
    }
  };

  const handleAddVideoRow = (ccId: number) => {
    setLocalVideos((prev: any[]) => {
      const creatorVideos = prev.filter(v => v.campaign_creator_id === ccId);
      const nextUrutan = creatorVideos.length > 0 ? Math.max(...creatorVideos.map(v => v.urutan)) + 1 : 1;
      return [...prev, {
        campaign_creator_id: ccId,
        urutan: nextUrutan,
        concept: '',
        link_video: '',
        vt_approval: 'pending'
      }];
    });
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    setPage(0);
    setListingData([]);
  };

  const processedListingData = React.useMemo(() => {
    let data = [...listingData];

    const metricsMap = new Map();
    data.forEach(cc => {
       const creator = cc.creators;
       if (!creator) return;
       
       let creatorVideos = localVideos.filter(v => v.campaign_creator_id === cc.id);
       const uploadedVtCount = creatorVideos.filter(v => v.link_video).length;
       const targetVt = cc.qty_vt || 0;
       
       const ccSales = cc._localSales || [];
       let totalGmv = 0;
       
       ccSales.forEach((s: any) => {
          if (s.content_uid && s.product_id) {
             const matchingSku = skus.find(sku => sku.product_id === s.product_id && sku.campaign_id === campaignId);
             if (matchingSku) {
                totalGmv += (s.gmv || 0);
             }
          }
       });

       const ccOrganic = cc._localOrganicVideos || [];
       let totalViews = 0;
       let totalLikes = 0;
       ccOrganic.forEach((o: any) => {
          totalViews += (o.views || 0);
          totalLikes += (o.likes || 0);
       });

       metricsMap.set(cc.id, {
          uploadedVtCount,
          targetVt,
          totalGmv,
          totalViews,
          totalLikes
       });
    });

    if (filterSow !== 'all') {
      data = data.filter(cc => {
         const m = metricsMap.get(cc.id);
         if (!m) return false;
         if (filterSow === 'done') return m.uploadedVtCount >= m.targetVt && m.targetVt > 0;
         if (filterSow === 'pending') return m.uploadedVtCount < m.targetVt;
         return true;
      });
    }

    if (filterSales !== 'all') {
      data = data.filter(cc => {
         const m = metricsMap.get(cc.id);
         if (!m) return false;
         if (filterSales === 'pecah') return m.totalGmv > 0;
         if (filterSales === 'nol') return m.totalGmv === 0;
         return true;
      });
    }

    if (filterSku !== 'all') {
       data = data.filter(cc => {
          const ccSales = cc._localSales || [];
          return ccSales.some((s: any) => s.product_id === filterSku);
       });
    }

    if (sortBy !== 'none') {
       data.sort((a, b) => {
          const ma = metricsMap.get(a.id);
          const mb = metricsMap.get(b.id);
          if (!ma || !mb) return 0;

          switch(sortBy) {
             case 'gmv_desc': return mb.totalGmv - ma.totalGmv;
             case 'gmv_asc': return ma.totalGmv - mb.totalGmv;
             case 'vt_desc': return mb.uploadedVtCount - ma.uploadedVtCount;
             case 'vt_asc': return ma.uploadedVtCount - mb.uploadedVtCount;
             case 'views_desc': return mb.totalViews - ma.totalViews;
             case 'views_asc': return ma.totalViews - mb.totalViews;
             case 'likes_desc': return mb.totalLikes - ma.totalLikes;
             case 'likes_asc': return ma.totalLikes - mb.totalLikes;
             default: return 0;
          }
       });
    }

    return { data, metricsMap };
  }, [listingData, localVideos, skus, campaignId, filterSow, filterSales, filterSku, sortBy]);

  const { data: finalListingData, metricsMap } = processedListingData;
  const visibleData = finalListingData.slice(0, clientPage * CLIENT_PAGE_SIZE);
  const hasMoreClient = finalListingData.length > visibleData.length;

  const processedVideosData = React.useMemo(() => {
    let allVids: any[] = [];
    
    localVideos.forEach(v => {
       const cc = listingData.find(c => c.id === v.campaign_creator_id);
       if (!cc || !cc.creators) return;
       
       const creator = cc.creators;
       const ccSales = cc._localSales || [];
       const ccOrganic = cc._localOrganicVideos || [];
       
       const hasContentUid = v.content_uid && v.content_uid !== '';
       const dynamicContentUid = hasContentUid ? v.content_uid : null;
       
       let vidGmv = 0;
       let vidViews = 0;
       let vidLikes = 0;
       
       if (dynamicContentUid) {
          ccSales.forEach((s: any) => {
             if (s.content_uid === dynamicContentUid || s.content_uid === `video_${dynamicContentUid}`) {
                vidGmv += (s.gmv || 0);
             }
          });
          ccOrganic.forEach((o: any) => {
             if (o.video_id === dynamicContentUid) {
                vidViews += (o.views || 0);
                vidLikes += (o.likes || 0);
             }
          });
       }
       
       const rpm = vidViews > 0 ? (vidGmv / vidViews) * 1000 : 0;
       
       // Filter out empty "Tambah Baris" that haven't been filled if in "Semua Video" mode
       if (!v.link_video && !v.content_uid && v.concept === '') return;

       allVids.push({
          ...v,
          creatorUsername: creator.username,
          creatorTier: cc.tier,
          ccId: cc.id,
          vidGmv,
          vidViews,
          vidLikes,
          rpm,
          hasContentUid,
          dynamicContentUid
       });
    });

    if (filterSow !== 'all') {
       allVids = allVids.filter(v => {
          const m = metricsMap.get(v.ccId);
          if (!m) return false;
          if (filterSow === 'done') return m.uploadedVtCount >= m.targetVt && m.targetVt > 0;
          if (filterSow === 'pending') return m.uploadedVtCount < m.targetVt;
          return true;
       });
    }

    if (filterSales !== 'all') {
       allVids = allVids.filter(v => {
          if (filterSales === 'pecah') return v.vidGmv > 0;
          if (filterSales === 'nol') return v.vidGmv === 0;
          return true;
       });
    }

    if (filterSku !== 'all') {
       allVids = allVids.filter(v => v.sku_id === filterSku);
    }

    if (sortBy !== 'none') {
       allVids.sort((a, b) => {
          switch(sortBy) {
             case 'gmv_desc': return b.vidGmv - a.vidGmv;
             case 'gmv_asc': return a.vidGmv - b.vidGmv;
             case 'vt_desc': 
             case 'views_desc': return b.vidViews - a.vidViews;
             case 'vt_asc':
             case 'views_asc': return a.vidViews - b.vidViews;
             case 'likes_desc': return b.vidLikes - a.vidLikes;
             case 'likes_asc': return a.vidLikes - b.vidLikes;
             default: return 0;
          }
       });
    }

    return allVids;
  }, [localVideos, listingData, metricsMap, filterSow, filterSales, filterSku, sortBy]);

  const visibleVideosData = processedVideosData.slice(0, clientPage * CLIENT_PAGE_SIZE);
  const hasMoreVideosClient = processedVideosData.length > visibleVideosData.length;

  return (
    <>
      <div className="space-y-[24px]">
      <div className="flex justify-between items-center mb-[24px] gap-[16px] flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold">Video & VT</h2>
          <p className="text-[13px] text-text-soft">Kelola konsep, link video, dan approval VT untuk kreator yang di-approve.</p>
          <div className="mt-[12px] bg-blue-50/80 border border-blue-200/80 p-[12px] rounded-[8px] text-[12px] text-blue-800 flex gap-[10px] items-start max-w-3xl">
            <span className="text-[16px] leading-none mt-0.5">💡</span>
            <div>
              <strong className="text-blue-900">Penting: Format Link Video TikTok</strong><br/>
              Agar performa (GMV) video dapat ditarik secara otomatis oleh sistem, <strong>wajib</strong> memasukkan link TikTok versi panjang yang mengandung <i>username</i> dan <i>ID Video</i>.<br/>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 font-bold">✅ BENAR</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-blue-100 text-blue-900 text-[11px] font-mono">https://www.tiktok.com/@username/video/1234567890</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 font-bold">❌ SALAH</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-red-100 text-red-900 text-[11px] font-mono">https://vt.tiktok.com/ZSxxxx/</code>
                  <span className="text-blue-700 italic text-[11px] ml-1">(link dari tombol "Copy Link" di HP tidak akan terbaca sistem)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="flex flex-col gap-4 bg-slate-50 p-4 border border-line rounded-lg">
             <div className="flex bg-white rounded-md border border-slate-200 overflow-hidden w-fit">
                <button 
                  onClick={() => setViewMode('creator')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${viewMode === 'creator' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Tampilan: Per Kreator
                </button>
                <div className="w-[1px] bg-slate-200"></div>
                <button 
                  onClick={() => setViewMode('video')}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${viewMode === 'video' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  Tampilan: Semua Video
                </button>
             </div>
             <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2 flex-1 min-w-[200px]">
                   <label className="text-xs font-semibold text-text-soft">Pencarian Kreator</label>
                   <input 
                      type="text" 
                      placeholder="Cari username..." 
                      className="input w-full"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-semibold text-text-soft">Status SOW</label>
                   <select className="select w-full" value={filterSow} onChange={e => setFilterSow(e.target.value)}>
                      <option value="all">Semua SOW</option>
                      <option value="done">Sudah Upload (Memenuhi Target)</option>
                      <option value="pending">Belum Upload / Kurang Target</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-semibold text-text-soft">Status Penjualan</label>
                   <select className="select w-full" value={filterSales} onChange={e => setFilterSales(e.target.value)}>
                      <option value="all">Semua Status</option>
                      <option value="pecah">Sudah Pecah Telur (GMV &gt; 0)</option>
                      <option value="nol">Belum Ada Penjualan</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-semibold text-text-soft">Filter Produk</label>
                   <select className="select w-full max-w-[200px]" value={filterSku} onChange={e => setFilterSku(e.target.value)}>
                      <option value="all">Semua Produk Campaign</option>
                      {skus.filter(s => s.campaign_id === campaignId).map(sku => (
                         <option key={sku.id} value={sku.product_id}>{sku.nama_produk || sku.product_id}</option>
                      ))}
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-xs font-semibold text-text-soft">Urutkan (Sort)</label>
                   <select className="select w-full font-semibold" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                      <option value="none">Tanpa Pengurutan</option>
                      <optgroup label="Berdasarkan GMV">
                         <option value="gmv_desc">Total GMV (Tertinggi)</option>
                         <option value="gmv_asc">Total GMV (Terendah)</option>
                      </optgroup>
                      <optgroup label="Berdasarkan Upload">
                         <option value="vt_desc">Jumlah Video (Terbanyak)</option>
                         <option value="vt_asc">Jumlah Video (Terdikit)</option>
                      </optgroup>
                      <optgroup label="Berdasarkan Views & Likes">
                         <option value="views_desc">Total Views (Tertinggi)</option>
                         <option value="views_asc">Total Views (Terendah)</option>
                         <option value="likes_desc">Total Likes (Tertinggi)</option>
                         <option value="likes_asc">Total Likes (Terendah)</option>
                      </optgroup>
                   </select>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="ccard p-[24px]">
        {isLoading ? (
          <div className="text-center py-[48px] text-text-soft">
            Memuat data creator...
          </div>
        ) : listingData.length === 0 ? (
          <div className="text-center py-[48px] text-text-soft">
            Belum ada creator yang berstatus "Approved" di campaign ini.
          </div>
        ) : viewMode === 'creator' ? (
          <div className="space-y-[48px] pb-[24px]">
            {visibleData.map(cc => {
              const creator = cc.creators;
              if (!creator) return null;
              
              let creatorVideos = localVideos.filter(v => v.campaign_creator_id === cc.id);
              
              // Re-assign urutan for auto videos so they appear at the bottom sequentially
              let maxUrutan = Math.max(0, ...creatorVideos.filter(v => typeof v.id === 'number').map(v => v.urutan));
              creatorVideos = creatorVideos.map(v => {
                if (typeof v.id === 'string' && v.id.startsWith('auto_')) {
                   maxUrutan++;
                   return { ...v, urutan: maxUrutan };
                }
                return v;
              });

              creatorVideos.sort((a, b) => a.urutan - b.urutan);
              if (creatorVideos.length === 0) {
                creatorVideos = [{ campaign_creator_id: cc.id, urutan: 1, concept: '', link_video: '', vt_approval: 'pending' }];
              }

              const isExpanded = expandedGroups.has(cc.id);
              const m = metricsMap.get(cc.id);

              return (
                <div key={cc.id} className="border border-line rounded-[12px] overflow-hidden bg-white">
                  <div 
                    className="bg-slate-50 p-[16px] border-b border-line flex flex-wrap justify-between items-center gap-[16px] cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => toggleGroup(cc.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2 rounded-full ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-[16px]">@{creator.username}</h3>
                      </div>
                      
                      {/* Summary Metrics */}
                      <div className="ml-auto hidden md:flex items-center gap-4 lg:gap-6 text-sm">
                        <div className="text-center px-2 lg:px-4 border-l border-slate-200">
                          <p className="text-[10px] text-slate-500 font-medium">SOW VT</p>
                          <p className="font-bold text-slate-700">{cc.qty_vt}</p>
                        </div>
                        <div className="text-center px-2 lg:px-4 border-l border-slate-200">
                          <p className="text-[10px] text-slate-500 font-medium">TOTAL VT</p>
                          <p className="font-bold text-slate-700">{localVideos.filter(v => v.campaign_creator_id === cc.id && v.link_video).length}</p>
                        </div>
                        <div className="text-center px-2 lg:px-4 border-l border-slate-200">
                          <p className="text-[10px] text-emerald-600 font-medium">TOTAL GMV</p>
                          <p className="font-bold text-emerald-700">Rp {m?.totalGmv?.toLocaleString('id-ID') || 0}</p>
                        </div>
                        <div className="text-center px-2 lg:px-4 border-l border-slate-200">
                          <p className="text-[10px] text-slate-500 font-medium">TOTAL VIEWS</p>
                          <p className="font-bold text-slate-700">{m?.totalViews?.toLocaleString('id-ID') || 0}</p>
                        </div>
                        <div className="text-center px-2 lg:px-4 border-l border-slate-200">
                          <p className="text-[10px] text-slate-500 font-medium">TOTAL LIKES</p>
                          <p className="font-bold text-slate-700">{m?.totalLikes?.toLocaleString('id-ID') || 0}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-[10px]" onClick={e => e.stopPropagation()}>
                      {hasAccess && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleAddVideoRow(cc.id); if(!isExpanded) toggleGroup(cc.id); }}
                            className="btn btn-outline"
                          >
                            + Tambah Baris
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSaveVT(cc.id); }}
                            disabled={saving[cc.id]}
                            className="btn btn-primary"
                          >
                            {saving[cc.id] ? <Loader2 className="ico animate-spin" /> : <Save className="ico" />}
                            {saving[cc.id] ? 'Menyimpan...' : 'Simpan Perubahan'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-[16px]">
                      <div className="tbl-wrap">

                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="w-16 text-center">Urutan</th>
                            <th className={isAwareness ? "w-1/3" : "w-1/4"}>{isAwareness ? "Konsep / Ide SOW" : "Konsep / Ide"}</th>
                            <th className={isAwareness ? "w-1/3" : "w-1/4"}>Link Video TikTok</th>
                            <th>Performa</th>
                            <th>Produk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {creatorVideos.map((v) => {
                            const warningShortLink = !isAwareness && isShortLink(v.link_video);
                            const extractedMatch = v.link_video?.match(/video\/(\d+)/);
                            const dynamicContentUid = extractedMatch ? extractedMatch[1] : v.content_uid;
                            const hasContentUid = !!dynamicContentUid;

                            // Calculate metrics for this specific video
                            let vidGmv = 0;
                            let vidViews = 0;
                            let vidLikes = 0;

                            if (hasContentUid) {
                               const ccSales = cc._localSales || [];
                               ccSales.forEach((s: any) => {
                                  if ((s.content_uid === dynamicContentUid || s.content_uid === `video_${dynamicContentUid}`) && s.product_id) {
                                     const matchingSku = skus.find(sku => sku.product_id === s.product_id && sku.campaign_id === campaignId);
                                     if (matchingSku) {
                                        vidGmv += (s.gmv || 0);
                                     }
                                  }
                               });

                               const ccOrganic = cc._localOrganicVideos || [];
                               ccOrganic.forEach((o: any) => {
                                  if (o.vt_code === dynamicContentUid || o.content_uid === dynamicContentUid) {
                                     vidViews += (o.views || 0);
                                     vidLikes += (o.likes || 0);
                                  }
                               });
                            }

                            const rpm = vidViews > 0 ? (vidGmv / vidViews) * 1000 : 0;

                            return (
                              <tr key={v.urutan}>
                                <td className="font-semibold text-center">{v.urutan}</td>
                                <td>
                                  <textarea 
                                    className="input min-h-[60px]"
                                    placeholder={isAwareness ? "Tulis brief/konsep..." : "Tulis ide konsep..."}
                                    value={v.concept || ''}
                                    onChange={(e) => handleVideoChange(cc.id, v.urutan, 'concept', e.target.value)}
                                    disabled={!hasAccess}
                                  />
                                </td>
                                <td>
                                  <div className="space-y-[8px]">
                                    <div className="flex items-center gap-2">
                                      <button 
                                        className={`btn btn-soft p-0 flex items-center justify-center h-10 w-10 flex-shrink-0 ${v.link_video ? 'text-indigo-600 hover:bg-indigo-100' : 'text-slate-400'}`}
                                        title={v.link_video ? "Tonton Video" : "Link video belum diisi"}
                                        disabled={!v.link_video}
                                        onClick={() => {
                                          if(v.link_video) {
                                            setPreviewUrl(v.link_video);
                                            setPreviewOpen(true);
                                          }
                                        }}
                                      >
                                        <PlayCircle className="w-5 h-5" />
                                      </button>
                                      <div className="relative flex-grow">
                                        <LinkIcon className="w-4 h-4 absolute left-[10px] top-[10px] text-text-soft" />
                                        <input 
                                          type="text"
                                          className={`input !pl-[34px] ${warningShortLink ? 'border-amber-400 bg-amber-50' : ''}`}
                                          placeholder={isAwareness ? "https://..." : "https://www.tiktok.com/@..."}
                                          value={v.link_video || ''}
                                          onChange={(e) => handleVideoChange(cc.id, v.urutan, 'link_video', e.target.value)}
                                          disabled={!hasAccess}
                                        />
                                      </div>
                                    </div>
                                    {warningShortLink && (
                                      <p className="text-[11px] text-amber-600 flex items-start gap-[4px]">
                                        <AlertCircle className="w-3 h-3 shrink-0 mt-[2px]" />
                                        Sistem tidak bisa melacak GMV dari link pendek (vt.tiktok.com). Harap buka link ini di PC lalu copy link panjangnya.
                                      </p>
                                    )}
                                    {v.link_video && !warningShortLink && !hasContentUid && !isAwareness && (
                                      <p className="text-[11px] text-red-500 flex items-start gap-[4px]">
                                        <AlertCircle className="w-3 h-3 shrink-0 mt-[2px]" />
                                        Format link salah. Content ID (19 digit) tidak ditemukan.
                                      </p>
                                    )}
                                    {hasContentUid && !isAwareness && (
                                      <p className="text-[11px] text-green-600 flex items-center gap-[4px]">
                                        ✓ Terhubung dengan Content ID: {dynamicContentUid}
                                      </p>
                                    )}
                                    {hasContentUid && (
                                      <div className="mt-2 grid grid-cols-4 gap-1 bg-slate-50 border border-slate-200 p-2 rounded-md text-xs">
                                         <div className="text-center">
                                            <div className="text-slate-400 text-[10px]">Views</div>
                                            <div className="font-semibold text-slate-700">{vidViews.toLocaleString('id-ID')}</div>
                                         </div>
                                         <div className="text-center border-l border-slate-200">
                                            <div className="text-slate-400 text-[10px]">Likes</div>
                                            <div className="font-semibold text-slate-700">{vidLikes.toLocaleString('id-ID')}</div>
                                         </div>
                                         <div className="text-center border-l border-slate-200">
                                            <div className="text-slate-400 text-[10px]">GMV</div>
                                            <div className="font-semibold text-emerald-600">Rp {vidGmv.toLocaleString('id-ID')}</div>
                                         </div>
                                         <div className="text-center border-l border-slate-200" title="GMV Per Mille (Per 1000 Views)">
                                            <div className="text-slate-400 text-[10px]">GPM</div>
                                            <div className="font-semibold text-indigo-600">Rp {Math.round(rpm).toLocaleString('id-ID')}</div>
                                         </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div className="font-semibold text-[15px] text-emerald-600">
                                    {hasContentUid ? (
                                      `Rp ${vidGmv.toLocaleString('id-ID')}`
                                    ) : (
                                      <span className="text-text-soft text-[13px] font-normal">Belum ada GMV</span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <select 
                                    className="select w-full"
                                    value={v.sku_id || ''}
                                    onChange={(e) => handleVideoChange(cc.id, v.urutan, 'sku_id', e.target.value)}
                                    disabled={!hasAccess}
                                  >
                                    <option value="">Pilih Produk...</option>
                                    {skus.filter(s => s.campaign_id === campaignId).map(s => (
                                      <option key={s.id} value={s.id}>{s.nama_produk || s.product_id}</option>
                                    ))}
                                  </select>
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
              );
            })}
            
            {hasMoreClient && (
              <div className="flex justify-center mt-[24px]">
                <button onClick={() => setClientPage(p => p + 1)} className="btn btn-outline">
                  <ChevronDown className="ico" />
                  Tampilkan Lebih Banyak
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto pb-[24px]">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">Kreator</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 w-[300px]">Link Video TikTok</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">Produk</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">GMV & GPM</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">Views & Likes</th>
                  <th className="p-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visibleVideosData.map(v => {
                  const warningShortLink = v.link_video?.includes('vt.tiktok.com');
                  return (
                    <tr key={`${v.ccId}_${v.urutan}`} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-4 align-top">
                        <div className="font-bold text-sm">@{v.creatorUsername}</div>
                        <div className="text-[11px] font-semibold text-slate-500 bg-slate-100 w-fit px-2 py-0.5 rounded mt-1">{v.creatorTier || 'Tier -'}</div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-2">
                           <div className="flex gap-2">
                              <button 
                                className="btn-icon bg-slate-100 shrink-0 hover:bg-slate-200 transition-colors" 
                                title="Putar Video"
                                onClick={() => {
                                  if(v.link_video) {
                                    setPreviewUrl(v.link_video);
                                    setPreviewOpen(true);
                                  }
                                }}
                              >
                                <PlayCircle className="w-5 h-5 text-indigo-600" />
                              </button>
                              <div className="relative flex-grow">
                                <LinkIcon className="w-4 h-4 absolute left-[10px] top-[10px] text-text-soft" />
                                <input 
                                  type="text"
                                  className={`input !pl-[34px] w-full text-[13px] ${warningShortLink ? 'border-amber-400 bg-amber-50' : ''}`}
                                  placeholder="https://www.tiktok.com/@..."
                                  value={v.link_video || ''}
                                  onChange={(e) => handleVideoChange(v.ccId, v.urutan, 'link_video', e.target.value)}
                                  disabled={!hasAccess}
                                />
                              </div>
                           </div>
                           {warningShortLink && (
                              <p className="text-[11px] text-amber-600 flex items-start gap-[4px]">
                                <AlertCircle className="w-3 h-3 shrink-0 mt-[2px]" />
                                Sistem tidak bisa melacak GMV dari link pendek (vt.tiktok.com).
                              </p>
                           )}
                           {v.hasContentUid && (
                              <p className="text-[10px] text-emerald-600 font-medium">✓ Content ID: {v.dynamicContentUid}</p>
                           )}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <select 
                          className="select w-full text-[13px]"
                          value={v.sku_id || ''}
                          onChange={(e) => handleVideoChange(v.ccId, v.urutan, 'sku_id', e.target.value)}
                          disabled={!hasAccess}
                        >
                          <option value="">Pilih Produk...</option>
                          {skus.filter(s => s.campaign_id === campaignId).map(s => (
                            <option key={s.id} value={s.id}>{s.nama_produk || s.product_id}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-bold text-emerald-700 text-[15px]">Rp {v.vidGmv.toLocaleString('id-ID')}</div>
                        {v.rpm > 0 && <div className="text-[11px] font-semibold text-indigo-600 mt-1 bg-indigo-50 px-2 py-0.5 rounded w-fit border border-indigo-100">GPM: Rp {Math.round(v.rpm).toLocaleString('id-ID')}</div>}
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-semibold text-slate-700 text-sm">{v.vidViews.toLocaleString('id-ID')} <span className="text-[11px] font-normal text-slate-500">views</span></div>
                        <div className="text-[12px] text-slate-500 mt-0.5">{v.vidLikes.toLocaleString('id-ID')} <span className="text-[10px]">likes</span></div>
                      </td>
                      <td className="p-4 align-top">
                        {hasAccess && (
                           <button 
                             onClick={() => saveVideos(v.ccId)}
                             className="btn btn-primary text-xs w-full py-2 h-auto min-h-0 font-semibold shadow-sm"
                             disabled={isSaving === v.ccId}
                           >
                             {isSaving === v.ccId ? 'Menyimpan...' : 'Simpan'}
                           </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            {hasMoreVideosClient && (
              <div className="flex justify-center mt-[24px]">
                <button onClick={() => setClientPage(p => p + 1)} className="btn btn-outline">
                  <ChevronDown className="ico" />
                  Tampilkan Lebih Banyak
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[400px] p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative">
            <button 
              onClick={() => setPreviewOpen(false)}
              className="absolute top-2 right-2 z-50 p-2 bg-black/50 hover:bg-black text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-full min-h-[500px] flex items-center justify-center bg-black pt-12 pb-4 px-4 overflow-y-auto max-h-[85vh]" ref={previewRef}>
              {previewUrl && (() => {
                const match = previewUrl.match(/video\/(\d+)/);
                const videoId = match ? match[1] : '';
                return videoId ? (
                  <iframe 
                    src={`https://www.tiktok.com/player/v1/${videoId}?music_info=1&description=1`}
                    className="w-full h-[600px] max-w-[325px] rounded-lg"
                    allow="fullscreen"
                    title="TikTok Video Player"
                  ></iframe>
                ) : (
                  <p className="text-white text-sm">ID Video tidak valid</p>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
