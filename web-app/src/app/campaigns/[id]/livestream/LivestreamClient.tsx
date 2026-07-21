"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import { Search, Radio, Loader2, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useCampaignFilter } from "@/providers/CampaignFilterProvider";

export default function CampaignLiveStreamClient({
  campaign,
  initialCreators,
  initialSalesData,
  initialLiveMetrics
}: {
  campaign: any;
  initialCreators: any[];
  initialSalesData: any[];
  initialLiveMetrics: any[];
}) {
  const campaignId = campaign.id;

  const [creators, setCreators] = useState<any[]>(initialCreators || []);
  const [salesData, setSalesData] = useState<any[]>(initialSalesData || []);
  const [liveMetrics, setLiveMetrics] = useState<any[]>(initialLiveMetrics || []);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('sesi');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const { isCreatorVisible } = useCampaignFilter();

  // ─── Fetch Actual Lives via RPC (for Leaderboard) ──
  const [actualLives, setActualLives] = useState<any[]>([]);
  const supabase = createClient();
  
  useEffect(() => {
    const fetchActualLives = async () => {
      if (!campaignId) return;
      const { data, error } = await supabase.rpc('get_campaign_live_stats', {
        p_campaign_id: campaignId,
      });
      if (!error && data) {
        setActualLives(Array.isArray(data) ? data : []);
      }
    };
    fetchActualLives();
  }, [campaignId]);

  // ─── Pre-compute maps for Leaderboard ──
  const creatorGmvMap    = new Map<string, number>();
  const creatorLivesMap  = new Map<string, number>();
  const creatorViewsMap  = new Map<string, number>();
  const creatorLikesMap  = new Map<string, number>();
  
  actualLives.forEach(l => {
    const u = l.creator_username;
    if (u) {
      creatorGmvMap.set(u,   (creatorGmvMap.get(u)   || 0) + (Number(l.gmv)          || 0));
      creatorLivesMap.set(u, (creatorLivesMap.get(u) || 0) + 1);
      creatorViewsMap.set(u, (creatorViewsMap.get(u) || 0) + (Number(l.video_views)  || 0));
      creatorLikesMap.set(u, (creatorLikesMap.get(u) || 0) + (Number(l.video_likes)  || 0));
    }
  });

  const top5CreatorsBySession = Array.from(creatorLivesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([username, sessions]) => ({
      username,
      sessions,
      gmv:   creatorGmvMap.get(username)   || 0,
      views: creatorViewsMap.get(username) || 0,
      likes: creatorLikesMap.get(username) || 0,
    }));

  const top5CreatorsByGmv = Array.from(creatorGmvMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([username, gmv]) => ({
      username,
      gmv,
      sessions: creatorLivesMap.get(username) || 0,
      views:    creatorViewsMap.get(username) || 0,
      likes:    creatorLikesMap.get(username) || 0,
    }));

  const top5SessionsByGmv = [...actualLives]
    .filter(l => (l.gmv || 0) > 0)
    .sort((a, b) => (b.gmv || 0) - (a.gmv || 0))
    .slice(0, 5);

  const rankBadge = (rank: number) => {
    const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return medals[rank] ?? `#${rank}`;
  };

  const aggregatedData = useMemo(() => {
    let data = creators.filter(cc => isCreatorVisible(cc.creators.username)).map(cc => {
      const creatorUsername = cc.creators.username;
      
      const cSales = salesData.filter(s => s.creator_username === creatorUsername);
      const uniqueUids = Array.from(new Set(cSales.map(s => s.content_uid).filter(Boolean)));
      
      const cMetrics = liveMetrics.filter(m => uniqueUids.includes(m.content_uid));

      let totalGmv = 0;
      let totalOrders = 0;
      cSales.forEach(s => {
        totalGmv += (s.gmv || 0);
        totalOrders += (s.quantity || 0);
      });

      let totalViews = 0;
      let totalLikes = 0;
      cMetrics.forEach(m => {
        totalViews += (m.video_views || m.views || 0);
        totalLikes += (m.video_likes || m.likes || 0);
      });

      return {
        ...cc,
        totalGmv,
        totalOrders,
        totalViews,
        totalLikes,
        liveCount: uniqueUids.length
      };
    });

    if (statusFilter !== 'all') {
      data = data.filter(d => d.approval === statusFilter);
    }

    if (searchQuery) {
      data = data.filter(d => d.creators.username.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (sortBy === 'gmv') {
      data.sort((a, b) => {
        if (b.totalGmv !== a.totalGmv) return b.totalGmv - a.totalGmv;
        return b.liveCount - a.liveCount;
      });
    } else if (sortBy === 'views') {
      data.sort((a, b) => b.totalViews - a.totalViews);
    } else if (sortBy === 'orders') {
      data.sort((a, b) => b.totalOrders - a.totalOrders);
    } else if (sortBy === 'sesi') {
      data.sort((a, b) => {
        if (b.liveCount !== a.liveCount) return b.liveCount - a.liveCount;
        return b.totalGmv - a.totalGmv;
      });
    }

    return data;
  }, [creators, salesData, liveMetrics, searchQuery, sortBy, statusFilter, isCreatorVisible]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-text">Performa Live Stream</h2>
          <p className="text-[13px] text-text-soft">Analitik performa khusus untuk Live Stream berdasarkan data impor organik.</p>
        </div>
      </div>

      {/* ── Stats / Leaderboard Section ── */}
      {actualLives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px]">
          {/* Card 1: Top 5 Kreator — Sesi Live Terbanyak */}
          <div className="ccard">
            <h3 className="font-semibold text-text text-[14px] mb-[14px] flex items-center gap-2">
              🏆 Top 5 Kreator — Live Terbanyak
            </h3>
            {top5CreatorsBySession.length === 0 ? (
              <p className="text-sm text-text-soft italic">Belum ada data</p>
            ) : (
              <ol className="space-y-[12px]">
                {top5CreatorsBySession.map((c, idx) => {
                  const gpm = c.views > 0 ? (c.gmv / c.views * 1000) : 0;
                  return (
                    <li key={c.username} className="space-y-[6px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] w-7 shrink-0 text-center">{rankBadge(idx + 1)}</span>
                        <span className="flex-1 text-[13px] font-semibold text-text truncate">@{c.username}</span>
                        <span className="text-[13px] font-bold text-blue-600 shrink-0">{c.sessions} sesi</span>
                      </div>
                      <div className="ml-9 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-text-soft">
                        <span>👁 {c.views.toLocaleString('id-ID')} views</span>
                        <span>❤️ {c.likes.toLocaleString('id-ID')} likes</span>
                        <span>💰 Rp {c.gmv.toLocaleString('id-ID')}</span>
                        <span>📊 GPM Rp {gpm.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Card 2: Top 5 Kreator — GMV Live Terbanyak */}
          <div className="ccard">
            <h3 className="font-semibold text-text text-[14px] mb-[14px] flex items-center gap-2">
              💰 Top 5 Kreator — GMV Live Terbanyak
            </h3>
            {top5CreatorsByGmv.length === 0 ? (
              <p className="text-sm text-text-soft italic">Belum ada data GMV</p>
            ) : (
              <ol className="space-y-[12px]">
                {top5CreatorsByGmv.map((c, idx) => {
                  const gpm = c.views > 0 ? (c.gmv / c.views * 1000) : 0;
                  return (
                    <li key={c.username} className="space-y-[6px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] w-7 shrink-0 text-center">{rankBadge(idx + 1)}</span>
                        <span className="flex-1 text-[13px] font-semibold text-text truncate">@{c.username}</span>
                        <span className="text-[13px] font-bold text-green-600 shrink-0">Rp {c.gmv.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="ml-9 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-text-soft">
                        <span>🎬 {c.sessions} sesi</span>
                        <span>👁 {c.views.toLocaleString('id-ID')} views</span>
                        <span>❤️ {c.likes.toLocaleString('id-ID')} likes</span>
                        <span>📊 GPM Rp {gpm.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Card 3: Top 5 Sesi Live — GMV Terbanyak (per sesi) */}
          <div className="ccard">
            <h3 className="font-semibold text-text text-[14px] mb-[14px] flex items-center gap-2">
              🔥 Top 5 Sesi Live — GMV Per Sesi
            </h3>
            {top5SessionsByGmv.length === 0 ? (
              <p className="text-sm text-text-soft italic">Belum ada data GMV</p>
            ) : (
              <ol className="space-y-[12px]">
                {top5SessionsByGmv.map((live, idx) => {
                  const views  = Number(live.video_views) || 0;
                  const likes  = Number(live.video_likes) || 0;
                  const gmv    = Number(live.gmv) || 0;
                  const gpm    = views > 0 ? (gmv / views * 1000) : 0;
                  return (
                    <li key={live.content_uid || idx} className="space-y-[6px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] w-7 shrink-0 text-center">{rankBadge(idx + 1)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-text truncate">@{live.creator_username}</div>
                          <div className="text-[11px] text-text-soft">
                            {live.start_time ? new Date(live.start_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                            {live.duration_str ? ` · ${live.duration_str}` : ''}
                          </div>
                        </div>
                        <span className="text-[13px] font-bold text-green-600 shrink-0">Rp {gmv.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="ml-9 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-text-soft">
                        <span>👁 {views.toLocaleString('id-ID')} views</span>
                        <span>❤️ {likes.toLocaleString('id-ID')} likes</span>
                        <span>📊 GPM Rp {gpm.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}

      <div className="ccard p-4 flex flex-wrap gap-4 items-center bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari username kreator..." 
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select 
            className="px-3 py-2 border rounded-lg text-[13px] outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="approved">Approved</option>
            <option value="alternate">Alternate</option>
            <option value="not_approved">Not Approved</option>
            <option value="pending">Pending</option>
          </select>
          <select 
            className="px-3 py-2 border rounded-lg text-[13px] outline-none"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="none">Urutkan</option>
            <option value="gmv">GMV Tertinggi</option>
            <option value="sesi">Sesi Terbanyak</option>
            <option value="views">Views Terbanyak</option>
            <option value="orders">Order Terbanyak</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-[12px] font-semibold text-slate-600">Kreator</th>
                <th className="px-4 py-3 text-[12px] font-semibold text-slate-600">Sesi Live</th>
                <th className="px-4 py-3 text-[12px] font-semibold text-slate-600 text-right">Live Views</th>
                <th className="px-4 py-3 text-[12px] font-semibold text-slate-600 text-right">Live Orders</th>
                <th className="px-4 py-3 text-[12px] font-semibold text-slate-600 text-right">Live GMV</th>
              </tr>
            </thead>
            <tbody>
              {aggregatedData.map((item, idx) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-[12px]">
                        {item.creators.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-slate-900">@{item.creators.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[13px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-rose-500" />
                      {item.liveCount} Sesi
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[13px] text-slate-600 font-medium text-right">
                    {item.totalViews.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-[13px] text-slate-600 font-medium text-right">
                    {item.totalOrders.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-[13px] text-slate-900 font-semibold text-right">
                    Rp {item.totalGmv.toLocaleString()}
                  </td>
                </tr>
              ))}
              {aggregatedData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-slate-500">
                    Tidak ada data performa Live Stream. Silakan import Custom Report Livestream.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
