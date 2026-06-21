"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Calendar, Trash2, Plus, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
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
    campaigns
  } = useDatabaseStore();

  const campaign = campaigns.find(c => c.id === campaignId);

  const [dateInputs, setDateInputs] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const [localCreators, setLocalCreators] = useState<any[]>([]);
  const [isFetchingCC, setIsFetchingCC] = useState(true);
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
          .in('approval', ['approved', 'alternate']);
          
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
                <th className="w-64 py-[16px]">
                  <button onClick={() => toggleSort('username')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                    Kreator <SortIcon col="username" />
                  </button>
                </th>
                <th className="py-[16px]">
                  <button onClick={() => toggleSort('jadwal')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                    Jadwal Terdaftar <SortIcon col="jadwal" />
                  </button>
                </th>
                <th className="w-64 py-[16px]">Tambah Jadwal</th>
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
                  const schedules = live_schedules.filter(l => l.campaign_creator_id === cc.id);

                  return (
                    <tr key={cc.id} className="border-b border-line hover:bg-slate-50/50">
                      <td className="align-top">
                        <div className="font-medium text-text">@{creator?.username}</div>
                        <span className="inline-block mt-[4px] px-[8px] py-[2px] border border-line rounded-[4px] text-[10px] font-semibold text-text-soft uppercase bg-slate-100">{cc.approval}</span>
                      </td>
                      <td className="align-top">
                        {schedules.length === 0 ? (
                          <span className="text-[13px] text-text-soft italic">Belum ada jadwal live</span>
                        ) : (
                          <div className="flex flex-wrap gap-[8px]">
                            {schedules.map(schedule => (
                              <div key={schedule.id} className="flex items-center gap-[8px] bg-blue-50 text-blue-800 border border-blue-200 px-[12px] py-[6px] rounded-full text-[13px] font-medium">
                                <span>{new Date(schedule.tanggal_live).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                <button onClick={() => handleDelete(schedule.id)} className="text-red-500 hover:text-red-700">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="align-top">
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
