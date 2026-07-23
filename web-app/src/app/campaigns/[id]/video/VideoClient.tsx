"use client";

import React, { useState, useEffect } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useDraftLocalStorage } from "@/hooks/useDraftLocalStorage";
// Replaced standard UI imports
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Link as LinkIcon, Save, Edit2, Loader2, ChevronDown, ChevronRight, Plus, PlayCircle, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { useAuth } from "@/providers/AuthProvider";
import { useCampaignFilter } from "@/providers/CampaignFilterProvider";
import { getInternalVideoData } from "../../actions/videoActions";

export default function CampaignVideoPage({
  initialListingData,
  initialVideos
}: {
  initialListingData: any[],
  initialVideos: any[]
}) {
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
  const { isCreatorVisible } = useCampaignFilter();

  const campaign = campaigns.find(c => c.id === campaignId);

  const isAwareness = campaign?.tipe_campaign === 'awareness';

  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [localVideos, setLocalVideos] = useDraftLocalStorage<any[]>(`draft_videos_campaign_${campaignId}`, initialVideos || []);
  const [listingData, setListingData] = useState<any[]>(initialListingData || []);
  const [isLoading, setIsLoading] = useState(false);
  const [expandingLinks, setExpandingLinks] = useState<Record<string, boolean>>({});
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkResults, setBulkResults] = useState<any[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewRef = React.useRef<HTMLDivElement>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<number>>(new Set());
  const [deletingHistory, setDeletingHistory] = useState(false);

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
  const [hasMore, setHasMore] = useState(false);
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
      const data = await getInternalVideoData(campaignId, debouncedSearch);
      if (data) {
        setHasMore(false);
        setListingData(data.listingData);
        
        if (isReset) {
          setLocalVideos(data.allVideos);
        } else {
          setLocalVideos((prev: any[]) => {
            const existingIds = new Set(prev.map(p => p.id));
            return [...prev, ...data.allVideos.filter((v: any) => !existingIds.has(v.id))];
          });
        }
      }
    } catch (e) {
      console.error("Error fetching video data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const [isFirstMount, setIsFirstMount] = useState(true);

  useEffect(() => {
    if (isFirstMount) {
      setIsFirstMount(false);
      return;
    }
    if (campaignId) {
      setPage(0);
      fetchApprovedCreators(0, true);
    }
  }, [debouncedSearch]);

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

  const convertShortLink = async (ccId: number, urutan: number, shortUrl: string, expectedUsername: string) => {
    if (!isShortLink(shortUrl)) return;
    
    const key = `${ccId}_${urutan}`;
    setExpandingLinks(prev => ({ ...prev, [key]: true }));
    
    try {
      const res = await fetch('/api/expand-tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortUrl })
      });
      const data = await res.json();
      
      if (res.ok && data.expandedUrl) {
        const expanded = data.expandedUrl;
        const usernameMatch = expanded.match(/@([^\/]+)/);
        if (usernameMatch && usernameMatch[1].toLowerCase() !== expectedUsername.toLowerCase()) {
           alert(`Peringatan: Video ini milik kreator @${usernameMatch[1]}, bukan @${expectedUsername}!\nLink tidak akan disimpan untuk mencegah salah input.`);
           handleVideoChange(ccId, urutan, 'link_video', '');
        } else {
           handleVideoChange(ccId, urutan, 'link_video', expanded);
        }
      } else {
        alert('Gagal mengekspansi link: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
       alert('Gagal menghubungi server untuk ekspansi link');
    } finally {
       setExpandingLinks(prev => ({ ...prev, [key]: false }));
    }
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
      
      // Ambil ulang data video dari DB untuk kreator ini agar ID terupdate
      const { data: updatedDbVideos } = await supabase.from('videos').select('*').eq('campaign_creator_id', ccId);
      
      // Update local storage dengan data segar dari DB (termasuk ID asli dari auto-detect yang baru disave)
      setLocalVideos((prev: any[]) => {
         const others = prev.filter(v => v.campaign_creator_id !== ccId);
         return [...others, ...(updatedDbVideos || [])];
      });
      
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

  const handleProcessBulk = async () => {
    if (!bulkInput.trim()) return;
    setBulkProcessing(true);
    setBulkResults([]);
    
    // Deduplicate input lines first
    const lines = Array.from(new Set(bulkInput.split('\n').map(l => l.trim()).filter(Boolean)));
    const results: any[] = [];
    
    setBulkTotal(lines.length);
    setBulkProgress(0);

    const assignedLinks = new Set(localVideos.map(v => v.link_video).filter(Boolean));
    const assignedVids = new Set(localVideos.map(v => v.content_uid).filter(Boolean));
    
    let currentProgress = 0;
    const BATCH_SIZE = 3; // Kurangi dari 10 jadi 3 biar ga kena rate limit TikTok
    
    // Fungsi pembantu untuk jeda
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const chunk = lines.slice(i, i + BATCH_SIZE);
      
      const chunkPromises = chunk.map(async (link) => {
        const usernameMatchInitial = link.match(/@([^\/]+)/);
        const videoIdMatchInitial = link.match(/video\/(\d+)/);
        let initialUsername = usernameMatchInitial ? usernameMatchInitial[1].toLowerCase() : undefined;
        let initialVideoId = videoIdMatchInitial ? videoIdMatchInitial[1] : undefined;

        if (assignedLinks.has(link)) {
          return { original: link, username: initialUsername, videoId: initialVideoId, status: 'duplicate', message: 'Link sudah terdaftar di sistem' };
        }
        
        let finalLink = link;
        let isShort = isShortLink(link);
        
        if (isShort) {
          try {
            const res = await fetch('/api/expand-tiktok', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shortUrl: link })
            });
            const data = await res.json();
            if (res.ok && data.expandedUrl) {
              finalLink = data.expandedUrl;
            } else {
              return { original: link, status: 'error', message: 'Gagal konversi link pendek' };
            }
          } catch (e) {
            return { original: link, status: 'error', message: 'Koneksi gagal saat konversi' };
          }
        }

        const usernameMatch = finalLink.match(/@([^\/]+)/);
        const videoIdMatch = finalLink.match(/video\/(\d+)/);
        const username = usernameMatch ? usernameMatch[1].toLowerCase() : undefined;
        const videoId = videoIdMatch ? videoIdMatch[1] : undefined;

        if (assignedLinks.has(finalLink)) {
          return { original: link, expanded: finalLink, username, videoId, status: 'duplicate', message: 'Link sudah terdaftar di sistem' };
        }
        
        if (!username || !videoId) {
          return { original: link, expanded: finalLink, status: 'error', message: 'Format link panjang tidak valid' };
        }
        
        if (assignedVids.has(videoId)) {
          return { original: link, expanded: finalLink, username, videoId, status: 'duplicate', message: 'Video ID sudah terdaftar di sistem' };
        }
        
        const creatorMatch = finalListingData.find((cc: any) => cc.creators?.username.toLowerCase() === username);
        
        if (creatorMatch) {
          return { original: link, expanded: finalLink, username, videoId, status: 'valid', ccId: creatorMatch.id, message: 'Siap ditambahkan' };
        } else {
          return { original: link, expanded: finalLink, username, videoId, status: 'valid_new_creator', message: 'Otomatis Ditambah (Auto-Detect)' };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      
      for (const res of chunkResults) {
        if (res.status === 'valid' || res.status === 'valid_new_creator') {
          if (res.expanded) assignedLinks.add(res.expanded);
          if (res.videoId) assignedVids.add(res.videoId);
        }
        results.push(res);
      }
      
      currentProgress += chunk.length;
      setBulkProgress(currentProgress);
      
      // Kasih jeda 1 detik tiap batch biar TikTok ga nge-block IP server (Error 429)
      if (i + BATCH_SIZE < lines.length) {
         await delay(1000);
      }
    }
    
    setBulkResults(results);
    setBulkProcessing(false);
  };

  const handleSaveBulk = async () => {
    const validExisting = bulkResults.filter(r => r.status === 'valid');
    const validNewCreator = bulkResults.filter(r => r.status === 'valid_new_creator');
    
    if (validExisting.length === 0 && validNewCreator.length === 0) return;
    
    setBulkProcessing(true);
    const supabaseClient = createClient();
    const newDbEntries: any[] = [];
    const ccIdGroups: Record<number, any[]> = {};
    
    validExisting.forEach(r => {
       if (!ccIdGroups[r.ccId]) ccIdGroups[r.ccId] = [];
       ccIdGroups[r.ccId].push(r);
    });

    if (validNewCreator.length > 0) {
      try {
        const newUsernames = Array.from(new Set(validNewCreator.map(r => r.username)));
        for (const username of newUsernames) {
           let creatorId = null;
           const { data: existingCreator } = await supabaseClient.from('creators').select('id').eq('username', username).maybeSingle();
           
           if (existingCreator) {
              creatorId = existingCreator.id;
           } else {
              const { data: insertedCreator } = await supabaseClient.from('creators').insert({
                 username: username,
                 source: 'Bulk Import Video'
              }).select('id').single();
              if (insertedCreator) creatorId = insertedCreator.id;
           }
           
           if (creatorId) {
             const { data: newCc } = await supabaseClient.from('campaign_creators').insert({
                campaign_id: campaignId,
                creator_id: creatorId,
                tier: 'Auto-Detect',
                approval: 'pending',
                client_approval: 'not_required',
                status_bayar: 'belum',
                qty_vt: validNewCreator.filter(r => r.username === username).length,
                price: 0
             }).select('id').single();
             
             if (newCc) {
                const newCcId = newCc.id;
                ccIdGroups[newCcId] = validNewCreator.filter(r => r.username === username);
             }
           }
        }
      } catch (err) {
        console.error('Error creating new creators:', err);
      }
    }
    
    for (const ccIdStr of Object.keys(ccIdGroups)) {
       const ccId = Number(ccIdStr);
       const creatorVideos = localVideos.filter(v => v.campaign_creator_id === ccId);
       let nextUrutan = creatorVideos.length > 0 ? Math.max(...creatorVideos.map(v => v.urutan)) + 1 : 1;
       
       for (const r of ccIdGroups[ccId]) {
          newDbEntries.push({
            campaign_creator_id: ccId,
            urutan: nextUrutan,
            concept: '',
            link_video: r.expanded,
            content_uid: r.videoId,
            vt_approval: r.status === 'valid_new_creator' ? 'pending' : 'approved'
          });
          nextUrutan++;
       }
    }
    
    try {
      if (newDbEntries.length > 0) {
        await supabaseClient.from('videos').insert(newDbEntries);
        await fetchData();
        const ccIds = Object.keys(ccIdGroups).map(Number);
        const { data: updatedDbVideos } = await supabaseClient.from('videos').select('*').in('campaign_creator_id', ccIds);
        
        setLocalVideos((prev: any[]) => {
           const others = prev.filter(v => !ccIds.includes(v.campaign_creator_id));
           return [...others, ...(updatedDbVideos || [])];
        });
        
        alert(`Berhasil menyimpan ${newDbEntries.length} video baru!`);
        setBulkImportOpen(false);
        setBulkInput('');
        setBulkResults([]);
      }
    } catch (err: any) {
      alert('Gagal menyimpan massal: ' + err.message);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleDeleteHistoryBatch = async () => {
    if (selectedHistoryIds.size === 0) return;
    if (!confirm(`Yakin ingin menghapus ${selectedHistoryIds.size} video dari database? Tindakan ini tidak dapat dibatalkan.`)) return;

    setDeletingHistory(true);
    try {
      const idsToDelete = Array.from(selectedHistoryIds);
      const { error } = await supabase.from('videos').delete().in('id', idsToDelete);
      
      if (error) throw error;
      
      setLocalVideos(prev => prev.filter(v => !selectedHistoryIds.has(v.id)));
      setSelectedHistoryIds(new Set());
      alert(`Berhasil menghapus ${idsToDelete.length} video.`);
    } catch (err: any) {
      alert('Gagal menghapus video: ' + err.message);
    } finally {
      setDeletingHistory(false);
    }
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    setPage(0);
    setListingData([]);
  };

  const processedListingData = React.useMemo(() => {
    let data = [...listingData];
    
    // Apply Global Creator Filter
    data = data.filter((cc: any) => isCreatorVisible(cc.creators?.username));

    const metricsMap = new Map();
    data.forEach(cc => {
       const creator = cc.creators;
       if (!creator) return;
       
       let creatorVideos = localVideos.filter(v => v.campaign_creator_id === cc.id);
       const uploadedVtCount = creatorVideos.filter(v => v.link_video).length;
       const targetVt = cc.qty_vt || 0;
       
       const vStats = cc._videoStats || [];
       let totalGmv = 0;
       let totalViews = 0;
       let totalLikes = 0;

       const validContentUids = new Set(
           creatorVideos
               .map(v => {
                   if (v.content_uid) return v.content_uid;
                   if (v.link_video) {
                       const match = v.link_video.match(/video\/(\d+)/);
                       if (match) return match[1];
                   }
                   return null;
               })
               .filter(Boolean)
       );

       vStats.forEach((s: any) => {
          if (s.content_uid && validContentUids.has(s.content_uid)) {
             totalGmv += (s.gmv || 0);
             totalViews += (s.views || 0);
             totalLikes += (s.likes || 0);
          }
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
          const vStats = cc._videoStats || [];
          return vStats.some((s: any) => s.product_id === filterSku);
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
  }, [listingData, localVideos, skus, campaignId, filterSow, filterSales, filterSku, sortBy, isCreatorVisible]);

  const { data: finalListingData, metricsMap } = processedListingData;
  const visibleData = finalListingData.slice(0, clientPage * CLIENT_PAGE_SIZE);
  const hasMoreClient = finalListingData.length > visibleData.length;

  const processedVideosData = React.useMemo(() => {
    let allVids: any[] = [];
    
    localVideos.forEach(v => {
       const cc = listingData.find(c => c.id === v.campaign_creator_id);
       if (!cc || !cc.creators || !isCreatorVisible(cc.creators.username)) return;
       
       const creator = cc.creators;
       const vStats = cc._videoStats || [];
       
       const hasContentUid = v.content_uid && v.content_uid !== '';
       const dynamicContentUid = hasContentUid ? v.content_uid : null;
       
       let vidGmv = 0;
       let vidViews = 0;
       let vidLikes = 0;
       
       if (hasContentUid) {
          const matchingStat = vStats.find((s: any) => s.content_uid === dynamicContentUid);
          if (matchingStat) {
              vidGmv = matchingStat.gmv || 0;
              vidViews = matchingStat.views || 0;
              vidLikes = matchingStat.likes || 0;
          }
       }
       
       const rpm = vidViews > 0 ? (vidGmv / vidViews) * 1000 : 0;
       
       // Filter out empty "Tambah Baris" that haven't been filled if in "Semua Video" mode
       if (!v.link_video && !v.content_uid && v.concept === '') return;

       allVids.push({
          ...v,
          creatorUsername: creator.username,
          creatorTier: cc.tier,
          creatorId: creator.id,
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
  }, [localVideos, listingData, metricsMap, filterSow, filterSales, filterSku, sortBy, isCreatorVisible]);

  const visibleVideosData = processedVideosData.slice(0, clientPage * CLIENT_PAGE_SIZE);
  const hasMoreVideosClient = processedVideosData.length > visibleVideosData.length;

  const historyVideos = React.useMemo(() => {
    if (!historyOpen) return [];
    const videos = localVideos.filter(v => typeof v.id === 'number' && v.created_at);
    videos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return videos.map(v => {
      const cc = listingData.find(c => c.id === v.campaign_creator_id);
      return {
        ...v,
        creatorUsername: cc?.creators?.username || '-',
        creatorName: cc?.creators?.nama_asli || '-'
      };
    });
  }, [localVideos, listingData, historyOpen]);
  const HISTORY_PAGE_SIZE = 15;
  const paginatedHistoryVideos = historyVideos.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE);
  const totalHistoryPages = Math.ceil(historyVideos.length / HISTORY_PAGE_SIZE);

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
             <div className="flex justify-between items-start gap-4">
               <div className="flex bg-white rounded-md border border-slate-200 overflow-hidden w-fit h-fit">
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
               {hasAccess && (
                 <div className="flex items-center gap-2">
                   <button onClick={() => {
                     setHistoryOpen(true);
                     setHistoryPage(0);
                     setSelectedHistoryIds(new Set());
                   }} className="btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap h-fit">
                      Aktivitas Import Terakhir
                   </button>
                   <button onClick={() => setBulkImportOpen(true)} className="btn btn-primary flex items-center gap-2 whitespace-nowrap h-fit">
                      <Plus className="w-4 h-4" /> Bulk Import Link
                   </button>
                 </div>
               )}
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
                      <div onClick={(e) => e.stopPropagation()}>
                        <Link href={`/creator-pool/${creator.id}`} className="font-bold text-[16px] hover:text-indigo-600 hover:underline transition-colors">
                          @{creator.username}
                        </Link>
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
                               const vStats = cc._videoStats || [];
                               const matchingStat = vStats.find((s: any) => s.content_uid === dynamicContentUid);
                               if (matchingStat) {
                                  vidGmv = matchingStat.gmv || 0;
                                  vidViews = matchingStat.views || 0;
                                  vidLikes = matchingStat.likes || 0;
                               }
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
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            handleVideoChange(cc.id, v.urutan, 'link_video', val);
                                            if (isShortLink(val)) {
                                              convertShortLink(cc.id, v.urutan, val, cc.creators.username);
                                            }
                                          }}
                                          disabled={!hasAccess || expandingLinks[`${cc.id}_${v.urutan}`]}
                                        />
                                        {expandingLinks[`${cc.id}_${v.urutan}`] && <Loader2 className="w-4 h-4 absolute right-[10px] top-[10px] animate-spin text-indigo-500" />}
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
                    <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="p-4 align-top">
                        <div>
                          <Link href={`/creator-pool/${v.creatorId}`} className="font-bold text-sm hover:text-indigo-600 hover:underline transition-colors">
                            @{v.creatorUsername}
                          </Link>
                        </div>
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
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleVideoChange(v.ccId, v.urutan, 'link_video', val);
                                    if (isShortLink(val)) {
                                      convertShortLink(v.ccId, v.urutan, val, v.creatorUsername);
                                    }
                                  }}
                                  disabled={!hasAccess || expandingLinks[`${v.ccId}_${v.urutan}`]}
                                />
                                {expandingLinks[`${v.ccId}_${v.urutan}`] && <Loader2 className="w-4 h-4 absolute right-[10px] top-[10px] animate-spin text-indigo-500" />}
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
                             onClick={() => handleSaveVT(v.ccId)}
                             className="btn btn-primary text-xs w-full py-2 h-auto min-h-0 font-semibold shadow-sm"
                             disabled={saving[v.ccId]}
                           >
                             {saving[v.ccId] ? 'Menyimpan...' : 'Simpan'}
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

      <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <div className="p-6 border-b border-line shrink-0">
            <h2 className="text-xl font-bold">Bulk Import Link Video</h2>
            <p className="text-sm text-text-soft mt-1">Paste puluhan link video (termasuk vt.tiktok.com) dari Excel. Sistem akan otomatis konversi dan deteksi pemilik video.</p>
          </div>
          
          <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Paste Link di Sini (Satu baris per link)</label>
              <textarea 
                className="input w-full min-h-[150px] font-mono text-sm leading-relaxed" 
                placeholder="https://vt.tiktok.com/ZSxxxx/&#10;https://www.tiktok.com/@creator/video/123456789"
                value={bulkInput}
                onChange={e => setBulkInput(e.target.value)}
                disabled={bulkProcessing}
              />
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={handleProcessBulk} 
                disabled={!bulkInput.trim() || bulkProcessing}
                className="btn btn-primary"
              >
                {bulkProcessing && bulkResults.length === 0 ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {bulkProcessing ? `Memproses ${bulkProgress}/${bulkTotal} Link...` : `Proses ${bulkInput.split('\n').filter(l => l.trim()).length} Link`}
              </button>
            </div>
            
            {bulkResults.length > 0 && (
              <div className="ccard !p-0 overflow-hidden bg-white border border-slate-200">
                <div className="p-4 border-b border-line flex justify-between items-center bg-slate-100">
                  <h3 className="font-semibold text-sm">Hasil Verifikasi</h3>
                  <div className="flex gap-4 text-xs font-medium">
                    <span className="text-emerald-600">✅ {bulkResults.filter(r => r.status === 'valid').length} Valid</span>
                    <span className="text-red-600">❌ {bulkResults.filter(r => r.status !== 'valid').length} Invalid/Duplikat</span>
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 sticky top-0 shadow-sm">
                      <tr>
                        <th className="p-3 font-semibold w-[40%]">Original Link</th>
                        <th className="p-3 font-semibold">Kreator</th>
                        <th className="p-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {bulkResults.map((r, i) => (
                        <tr key={i} className={r.status === 'valid' ? 'bg-emerald-50/30' : 'bg-red-50/30'}>
                          <td className="p-3">
                            <div className="font-mono text-[11px] truncate max-w-[300px] text-slate-700" title={r.original}>{r.original}</div>
                            {r.expanded && r.expanded !== r.original && (
                              <div className="font-mono text-[10px] text-text-soft truncate max-w-[300px] mt-1" title={r.expanded}>→ {r.expanded}</div>
                            )}
                          </td>
                          <td className="p-3">
                            {r.username ? <span className="font-medium text-[12px] text-slate-700">@{r.username}</span> : <span className="text-slate-400 italic text-[12px]">-</span>}
                          </td>
                          <td className="p-3">
                            {r.status === 'valid' ? (
                              <span className="text-emerald-600 font-medium text-[11px] flex items-center gap-1">
                                ✅ Siap ditambahkan
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium text-[11px] flex items-center gap-1">
                                ❌ {r.message}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-line flex justify-between items-center bg-white shrink-0">
             <button onClick={() => setBulkImportOpen(false)} className="btn btn-outline">Tutup</button>
             {bulkResults.filter(r => r.status === 'valid').length > 0 && (
               <button 
                  onClick={handleSaveBulk} 
                  disabled={bulkProcessing}
                  className="btn btn-primary"
               >
                 {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                 Simpan {bulkResults.filter(r => r.status === 'valid').length} Link ke Database
               </button>
             )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white">
          <div className="p-6 border-b border-line flex justify-between items-center bg-white shrink-0">
            <h2 className="text-xl font-bold">Aktivitas Import Video Terbaru</h2>
            <button onClick={() => setHistoryOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto bg-slate-50 p-6">
            <div className="ccard !p-0 overflow-hidden bg-white border border-slate-200">
              <div className="p-4 border-b border-line flex justify-between items-center bg-slate-100">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-sm">Riwayat Upload</h3>
                  <span className="text-xs text-text-soft">Total: {historyVideos.length} video</span>
                </div>
                {selectedHistoryIds.size > 0 && (
                  <button 
                    onClick={handleDeleteHistoryBatch}
                    disabled={deletingHistory}
                    className="btn bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    {deletingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Hapus Terpilih & Simpan ({selectedHistoryIds.size})
                  </button>
                )}
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-line">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                        checked={paginatedHistoryVideos.length > 0 && selectedHistoryIds.size === paginatedHistoryVideos.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSet = new Set(selectedHistoryIds);
                            paginatedHistoryVideos.forEach(v => newSet.add(v.id));
                            setSelectedHistoryIds(newSet);
                          } else {
                            const newSet = new Set(selectedHistoryIds);
                            paginatedHistoryVideos.forEach(v => newSet.delete(v.id));
                            setSelectedHistoryIds(newSet);
                          }
                        }}
                      />
                    </th>
                    <th className="p-3 font-semibold">Waktu Masuk</th>
                    <th className="p-3 font-semibold">Kreator</th>
                    <th className="p-3 font-semibold">Link Video</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paginatedHistoryVideos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 italic">Belum ada riwayat video.</td>
                    </tr>
                  ) : paginatedHistoryVideos.map((v, i) => (
                    <tr key={v.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                          checked={selectedHistoryIds.has(v.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedHistoryIds);
                            if (e.target.checked) newSet.add(v.id);
                            else newSet.delete(v.id);
                            setSelectedHistoryIds(newSet);
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-700">{new Date(v.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <div className="text-xs text-text-soft">{new Date(v.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-700">{v.creatorName}</div>
                        <div className="text-xs text-text-soft">@{v.creatorUsername}</div>
                      </td>
                      <td className="p-3">
                        <a href={v.link_video} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-blue-600 hover:underline break-all block max-w-[300px]">
                          {v.link_video}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalHistoryPages > 1 && (
                <div className="p-3 border-t border-line flex justify-between items-center bg-slate-50">
                  <button 
                    disabled={historyPage === 0}
                    onClick={() => setHistoryPage(p => p - 1)}
                    className="btn btn-outline text-xs py-1 px-2"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-xs text-slate-500">
                    Halaman {historyPage + 1} dari {totalHistoryPages}
                  </span>
                  <button 
                    disabled={historyPage >= totalHistoryPages - 1}
                    onClick={() => setHistoryPage(p => p + 1)}
                    className="btn btn-outline text-xs py-1 px-2"
                  >
                    Selanjutnya
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
