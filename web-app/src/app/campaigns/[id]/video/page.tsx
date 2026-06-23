"use client";

import React, { useState, useEffect } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useDraftLocalStorage } from "@/hooks/useDraftLocalStorage";
// Replaced standard UI imports
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import { AlertCircle, Link as LinkIcon, Save, Edit2, Loader2, ChevronDown, Plus } from "lucide-react";
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

  const supabase = createClient();

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.order('id', { ascending: false }).range(from, to);

      const { data, error } = await query;
      if (error) throw error;

      const results = data || [];
      if (isReset) {
        // Handled below with _localSales
      } else {
        // Handled below with _localSales
      }

      setHasMore(results.length === PAGE_SIZE);

      const creatorUsernames = results.map((cc: any) => cc.creators?.username).filter(Boolean);
      let localSalesData: any[] = [];
      if (creatorUsernames.length > 0) {
        const { data: sData } = await supabaseClient
          .from('sales')
          .select('id, campaign_id, creator_username, content_uid, gmv, quantity, raw_data, product_id')
          .eq('campaign_id', campaignId)
          .in('creator_username', creatorUsernames);
        if (sData) localSalesData = sData;
      }

      const allVideosFromDb = results.flatMap((cc: any) => cc.videos || []);
      
      // Auto-detect videos from sales
      const autoVideos: any[] = [];
      results.forEach((cc: any) => {
        const creator = cc.creators;
        if (!creator) return;
        
        const creatorSales = localSalesData.filter((s: any) => s.creator_username === creator.username && s.content_uid);
        const uniqueUids = new Set<string>();
        
        creatorSales.forEach((s: any) => {
          if (!uniqueUids.has(s.content_uid)) {
            uniqueUids.add(s.content_uid);
            
            const existsInDb = allVideosFromDb.some((v: any) => v.content_uid === s.content_uid && v.campaign_creator_id === cc.id);
            if (!existsInDb) {
               // Try to match product_id from sales to skus table
               const matchingSku = skus.find(sku => sku.product_id === s.product_id && sku.campaign_id === campaignId);
               
               autoVideos.push({
                 id: `auto_${s.content_uid}`,
                 campaign_creator_id: cc.id,
                 urutan: 999, // Will be re-assigned later
                 concept: 'Auto-detected from Sales CSV',
                 link_video: `https://www.tiktok.com/@${creator.username}/video/${s.content_uid}`,
                 content_uid: s.content_uid,
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
      
      // We also need to store this localSalesData so the render function can calculate GMV per video
      setListingData(prev => {
         if (isReset) {
            return results.map((cc: any) => ({
                ...cc,
                _localSales: localSalesData.filter((s: any) => s.creator_username === cc.creators?.username)
            }));
         } else {
            const existingIds = new Set(prev.map(p => p.id));
            const newResults = results.filter((r: any) => !existingIds.has(r.id)).map((cc: any) => ({
                ...cc,
                _localSales: localSalesData.filter((s: any) => s.creator_username === cc.creators?.username)
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

  return (
    <div className="space-y-[32px]">
      <div className="flex justify-between items-center mb-[24px] gap-[16px] flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold">Video & VT</h2>
          <p className="text-[13px] text-text-soft">Kelola konsep, link video, dan approval VT untuk kreator yang di-approve.</p>
        </div>
        <div>
          <input 
            type="text" 
            placeholder="Cari username..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="input min-w-[200px]"
          />
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
        ) : (
          <div className="space-y-[48px] pb-[24px]">
            {listingData.map(cc => {
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

              return (
                <div key={cc.id} className="border border-line rounded-[12px] overflow-hidden">
                  <div className="bg-slate-50 p-[16px] border-b border-line flex flex-wrap justify-between items-center gap-[16px]">
                    <div>
                      <h3 className="font-bold text-[16px]">@{creator.username}</h3>
                      <p className="text-[12px] text-text-soft mt-[2px]">Target Video SOW: {cc.qty_vt} | Realita: {localVideos.filter(v => v.campaign_creator_id === cc.id && v.link_video).length}</p>
                    </div>
                    <div className="flex items-center gap-[10px]">
                      {hasAccess && (
                        <>
                          <button 
                            onClick={() => handleAddVideoRow(cc.id)}
                            className="btn btn-outline"
                          >
                            + Tambah Baris
                          </button>
                          <button 
                            onClick={() => handleSaveVT(cc.id)}
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
                  
                  <div className="p-[16px]">
                    <div className="tbl-wrap">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="w-16 text-center">Urutan</th>
                            <th className={isAwareness ? "w-1/3" : "w-1/4"}>{isAwareness ? "Konsep / Ide SOW" : "Konsep / Ide"}</th>
                            <th className={isAwareness ? "w-1/3" : "w-1/4"}>{isAwareness ? "Link Video (Drive/TikTok)" : "Link Video TikTok"}</th>
                            {isAwareness ? (
                              <>
                                <th>Performa Views</th>
                                <th>Produk</th>
                              </>
                            ) : (
                              <>
                                <th>Performa GMV</th>
                                <th>Produk</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {creatorVideos.map((v) => {
                            const warningShortLink = !isAwareness && isShortLink(v.link_video);
                            const hasContentUid = !!v.content_uid;

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
                                    <div className="relative">
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
                                        ✓ Terhubung dengan Content ID: {v.content_uid}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                {isAwareness ? (
                                  <>
                                    <td>
                                      {v.id || hasContentUid ? (
                                        <div className="space-y-[4px]">
                                          <div className="text-[13px] font-bold text-text">
                                            {(() => {
                                              const sales = (cc._localSales || []).filter((s: any) => s.content_uid && v.content_uid && s.content_uid === v.content_uid);
                                              const maxViews = sales.length > 0 ? Math.max(...sales.map((s: any) => parseInt(s.raw_data?.['Video views']?.toString().replace(/[^0-9]/g, '')) || 0)) : 0;
                                              return maxViews > 0 ? maxViews.toLocaleString() : '-';
                                            })()}
                                          </div>
                                          <div className="text-[11px] text-text-soft">Tayangan</div>
                                        </div>
                                      ) : (
                                        <span className="text-[12px] text-text-soft">Simpan video</span>
                                      )}
                                    </td>
                                    <td>
                                      <select 
                                        className="select"
                                        value={v.sku_id || ''}
                                        onChange={(e) => handleVideoChange(cc.id, v.urutan, 'sku_id', e.target.value)}
                                        disabled={!hasAccess}
                                      >
                                        <option value="">Pilih Produk...</option>
                                        {skus.filter(s => s.campaign_id === campaignId).map(sku => (
                                          <option key={sku.id} value={sku.id}>{sku.nama_produk}</option>
                                        ))}
                                      </select>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td>
                                      {v.id || hasContentUid ? (
                                        <div className="space-y-[4px]">
                                          <div className="text-[13px] font-bold text-green-700">
                                            Rp {(cc._localSales || []).filter((s: any) => s.content_uid && v.content_uid && s.content_uid === v.content_uid).reduce((sum: number, row: any) => sum + row.gmv, 0).toLocaleString()}
                                          </div>
                                          <div className="text-[11px] text-text-soft">Organic Sales</div>
                                        </div>
                                      ) : (
                                        <span className="text-[12px] text-text-soft">Simpan video dulu</span>
                                      )}
                                    </td>
                                    <td>
                                      <select 
                                        className="select"
                                        value={v.sku_id || ''}
                                        onChange={(e) => handleVideoChange(cc.id, v.urutan, 'sku_id', e.target.value)}
                                        disabled={!hasAccess}
                                      >
                                        <option value="">Pilih Produk...</option>
                                        {skus.filter(s => s.campaign_id === campaignId).map(sku => (
                                          <option key={sku.id} value={sku.id}>{sku.nama_produk}</option>
                                        ))}
                                      </select>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {hasMore && (
              <div className="flex justify-center mt-[24px]">
                <button onClick={handleLoadMore} className="btn btn-outline" disabled={isLoading}>
                  {isLoading ? <Loader2 className="ico animate-spin" /> : <ChevronDown className="ico" />}
                  Tampilkan Lebih Banyak
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
