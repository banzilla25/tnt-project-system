"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
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
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Jadwal Live Kreator
          </CardTitle>
          <input 
            type="text" 
            placeholder="Cari username..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="p-2 border border-slate-300 rounded-md text-sm min-w-[200px] font-normal"
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-64">
                    <button onClick={() => toggleSort('username')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                      Kreator <SortIcon col="username" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('jadwal')} className="flex items-center font-semibold hover:text-blue-600 transition-colors">
                      Jadwal Terdaftar <SortIcon col="jadwal" />
                    </button>
                  </TableHead>
                  <TableHead className="w-64">Tambah Jadwal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedCCs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                      Belum ada kreator yang di-approve di campaign ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  approvedCCs.map((cc) => {
                    const creator = cc.creators;
                    const schedules = live_schedules.filter(l => l.campaign_creator_id === cc.id);

                    return (
                      <TableRow key={cc.id}>
                        <TableCell className="align-top">
                          <div className="font-medium text-slate-800">@{creator?.username}</div>
                          <Badge variant="outline" className="mt-1 text-[10px] uppercase">{cc.approval}</Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          {schedules.length === 0 ? (
                            <span className="text-sm text-slate-400 italic">Belum ada jadwal live</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {schedules.map(schedule => (
                                <div key={schedule.id} className="flex items-center gap-2 bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-full text-sm">
                                  <span>{new Date(schedule.tanggal_live).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                  <button onClick={() => handleDelete(schedule.id)} className="text-red-500 hover:text-red-700">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex gap-2">
                            <input
                              type="date"
                              className="text-sm border p-2 rounded flex-1"
                              value={dateInputs[cc.id] || ""}
                              onChange={e => setDateInputs(prev => ({ ...prev, [cc.id]: e.target.value }))}
                            />
                            <button
                              onClick={() => handleAddSchedule(cc.id)}
                              disabled={!dateInputs[cc.id] || isSaving[cc.id]}
                              className="bg-slate-900 text-white p-2 rounded hover:bg-slate-800 disabled:opacity-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
