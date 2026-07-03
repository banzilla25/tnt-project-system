"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Calendar, Trash2, Plus, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export default function LiveSchedulePage() {
  const { id } = useParams();
  const campaignId = Number(id);

  const {
    campaign_creators,
    creators,
    live_schedules,
    fetchLiveSchedules,
    addLiveSchedule,
    deleteLiveSchedule,
    isLoading,
    campaigns,
    skus
  } = useDatabaseStore();

  const campaign = campaigns.find(c => c.id === campaignId);

  const [dateInputs, setDateInputs] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const [localCreators, setLocalCreators] = useState<any[]>([]);
  const [isFetchingCC, setIsFetchingCC] = useState(true);
  
  const [actualLives, setActualLives] = useState<any[]>([]);
  const [actualLiveProducts, setActualLiveProducts] = useState<any[]>([]);

  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'username', dir: 'asc' });

  const toggleSort = (key: string) => {
    setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig.key !== col) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-400" />;
    return sortConfig.dir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-blue-500" /> : <ArrowDown className="w-3 h-3 ml-1 text-blue-500" />;
  };

  useEffect(() => {
    fetchLiveSchedules(campaignId);
  }, [campaignId, fetchLiveSchedules]);

  useEffect(() => {
    const fetchCCs = async () => {
      if (!campaignId) return;
      setIsFetchingCC(true);
      let all: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        let query = supabase
          .from('campaign_creators')
          .select('*, creators(*)')
          .eq('campaign_id', campaignId)
          .in('approval', ['approved', 'alternate'])
          .ilike('content_type', '%Live%');
          
        if (campaign?.require_client_approval) {
          query = query.eq('client_approval', 'approved');
        }

        const { data } = await query.range(from, from + 999);
        if (data && data.length > 0) {
          all = [...all, ...data];
          if (data.length < 1000) hasMore = false;
          else from += 1000;
        } else {
          hasMore = false;
        }
      }
      setLocalCreators(all);
      setIsFetchingCC(false);
    };
    fetchCCs();
  }, [campaignId, campaign?.require_client_approval]);

  useEffect(() => {
    const fetchActualLives = async () => {
      if (!campaignId || localCreators.length === 0) return;
      
      const usernames = localCreators.map(cc => cc.creators?.username).filter(Boolean);
      if (usernames.length === 0) return;
      
      const fetchAll = async (baseQuery: any) => {
        let all: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await baseQuery.range(from, from + 999);
          if (error) break;
          if (!data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < 1000) break;
          from += 1000;
        }
        return all;
      };

      // Fetch live sessions in chunks to avoid URL too long and bypass 1000 limit
      let allSessions: any[] = [];
      const chunkSize = 200;
      for (let i = 0; i < usernames.length; i += chunkSize) {
        const chunk = usernames.slice(i, i + chunkSize);
        const chunkSessions = await fetchAll(supabase
          .from('live_sessions')
          .select('*')
          .in('creator_username', chunk));
        allSessions = allSessions.concat(chunkSessions);
      }
        
      if (allSessions && allSessions.length > 0) {
        setActualLives(allSessions);
        
        const roomIds = allSessions.map(s => s.livestream_room_id).filter(Boolean);
        const uniqueRoomIds = Array.from(new Set(roomIds));
        
        let allProducts: any[] = [];
        for (let i = 0; i < uniqueRoomIds.length; i += chunkSize) {
          const chunk = uniqueRoomIds.slice(i, i + chunkSize);
          const chunkProducts = await fetchAll(supabase
            .from('live_session_products')
            .select('*')
            .in('livestream_room_id', chunk));
          allProducts = allProducts.concat(chunkProducts);
        }
          
        if (allProducts && allProducts.length > 0) {
          setActualLiveProducts(allProducts);
        }
      }
    };
    
    fetchActualLives();
  }, [campaignId, localCreators]);

  const approvedCCs = localCreators
    .filter(cc => {
      if (searchQuery) {
        if (!cc.creators?.username.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dir = sortConfig.dir === 'asc' ? 1 : -1;
      if (sortConfig.key === 'username') {
        return (a.creators?.username || '').localeCompare(b.creators?.username || '') * dir;
      }
      if (sortConfig.key === 'jadwal') {
        const countA = live_schedules.filter(l => l.campaign_creator_id === a.id).length;
        const countB = live_schedules.filter(l => l.campaign_creator_id === b.id).length;
        return (countA - countB) * dir;
      }
      return 0;
    });

  const handleAddSchedule = async (ccId: number) => {
    const date = dateInputs[ccId];
    if (!date) return;

    setIsSaving(prev => ({ ...prev, [ccId]: true }));
    await addLiveSchedule({
      campaign_creator_id: ccId,
      tanggal_live: date
    });
    
    // Clear input
    setDateInputs(prev => ({ ...prev, [ccId]: "" }));
    setIsSaving(prev => ({ ...prev, [ccId]: false }));
  };

  const handleDelete = async (scheduleId: number) => {
    if (confirm("Hapus jadwal live ini?")) {
      await deleteLiveSchedule(scheduleId);
    }
  };

  if (isLoading && live_schedules.length === 0) {
    return <div className="p-8 text-center text-slate-500">Memuat jadwal live...</div>;
  }

  return (
    <div className="space-y-[24px] pb-[80px]">
      <div className="ccard !p-0 overflow-hidden">
        <div className="p-[16px] border-b border-line flex flex-col md:flex-row items-start md:items-center justify-between gap-[16px] bg-slate-50">
          <h3 className="font-semibold text-text text-[16px] flex items-center gap-[8px]">
            <Calendar className="w-5 h-5 text-blue-600" />
            Jadwal Live Kreator
          </h3>
          <input 
            type="text" 
            placeholder="Cari username..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="input min-w-[200px]"
          />
        </div>
        <div className="tbl-wrap !border-0 !rounded-none">
          <table className="w-full">
            <thead className="border-b border-line bg-slate-50">
              <tr>
                <th className="w-64 py-[16px] px-[16px] text-left">
                  <button onClick={() => toggleSort('username')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                    Kreator <SortIcon col="username" />
                  </button>
                </th>
                <th className="py-[16px] px-[16px] text-left">
                  <button onClick={() => toggleSort('jadwal')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                    Jadwal & Realisasi Live <SortIcon col="jadwal" />
                  </button>
                </th>
                <th className="w-64 py-[16px] px-[16px] text-left">Tambah Jadwal</th>
              </tr>
            </thead>
            <tbody>
              {approvedCCs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-text-soft">
                    Belum ada kreator yang di-approve di campaign ini.
                  </td>
                </tr>
              ) : (
                approvedCCs.map((cc) => {
                  const creator = cc.creators;
                  const schedules = live_schedules.filter(l => l.campaign_creator_id === cc.id).sort((a, b) => new Date(a.tanggal_live).getTime() - new Date(b.tanggal_live).getTime());

                  // Get actual lives for this creator
                  const creatorLives = actualLives.filter(l => l.creator_username === creator?.username);

                  return (
                    <tr key={cc.id} className="border-b border-line hover:bg-slate-50/50">
                      <td className="align-top px-[16px] py-[16px]">
                        <div className="font-medium text-text">@{creator?.username}</div>
                        <span className="inline-block mt-[4px] px-[8px] py-[2px] border border-line rounded-[4px] text-[10px] font-semibold text-text-soft uppercase bg-slate-100">{cc.approval}</span>
                      </td>
                      <td className="align-top px-[16px] py-[16px]">
                        {schedules.length === 0 ? (
                          <span className="text-[13px] text-text-soft italic">Belum ada jadwal live</span>
                        ) : (
                          <div className="flex flex-col gap-[12px]">
                            {schedules.map(schedule => {
                              const scheduledDate = new Date(schedule.tanggal_live).toISOString().substring(0, 10);
                              
                              // Check if there are lives on this date
                              const livesOnDate = creatorLives.filter(l => l.start_time && l.start_time.startsWith(scheduledDate));
                              
                              let totalViews = 0;
                              let campaignGmv = 0;
                              
                              if (livesOnDate.length > 0) {
                                totalViews = livesOnDate.reduce((sum, l) => sum + (l.live_views || 0), 0);
                                
                                const roomIds = livesOnDate.map(l => l.livestream_room_id);
                                const products = actualLiveProducts.filter(p => roomIds.includes(p.livestream_room_id));
                                
                                // Calculate GMV strictly for this campaign
                                products.forEach(p => {
                                  if (p.product_id && skus.find(s => s.product_id === p.product_id && s.campaign_id === campaignId)) {
                                    campaignGmv += (p.gmv || 0);
                                  }
                                });
                              }

                              const isDone = livesOnDate.length > 0;
                              // Check if past (ignoring time by just using date string comparison)
                              const todayDate = new Date().toISOString().substring(0, 10);
                              const isPast = scheduledDate < todayDate;

                              return (
                                <div key={schedule.id} className={`flex items-start gap-[12px] p-3 rounded-lg border ${isDone ? 'bg-green-50 border-green-200' : isPast ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                                  <div className="mt-0.5">
                                    {isDone ? (
                                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    ) : isPast ? (
                                      <XCircle className="w-5 h-5 text-red-500" />
                                    ) : (
                                      <Calendar className="w-5 h-5 text-blue-500" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className={`text-[14px] font-semibold ${isDone ? 'text-green-800' : isPast ? 'text-red-800' : 'text-blue-800'}`}>
                                        {new Date(schedule.tanggal_live).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                      </span>
                                      <button onClick={() => handleDelete(schedule.id)} className="text-slate-400 hover:text-red-600 p-1">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                    
                                    {isDone ? (
                                      <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-green-700 bg-white/50 p-2 rounded">
                                        <div>
                                          <div className="text-xs opacity-70">Total Views</div>
                                          <div className="font-semibold">{totalViews.toLocaleString('id-ID')}</div>
                                        </div>
                                        <div>
                                          <div className="text-xs opacity-70">GMV Campaign</div>
                                          <div className="font-semibold">Rp {campaignGmv.toLocaleString('id-ID')}</div>
                                        </div>
                                      </div>
                                    ) : isPast ? (
                                      <div className="mt-1 text-sm text-red-600 italic">
                                        Kreator tidak melakukan Live pada jadwal ini (Tidak ada data terdeteksi).
                                      </div>
                                    ) : (
                                      <div className="mt-1 text-sm text-blue-600">
                                        Menunggu pelaksanaan Live...
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="align-top px-[16px] py-[16px]">
                        <div className="flex gap-[8px]">
                          <input
                            type="date"
                            className="input flex-1 !py-[6px]"
                            value={dateInputs[cc.id] || ""}
                            onChange={e => setDateInputs(prev => ({ ...prev, [cc.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => handleAddSchedule(cc.id)}
                            disabled={!dateInputs[cc.id] || isSaving[cc.id]}
                            className="btn btn-primary !py-[6px] !px-[12px] flex items-center justify-center disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
