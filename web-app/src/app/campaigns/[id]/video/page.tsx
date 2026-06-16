"use client";

import React, { useState, useEffect } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useDraftLocalStorage } from "@/hooks/useDraftLocalStorage";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import { AlertCircle, Link as LinkIcon, Save, Edit2, Loader2 } from "lucide-react";

export default function CampaignVideoPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  
  const { 
    creators, 
    videos,
    sales,
    fetchData,
    campaigns
  } = useDatabaseStore();

  const campaign = campaigns.find(c => c.id === campaignId);

  const isAwareness = campaign?.tipe_campaign === 'awareness';

  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [localVideos, setLocalVideos] = useDraftLocalStorage<any[]>(`draft_videos_campaign_${campaignId}`, []);
  const [listingData, setListingData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    const fetchApprovedCreators = async () => {
      setIsLoading(true);
      let allApproved: any[] = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      const supabaseClient = createClient();

      while (hasMore) {
        let query = supabaseClient
          .from('campaign_creators')
          .select('*, creators!inner(*), videos(*)')
          .eq('campaign_id', campaignId)
          .eq('approval', 'approved')
          .range(from, to);

        if (campaign?.require_client_approval) {
          query = query.eq('client_approval', 'approved');
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching approved creators:", error);
          break;
        }

        if (data && data.length > 0) {
          allApproved = [...allApproved, ...data];
          if (data.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
            to += 1000;
          }
        } else {
          hasMore = false;
        }
      }

      setListingData(allApproved);
      const allVideos = allApproved.flatMap(cc => cc.videos || []);
      
      setLocalVideos((prev: any[]) => prev && prev.length > 0 ? prev : allVideos);
      setIsLoading(false);
    };

    if (campaignId) {
      fetchApprovedCreators();
    }
  }, [campaignId, campaign?.require_client_approval]);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = listingData.filter(cc => {
    if (searchQuery) {
      const creator = cc.creators;
      if (!creator || !creator.username.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

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
      
      for (const v of creatorVideos) {
        if (v.id) {
          await supabase.from('videos').update({
            concept: v.concept,
            link_video: v.link_video,
            content_uid: v.content_uid,
            vt_approval: v.vt_approval
          }).eq('id', v.id);
        } else {
          if (v.concept || v.link_video) {
            await supabase.from('videos').insert({
              campaign_creator_id: ccId,
              urutan: v.urutan,
              concept: v.concept,
              link_video: v.link_video,
              content_uid: v.content_uid,
              vt_approval: v.vt_approval
            });
          }
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
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Video & VT</h2>
          <p className="text-sm text-slate-500">Kelola konsep, link video, dan approval VT untuk kreator yang di-approve.</p>
        </div>
        <div>
          <input 
            type="text" 
            placeholder="Cari username..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="p-2 border border-slate-300 rounded-md text-sm min-w-[200px]"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm p-6">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">
            Memuat data creator...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Belum ada creator yang berstatus "Approved" di campaign ini.
          </div>
        ) : (
          <div className="space-y-12">
            {filteredData.map(cc => {
              const creator = cc.creators;
              if (!creator) return null;
              
              let creatorVideos = localVideos.filter(v => v.campaign_creator_id === cc.id);
              creatorVideos.sort((a, b) => a.urutan - b.urutan);
              if (creatorVideos.length === 0) {
                creatorVideos = [{ campaign_creator_id: cc.id, urutan: 1, concept: '', link_video: '', vt_approval: 'pending' }];
              }

              return (
                <div key={cc.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">@{creator.username}</h3>
                      <p className="text-sm text-slate-500">Target Video SOW: {cc.qty_vt} | Realita: {localVideos.filter(v => v.campaign_creator_id === cc.id && v.link_video).length}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button 
                        variant="outline"
                        onClick={() => handleAddVideoRow(cc.id)}
                        className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        + Tambah Baris
                      </Button>
                      <Button 
                        onClick={() => handleSaveVT(cc.id)}
                        disabled={saving[cc.id]}
                        className="gap-2"
                      >
                        {saving[cc.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving[cc.id] ? 'Menyimpan...' : 'Simpan Perubahan'}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Urutan</TableHead>
                          <TableHead className={isAwareness ? "w-1/3" : "w-1/4"}>{isAwareness ? "Konsep / Ide SOW" : "Konsep / Ide"}</TableHead>
                          <TableHead className={isAwareness ? "w-1/3" : "w-1/4"}>{isAwareness ? "Link Video (Drive/TikTok)" : "Link Video TikTok"}</TableHead>
                          {isAwareness ? (
                            <>
                              <TableHead>Performa Views</TableHead>
                              <TableHead>Tanggal Live</TableHead>
                            </>
                          ) : (
                            <TableHead>Performa GMV</TableHead>
                          )}
                          <TableHead>Approval</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {creatorVideos.map((v) => {
                          const warningShortLink = !isAwareness && isShortLink(v.link_video);
                          const hasContentUid = !!v.content_uid;

                          return (
                            <TableRow key={v.urutan}>
                              <TableCell className="font-medium text-center">{v.urutan}</TableCell>
                              <TableCell>
                                <textarea 
                                  className="w-full p-2 border border-slate-300 rounded text-sm min-h-[60px]"
                                  placeholder={isAwareness ? "Tulis brief/konsep..." : "Tulis ide konsep..."}
                                  value={v.concept || ''}
                                  onChange={(e) => handleVideoChange(cc.id, v.urutan, 'concept', e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="space-y-2">
                                  <div className="relative">
                                    <LinkIcon className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
                                    <input 
                                      type="text"
                                      className={`w-full pl-8 p-2 border rounded text-sm ${warningShortLink ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                                      placeholder={isAwareness ? "https://..." : "https://www.tiktok.com/@..."}
                                      value={v.link_video || ''}
                                      onChange={(e) => handleVideoChange(cc.id, v.urutan, 'link_video', e.target.value)}
                                    />
                                  </div>
                                  {warningShortLink && (
                                    <p className="text-[10px] text-amber-600 flex items-start gap-1">
                                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                      Sistem tidak bisa melacak GMV dari link pendek (vt.tiktok.com). Harap buka link ini di PC lalu copy link panjangnya.
                                    </p>
                                  )}
                                  {v.link_video && !warningShortLink && !hasContentUid && !isAwareness && (
                                    <p className="text-[10px] text-red-500 flex items-start gap-1">
                                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                      Format link salah. Content ID (19 digit) tidak ditemukan.
                                    </p>
                                  )}
                                  {hasContentUid && !isAwareness && (
                                    <p className="text-[10px] text-green-600 flex items-center gap-1">
                                      ✓ Terhubung dengan Content ID: {v.content_uid}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              {isAwareness ? (
                                <>
                                  <TableCell>
                                    {v.id ? (
                                      <div className="space-y-1">
                                        <div className="text-sm font-semibold text-slate-700">-</div>
                                        <div className="text-[10px] text-slate-500">Tayangan</div>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400">Simpan video</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm text-slate-600">-</span>
                                  </TableCell>
                                </>
                              ) : (
                                <TableCell>
                                  {v.id ? (
                                    <div className="space-y-1">
                                      <div className="text-sm font-semibold text-green-700">
                                        Rp {sales.filter(s => s.content_uid && v.content_uid && s.content_uid === v.content_uid).reduce((sum, row) => sum + row.gmv, 0).toLocaleString()}
                                      </div>
                                      <div className="text-[10px] text-slate-500">Organic Sales</div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">Simpan video dulu</span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell>
                                <select 
                                  className={`w-full p-2 border rounded text-sm font-medium ${
                                    v.vt_approval === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : 
                                    v.vt_approval === 'reject' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                                  }`}
                                  value={v.vt_approval || 'pending'}
                                  onChange={(e) => handleVideoChange(cc.id, v.urutan, 'vt_approval', e.target.value)}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="approved">Approved</option>
                                  <option value="reject">Reject</option>
                                </select>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
