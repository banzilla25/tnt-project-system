"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Calendar, Trash2, Plus, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

// ─── Skeleton Loading Component ────────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="space-y-[24px] pb-[80px] animate-pulse">
      {/* Stats Section Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
        <div className="ccard space-y-3">
          <div className="h-5 bg-slate-200 rounded w-3/4" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 bg-slate-200 rounded-full" />
              <div className="h-4 bg-slate-200 rounded flex-1" />
              <div className="h-4 bg-slate-200 rounded w-12" />
            </div>
          ))}
        </div>
        <div className="ccard space-y-3">
          <div className="h-5 bg-slate-200 rounded w-3/4" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 bg-slate-200 rounded-full" />
              <div className="h-4 bg-slate-200 rounded flex-1" />
              <div className="h-4 bg-slate-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter Buttons Skeleton */}
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-slate-200 rounded-full" />
        <div className="h-8 w-32 bg-slate-200 rounded-full" />
        <div className="h-8 w-32 bg-slate-200 rounded-full" />
      </div>

      {/* Table Skeleton */}
      <div className="ccard !p-0 overflow-hidden">
        <div className="p-[16px] border-b border-line bg-slate-50 flex justify-between">
          <div className="h-5 bg-slate-200 rounded w-40" />
          <div className="h-8 bg-slate-200 rounded w-48" />
        </div>
        <div className="divide-y divide-line">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-[16px] flex gap-[16px]">
              <div className="w-48 space-y-2 shrink-0">
                <div className="h-4 bg-slate-200 rounded w-32" />
                <div className="h-3 bg-slate-200 rounded w-16" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="h-20 bg-slate-200 rounded" />
                <div className="h-20 bg-slate-200 rounded" />
              </div>
              <div className="w-48 shrink-0">
                <div className="h-8 bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LiveSchedulePage() {
  const { id } = useParams();
  const campaignId = Number(id);

  const {
    live_schedules,
    fetchLiveSchedules,
    addLiveSchedule,
    deleteLiveSchedule,
    isLoading,
    campaigns,
  } = useDatabaseStore();

  const campaign = campaigns.find(c => c.id === campaignId);

  const [dateInputs, setDateInputs] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const [localCreators, setLocalCreators] = useState<any[]>([]);
  const [isFetchingCC, setIsFetchingCC] = useState(true);

  const [actualLives, setActualLives] = useState<any[]>([]);

  // "username" | "gmv" | "lives"
  const [activeFilter, setActiveFilter] = useState<'username' | 'gmv' | 'lives'>('username');

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

  // ─── Fetch Campaign Creators ───────────────────────────────────────────────
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

  // ─── Fetch Actual Lives ────────────────────────────────────────────────────
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

      let organicLives: any[] = [];
      const chunkSize = 100;
      for (let i = 0; i < usernames.length; i += chunkSize) {
        const chunk = usernames.slice(i, i + chunkSize);
        let query = supabase.from('organic_videos').select('*').in('creator_username', chunk).ilike('duration_str', '%h%min%');
        if (campaign?.start_date) query = query.gte('post_time', campaign.start_date);
        if (campaign?.end_date) query = query.lte('post_time', `${campaign.end_date}T23:59:59Z`);
        const chunkLives = await fetchAll(query);
        organicLives = organicLives.concat(chunkLives);
      }

      let salesLives: any[] = [];
      for (let i = 0; i < usernames.length; i += chunkSize) {
        const chunk = usernames.slice(i, i + chunkSize);
        const chunkSales = await fetchAll(
          supabase
            .from('sales')
            .select('content_uid, gmv, quantity, creator_username, post_time')
            .eq('campaign_id', campaignId)
            .eq('content_type', 'Livestream')
            .in('creator_username', chunk)
        );
        salesLives = salesLives.concat(chunkSales);
      }

      // Build gmvMap and ordersMap
      const gmvMap = new Map<string, number>();
      const ordersMap = new Map<string, number>();
      salesLives.forEach(s => {
        let vid = s.content_uid;
        if (vid && vid.startsWith('video_')) vid = vid.split('_')[1];
        gmvMap.set(vid, (gmvMap.get(vid) || 0) + (s.gmv || 0));
        ordersMap.set(vid, (ordersMap.get(vid) || 0) + (s.quantity || 0));
      });

      const unifiedLives = organicLives.map(l => ({
        ...l,
        gmv: gmvMap.get(l.content_uid) || 0,
        orders: ordersMap.get(l.content_uid) || 0,
        start_time: l.post_time,
      }));

      const existingUids = new Set(organicLives.map(l => l.content_uid));
      salesLives.forEach(s => {
        let vid = s.content_uid;
        if (vid && vid.startsWith('video_')) vid = vid.split('_')[1];
        if (vid && !existingUids.has(vid)) {
          existingUids.add(vid);
          unifiedLives.push({
            content_uid: vid,
            creator_username: s.creator_username,
            post_time: s.post_time,
            start_time: s.post_time,
            video_views: 0,
            video_likes: 0,
            duration_str: '',
            gmv: gmvMap.get(vid) || 0,
            orders: ordersMap.get(vid) || 0,
          });
        }
      });

      setActualLives(unifiedLives);
    };

    fetchActualLives();
  }, [campaignId, localCreators, campaign]);

  // ─── Stats: Top 5 Kreator (session count) ─────────────────────────────────
  const top5Creators = (() => {
    const countMap = new Map<string, number>();
    actualLives.forEach(l => {
      const u = l.creator_username;
      if (u) countMap.set(u, (countMap.get(u) || 0) + 1);
    });
    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  })();

  // ─── Stats: Top 5 Live Sessions (GMV) ─────────────────────────────────────
  const top5LivesByGmv = [...actualLives]
    .filter(l => l.gmv > 0)
    .sort((a, b) => (b.gmv || 0) - (a.gmv || 0))
    .slice(0, 5);

  // ─── Filter / Sort localCreators ───────────────────────────────────────────
  const approvedCCs = localCreators
    .filter(cc => {
      if (searchQuery) {
        if (!cc.creators?.username.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (activeFilter === 'gmv') {
        const gmvA = actualLives.filter(l => l.creator_username === a.creators?.username).reduce((s, l) => s + (l.gmv || 0), 0);
        const gmvB = actualLives.filter(l => l.creator_username === b.creators?.username).reduce((s, l) => s + (l.gmv || 0), 0);
        return gmvB - gmvA;
      }
      if (activeFilter === 'lives') {
        const cntA = actualLives.filter(l => l.creator_username === a.creators?.username).length;
        const cntB = actualLives.filter(l => l.creator_username === b.creators?.username).length;
        return cntB - cntA;
      }
      // default: username asc (+ respect internal sort toggle for jadwal)
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
    await addLiveSchedule({ campaign_creator_id: ccId, tanggal_live: date });
    setDateInputs(prev => ({ ...prev, [ccId]: "" }));
    setIsSaving(prev => ({ ...prev, [ccId]: false }));
  };

  const handleDelete = async (scheduleId: number) => {
    if (confirm("Hapus jadwal live ini?")) {
      await deleteLiveSchedule(scheduleId);
    }
  };

  // ─── Skeleton while fetching ───────────────────────────────────────────────
  if (isFetchingCC) {
    return <SkeletonLoader />;
  }

  if (isLoading && live_schedules.length === 0) {
    return <div className="p-8 text-center text-slate-500">Memuat jadwal live...</div>;
  }

  // ─── GPM helper ───────────────────────────────────────────────────────────
  const calcGpm = (gmv: number, views: number) => {
    if (!views || views === 0) return '0';
    return (gmv / views * 1000).toLocaleString('id-ID', { maximumFractionDigits: 0 });
  };

  // ─── Rank badge ───────────────────────────────────────────────────────────
  const rankBadge = (rank: number) => {
    const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return medals[rank] ?? `#${rank}`;
  };

  return (
    <div className="space-y-[24px] pb-[80px]">

      {/* ── Stats Section ── */}
      {actualLives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">

          {/* Left: Top 5 Kreator - Sesi Live Terbanyak */}
          <div className="ccard">
            <h3 className="font-semibold text-text text-[15px] mb-[14px] flex items-center gap-2">
              🏆 Top 5 Kreator — Sesi Live Terbanyak
            </h3>
            {top5Creators.length === 0 ? (
              <p className="text-sm text-text-soft italic">Belum ada data</p>
            ) : (
              <ol className="space-y-[10px]">
                {top5Creators.map(([username, count], idx) => (
                  <li key={username} className="flex items-center gap-3">
                    <span className="text-[16px] w-8 shrink-0 text-center">{rankBadge(idx + 1)}</span>
                    <span className="flex-1 text-[13px] font-medium text-text truncate">@{username}</span>
                    <span className="text-[13px] font-bold text-blue-600 shrink-0">{count} sesi</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Right: Top 5 Sesi Live - GMV Terbanyak */}
          <div className="ccard">
            <h3 className="font-semibold text-text text-[15px] mb-[14px] flex items-center gap-2">
              💰 Top 5 Sesi Live — GMV Terbanyak
            </h3>
            {top5LivesByGmv.length === 0 ? (
              <p className="text-sm text-text-soft italic">Belum ada data GMV</p>
            ) : (
              <ol className="space-y-[10px]">
                {top5LivesByGmv.map((live, idx) => (
                  <li key={live.content_uid} className="flex items-center gap-3">
                    <span className="text-[16px] w-8 shrink-0 text-center">{rankBadge(idx + 1)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text truncate">@{live.creator_username}</div>
                      <div className="text-[11px] text-text-soft">
                        {live.start_time
                          ? new Date(live.start_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </div>
                    </div>
                    <span className="text-[13px] font-bold text-green-600 shrink-0">
                      Rp {(live.gmv || 0).toLocaleString('id-ID')}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {/* ── Filter Buttons ── */}
      <div className="flex items-center gap-[8px] flex-wrap">
        <span className="text-[13px] font-medium text-text-soft mr-1">Urutkan:</span>
        {([
          { key: 'username' as const, label: 'Semua' },
          { key: 'gmv' as const, label: 'GMV Terbanyak' },
          { key: 'lives' as const, label: 'Live Terbanyak' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`px-[14px] py-[5px] rounded-full text-[13px] font-medium transition-colors border ${
              activeFilter === key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Main Table ── */}
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
                    Jadwal &amp; Realisasi Live <SortIcon col="jadwal" />
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
                  const schedules = live_schedules
                    .filter(l => l.campaign_creator_id === cc.id)
                    .sort((a, b) => new Date(a.tanggal_live).getTime() - new Date(b.tanggal_live).getTime());

                  const creatorLives = actualLives.filter(l => l.creator_username === creator?.username);

                  const allDates = new Set<string>();
                  schedules.forEach(s => allDates.add(new Date(s.tanggal_live).toISOString().substring(0, 10)));
                  creatorLives.forEach(l => {
                    if (l.start_time) allDates.add(new Date(l.start_time).toISOString().substring(0, 10));
                  });

                  const sortedDates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

                  return (
                    <tr key={cc.id} className="border-b border-line hover:bg-slate-50/50">
                      <td className="align-top px-[16px] py-[16px]">
                        <div className="font-medium text-text">@{creator?.username}</div>
                        <span className="inline-block mt-[4px] px-[8px] py-[2px] border border-line rounded-[4px] text-[10px] font-semibold text-text-soft uppercase bg-slate-100">
                          {cc.approval}
                        </span>
                      </td>
                      <td className="align-top px-[16px] py-[16px]">
                        {sortedDates.length === 0 ? (
                          <span className="text-[13px] text-text-soft italic">Belum ada jadwal live</span>
                        ) : (
                          <div className="flex flex-col gap-[12px]">
                            {sortedDates.map(dateStr => {
                              const schedule = schedules.find(s => new Date(s.tanggal_live).toISOString().substring(0, 10) === dateStr);
                              const livesOnDate = creatorLives.filter(l => l.start_time && l.start_time.startsWith(dateStr));

                              const totalViews = livesOnDate.reduce((sum, l) => sum + (l.video_views || 0), 0);
                              const campaignGmv = livesOnDate.reduce((sum, l) => sum + (l.gmv || 0), 0);

                              const isScheduled = !!schedule;
                              const isDone = livesOnDate.length > 0;
                              const todayDate = new Date().toISOString().substring(0, 10);
                              const isPast = dateStr < todayDate;

                              let bgColor = 'bg-blue-50 border-blue-200';
                              let textColor = 'text-blue-800';
                              let icon = <Calendar className="w-5 h-5 text-blue-500" />;
                              let statusText = 'Menunggu pelaksanaan Live...';

                              if (isScheduled && isDone) {
                                bgColor = 'bg-green-50 border-green-200';
                                textColor = 'text-green-800';
                                icon = <CheckCircle2 className="w-5 h-5 text-green-600" />;
                                statusText = 'Live sesuai jadwal.';
                              } else if (isScheduled && !isDone) {
                                if (isPast) {
                                  bgColor = 'bg-red-50 border-red-200';
                                  textColor = 'text-red-800';
                                  icon = <XCircle className="w-5 h-5 text-red-500" />;
                                  statusText = 'Kreator tidak melakukan Live pada jadwal ini (Tidak ada data terdeteksi).';
                                }
                              } else if (!isScheduled && isDone) {
                                bgColor = 'bg-yellow-50 border-yellow-200';
                                textColor = 'text-yellow-800';
                                icon = <CheckCircle2 className="w-5 h-5 text-yellow-600" />;
                                statusText = 'Live tambahan (Di luar jadwal).';
                              }

                              return (
                                <div key={dateStr} className={`flex items-start gap-[12px] p-3 rounded-lg border ${bgColor}`}>
                                  <div className="mt-0.5">{icon}</div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className={`text-[14px] font-semibold ${textColor}`}>
                                        {new Date(dateStr).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                      </span>
                                      {isScheduled && (
                                        <button onClick={() => handleDelete(schedule.id)} className="text-slate-400 hover:text-red-600 p-1">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>

                                    <div className={`mt-1 text-sm italic ${textColor} opacity-80`}>
                                      {statusText}
                                    </div>

                                    {isDone && (
                                      <div className="mt-3 space-y-2">
                                        {livesOnDate.map((live, idx) => {
                                          const views = live.video_views || 0;
                                          const likes = live.video_likes || 0;
                                          const gmv = live.gmv || 0;
                                          const orders = live.orders || 0;
                                          const gpm = calcGpm(gmv, views);

                                          return (
                                            <div key={idx} className="bg-white/60 p-2 rounded text-sm text-slate-700 border border-black/5">
                                              <div className="flex justify-between items-center font-medium mb-2">
                                                <span>Sesi #{idx + 1} {live.duration_str ? `(${live.duration_str})` : ''}</span>
                                                <span className="text-xs text-slate-500">ID: {live.content_uid}</span>
                                              </div>
                                              <div className="grid grid-cols-3 gap-2 text-xs">
                                                <div>
                                                  <div className="opacity-60 mb-0.5">Views</div>
                                                  <div className="font-semibold">{views.toLocaleString('id-ID')}</div>
                                                </div>
                                                <div>
                                                  <div className="opacity-60 mb-0.5">Likes</div>
                                                  <div className="font-semibold">{likes.toLocaleString('id-ID')}</div>
                                                </div>
                                                <div>
                                                  <div className="opacity-60 mb-0.5">Durasi</div>
                                                  <div className="font-semibold">{live.duration_str || '—'}</div>
                                                </div>
                                                <div>
                                                  <div className="opacity-60 mb-0.5">Orders</div>
                                                  <div className="font-semibold">{orders.toLocaleString('id-ID')}</div>
                                                </div>
                                                <div>
                                                  <div className="opacity-60 mb-0.5">GMV</div>
                                                  <div className="font-semibold text-green-700">Rp {gmv.toLocaleString('id-ID')}</div>
                                                </div>
                                                <div>
                                                  <div className="opacity-60 mb-0.5">GPM (per Ribu Views)</div>
                                                  <div className="font-semibold text-purple-700">Rp {gpm}</div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {livesOnDate.length > 1 && (
                                          <div className="mt-2 pt-2 border-t border-black/10 flex justify-between font-semibold text-sm">
                                            <span>Total Harian:</span>
                                            <div className="flex gap-4">
                                              <span>{totalViews.toLocaleString('id-ID')} Views</span>
                                              <span>Rp {campaignGmv.toLocaleString('id-ID')}</span>
                                            </div>
                                          </div>
                                        )}
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
