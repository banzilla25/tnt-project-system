"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import TimelineTarget from "./TimelineTarget";

const supabase = createClient();

export default function CampaignDailyPerformanceClient({ campaignId }: { campaignId: number }) {

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const totalPages = Math.ceil(dailyData.length / pageSize);
  const paginatedDaily = React.useMemo(() => {
    return dailyData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [dailyData, currentPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: campaignData } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
      if (!campaignData) return;
      setCampaign(campaignData);

      let allSales: any[] = [];
      let allVideosFromCreators: any[] = [];
      
      const isAwareness = campaignData.tipe_campaign === 'awareness';
      const isHybrid = campaignData.tipe_campaign === 'gmv_awareness';

      // 1. Fetch Sales aggregates via RPC
      const { data: dailyStats, error: dsError } = await supabase.rpc('get_campaign_daily_stats', { p_campaign_id: campaignId });
      const allSalesStats = dailyStats || [];

      // 2. Fetch Videos
      let from_v = 0;
      let to_v = 999;
      let hasMore_v = true;
      while (hasMore_v) {
        const { data: ccData, error } = await supabase
          .from('campaign_creators')
          .select('id, approved_at, creators(username), videos(id, created_at, link_video)')
          .eq('campaign_id', campaignId)
          .range(from_v, to_v);

        if (error) break;

        if (ccData && ccData.length > 0) {
          allVideosFromCreators = [...allVideosFromCreators, ...ccData];
          if (ccData.length < 1000) {
            hasMore_v = false;
          } else {
            from_v += 1000;
            to_v += 1000;
          }
        } else {
          hasMore_v = false;
        }
      }

      // 3. Fetch Ads Performance
      let allAds: any[] = [];
      let adsFrom = 0;
      let adsTo = 999;
      let adsHasMore = true;
      while (adsHasMore) {
        const { data: adsData, error } = await supabase
          .from('ads_performance')
          .select('ad_id, tanggal, gross_revenue_usd, kurs')
          .eq('campaign_id', campaignId)
          .order('tanggal', { ascending: true })
          .range(adsFrom, adsTo);

        if (error) break;

        if (adsData && adsData.length > 0) {
          allAds = [...allAds, ...adsData];
          if (adsData.length < 1000) adsHasMore = false;
          else { adsFrom += 1000; adsTo += 1000; }
        } else {
          adsHasMore = false;
        }
      }

      // 4. Fetch Live Sessions via RPC
      const { data: liveStats } = await supabase.rpc('get_campaign_live_stats', { p_campaign_id: campaignId });
      const allLiveSessions = liveStats || [];

      // Grouping
      const grouped: Record<string, { gmv: number; gmvAds: number; creators: Set<string>; videos: Set<string>; gmvLive: number; gmvVT: number; ordersLive: number; ordersVT: number; liveSessions: Set<string> }> = {};
      const monthlyGrouped: Record<string, { gmv: number; gmvAds: number; creators: Set<string>; videos: Set<string>; gmvLive: number; gmvVT: number; ordersLive: number; ordersVT: number; liveSessions: Set<string> }> = {};

      const campaignStartStr = campaignData.start_date || '';
      const campaignEndStr = campaignData.status === 'selesai' ? campaignData.end_date || '' : '';

      if (allSalesStats.length > 0) {
        allSalesStats.forEach((stat: any) => {
          if (!stat.date_str) return;
          const dateStr = stat.date_str;
          
          if (campaignStartStr && dateStr < campaignStartStr) return;
          if (campaignEndStr && dateStr > campaignEndStr) return;

          if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
          
          grouped[dateStr].gmvLive += (stat.gmv_live || 0);
          grouped[dateStr].ordersLive += (stat.orders_live || 0);
          grouped[dateStr].gmvVT += (stat.gmv_vt || 0);
          grouped[dateStr].ordersVT += (stat.orders_vt || 0);
          grouped[dateStr].gmv += (stat.total_gmv || 0);
          
          // We DO NOT add active_creators from sales to grouped[dateStr].creators, because we only want to count *approved* creators on this date.
          // We DO NOT add active_videos from sales to grouped[dateStr].videos, because we only want to count *uploaded* videos on this date, not videos that made a sale on this date.

          const monthStr = dateStr.substring(0, 7);
          if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
          
          monthlyGrouped[monthStr].gmvLive += (stat.gmv_live || 0);
          monthlyGrouped[monthStr].ordersLive += (stat.orders_live || 0);
          monthlyGrouped[monthStr].gmvVT += (stat.gmv_vt || 0);
          monthlyGrouped[monthStr].ordersVT += (stat.orders_vt || 0);
          monthlyGrouped[monthStr].gmv += (stat.total_gmv || 0);
          
          // We DO NOT add active_videos from sales to monthlyGrouped[monthStr].videos either.
        });
      }

      if (allVideosFromCreators.length > 0) {
        allVideosFromCreators.forEach(cc => {
          const username = cc.creators?.username || 'unknown';
          if (cc.approved_at) {
            const approvedDateStr = cc.approved_at.substring(0, 10);
            let countCreator = true;
            if (campaignStartStr && approvedDateStr < campaignStartStr) countCreator = false;
            if (campaignEndStr && approvedDateStr > campaignEndStr) countCreator = false;
            
            if (countCreator) {
              if (!grouped[approvedDateStr]) grouped[approvedDateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
              grouped[approvedDateStr].creators.add(username);

              const monthStr = cc.approved_at.substring(0, 7);
              if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
              monthlyGrouped[monthStr].creators.add(username);
            }
          }

          if (!cc.videos || cc.videos.length === 0) return;
          cc.videos.forEach((v: any) => {
            if (!v.created_at || !v.link_video) return; 
            const dateStr = v.created_at.substring(0, 10);
            if (campaignStartStr && dateStr < campaignStartStr) return;
            if (campaignEndStr && dateStr > campaignEndStr) return;
            
            if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
            grouped[dateStr].videos.add(v.id.toString());

            const monthStr = v.created_at.substring(0, 7);
            if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
            monthlyGrouped[monthStr].videos.add(v.id.toString());
          });
        });

        // Get usernames to fetch organic videos mapped to these creators
        const creatorUsernames = Array.from(new Set(allVideosFromCreators.map(cc => cc.creators?.username).filter(Boolean)));
        let allOrganicVideos: any[] = [];
        if (creatorUsernames.length > 0) {
          const chunkSize = 200;
          for (let i = 0; i < creatorUsernames.length; i += chunkSize) {
            const chunk = creatorUsernames.slice(i, i + chunkSize);
            const { data: orgData } = await supabase
              .from('organic_videos')
              .select('content_uid, post_time, content_type')
              .in('creator_username', chunk);
            if (orgData) {
              allOrganicVideos = [...allOrganicVideos, ...orgData];
            }
          }
        }

        allOrganicVideos.forEach(v => {
          if (!v.post_time || !v.content_uid) return;
          const dateStr = String(v.post_time).substring(0, 10);
          if (campaignStartStr && dateStr < campaignStartStr) return;
          if (campaignEndStr && dateStr > campaignEndStr) return;

          if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
          const monthStr = dateStr.substring(0, 7);
          if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };

          if (v.content_type === 'Video') {
            grouped[dateStr].videos.add(v.content_uid.toString());
            monthlyGrouped[monthStr].videos.add(v.content_uid.toString());
          } else if (v.content_type === 'Livestream' || v.content_type === 'Live') {
            grouped[dateStr].liveSessions.add(v.content_uid.toString());
            monthlyGrouped[monthStr].liveSessions.add(v.content_uid.toString());
          }
        });
      }

      if (allLiveSessions.length > 0) {
        allLiveSessions.forEach((l: any) => {
          if (!l.start_time) return;
          const dateStr = String(l.start_time).substring(0, 10);
          if (campaignStartStr && dateStr < campaignStartStr) return;
          if (campaignEndStr && dateStr > campaignEndStr) return;
          
          if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
          if (l.content_uid) grouped[dateStr].liveSessions.add(l.content_uid);

          const monthStr = dateStr.substring(0, 7);
          if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
          if (l.content_uid) monthlyGrouped[monthStr].liveSessions.add(l.content_uid);
        });
      }

      if (allAds.length > 0) {
        const previousAdValues: Record<string, number> = {};
        allAds.forEach(ad => {
          if (!ad.tanggal || !ad.ad_id) return;
          const dateStr = ad.tanggal.substring(0, 10);
          if (campaignStartStr && dateStr < campaignStartStr) return;
          if (campaignEndStr && dateStr > campaignEndStr) return;
          
          const currentGmv = ad.gross_revenue_usd || 0;
          const prevGmv = previousAdValues[ad.ad_id] || 0;
          const deltaUsd = currentGmv - prevGmv;
          
          if (deltaUsd > 0) {
            const kurs = (ad.kurs && ad.kurs < 1000) ? ad.kurs * 1000 : (ad.kurs || 16000);
            const deltaIdr = deltaUsd * kurs;
            
            if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
            grouped[dateStr].gmvAds += deltaIdr;
            
            const monthStr = dateStr.substring(0, 7);
            if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, gmvAds: 0, creators: new Set(), videos: new Set(), gmvLive: 0, gmvVT: 0, ordersLive: 0, ordersVT: 0, liveSessions: new Set() };
            monthlyGrouped[monthStr].gmvAds += deltaIdr;
          }
          previousAdValues[ad.ad_id] = currentGmv;
        });
      }

      const formattedDaily = Object.keys(grouped).map(date => ({
        date,
        gmvOrganic: grouped[date].gmv,
        gmvLive: grouped[date].gmvLive,
        gmvVT: grouped[date].gmvVT,
        ordersLive: grouped[date].ordersLive,
        ordersVT: grouped[date].ordersVT,
        gmvAds: grouped[date].gmvAds,
        totalCreators: grouped[date].creators.size,
        totalVideos: grouped[date].videos.size,
        totalLiveSessions: grouped[date].liveSessions.size
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const formattedMonthly = Object.keys(monthlyGrouped).map(month => ({
        month,
        gmvOrganic: monthlyGrouped[month].gmv,
        gmvLive: monthlyGrouped[month].gmvLive,
        gmvVT: monthlyGrouped[month].gmvVT,
        ordersLive: monthlyGrouped[month].ordersLive,
        ordersVT: monthlyGrouped[month].ordersVT,
        gmvAds: monthlyGrouped[month].gmvAds,
        totalCreators: monthlyGrouped[month].creators.size,
        totalVideos: monthlyGrouped[month].videos.size,
        totalLiveSessions: monthlyGrouped[month].liveSessions.size
      })).sort((a, b) => new Date(b.month + '-01').getTime() - new Date(a.month + '-01').getTime());

      setDailyData(formattedDaily);
      setMonthlyData(formattedMonthly);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-500 font-medium">
        Memuat data harian...
      </div>
    );
  }

  if (!campaign) return null;

  const isAwareness = campaign.tipe_campaign === 'awareness';
  const isHybrid = campaign.tipe_campaign === 'gmv_awareness';

  return (
    <div className="space-y-[24px] pb-[80px]">
      <div className="flex justify-between items-center mb-[24px]">
        <div>
          <h2 className="text-[20px] font-bold text-text">Performa Harian (Automated)</h2>
          <p className="text-[13px] text-text-soft">
            Rekap performa harian yang dihitung otomatis dari data organik dan ads.
          </p>
        </div>
      </div>

      {!loading && monthlyData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[24px] mb-[24px]">
          {monthlyData.map((m, idx) => {
            const dateObj = new Date(m.month + '-01');
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            return (
              <div key={idx} className="ccard bg-gradient-to-br from-indigo-50 to-blue-100/50 border-indigo-100">
                <div className="p-[24px]">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-800">{monthName}</p>
                  
                  <div className="mt-[12px] flex gap-[16px] pb-3 border-b border-indigo-100/50">
                    <div>
                      <h3 className="text-[18px] font-bold text-indigo-900">{m.totalVideos} <span className="text-[11px] font-normal text-indigo-700">VT</span></h3>
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold text-rose-700">{m.totalLiveSessions || 0} <span className="text-[11px] font-normal text-rose-600">Live</span></h3>
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold text-indigo-900">{m.totalCreators} <span className="text-[11px] font-normal text-indigo-700">Kreator</span></h3>
                    </div>
                  </div>

                  <div className="mt-[12px] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500">GMV Organik</span>
                      <span className="text-[13px] font-bold text-emerald-600">Rp {(m.gmvOrganic || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500">GMV Ads</span>
                      <span className="text-[13px] font-bold text-blue-600">Rp {(m.gmvAds || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TimelineTarget campaign={campaign} dailyData={dailyData} />

      <div className="ccard !p-0 overflow-hidden">
        <div className="p-[16px] border-b border-line bg-slate-50/50">
          <h3 className="text-[16px] font-bold text-text">Daily Tracker Performance</h3>
          {campaign.end_date && campaign.status !== 'selesai' && (() => {
            const endDate = new Date(campaign.end_date);
            endDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffDays = Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const countdownText = diffDays > 0 ? `(H-${diffDays})` : diffDays < 0 ? `(H+${Math.abs(diffDays)})` : `(Hari ini)`;
            
            return (
              <p className="text-[13px] text-amber-600 font-medium mt-[4px]">
                * Pengingat: Campaign ini di-setting berakhir pada {new Date(campaign.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} <span className="font-bold">{countdownText}</span>. Sistem akan terus merekap data harian hingga status campaign diubah menjadi "Selesai".
              </p>
            );
          })()}
          {campaign.end_date && campaign.status === 'selesai' && (
            <p className="text-[13px] text-emerald-600 font-medium mt-[4px]">
              ✓ Campaign telah selesai. Data setelah tanggal {new Date(campaign.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} disembunyikan.
            </p>
          )}
        </div>
        <div className="tbl-wrap !border-0 !rounded-none">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <th className="py-[16px] whitespace-nowrap">Tanggal</th>
                <th className="py-[16px] text-center">Video / Sesi Live</th>
                <th className="py-[16px] text-center">Kreator Aktif</th>
                <th className="py-[16px] text-center">Orders (VT/Live)</th>
                <th className="py-[16px] text-right">GMV Organik</th>
                <th className="py-[16px] text-right pr-6">GMV Ads</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-text-soft">
                    Mengkalkulasi data dari ribuan baris CSV...
                  </td>
                </tr>
              ) : dailyData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-text-soft">
                    Belum ada data untuk campaign ini.
                  </td>
                </tr>
              ) : (
                paginatedDaily.map((d, idx) => (
                  <tr key={idx} className="border-b border-line hover:bg-slate-50/50">
                    <td className="font-medium text-text whitespace-nowrap align-top pt-[20px]">
                      {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    
                    <td className="text-center align-top pt-[16px]">
                      <div className="flex flex-col items-center gap-1.5">
                         <span className="font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded text-[12px] min-w-[70px] inline-block">{d.totalVideos} VT</span>
                         <span className="font-bold text-rose-700 bg-rose-50/80 px-2 py-0.5 rounded text-[12px] min-w-[70px] inline-block">{d.totalLiveSessions || 0} Live</span>
                      </div>
                    </td>
                    <td className="text-center text-text-soft font-medium align-top pt-[20px]">
                      {d.totalCreators}
                    </td>
                    <td className="text-center align-top pt-[16px]">
                      <div className="flex flex-col items-center gap-1 text-[12px] font-medium text-slate-600">
                         <span className="px-2 py-0.5">{d.ordersVT || 0} VT</span>
                         <span className="px-2 py-0.5">{d.ordersLive || 0} Live</span>
                      </div>
                    </td>
                    <td className="text-right align-top pt-[16px]">
                      <div className="flex flex-col items-end gap-1 text-[13px]">
                         <span className="font-bold text-emerald-600">VT: Rp {(d.gmvVT || 0).toLocaleString()}</span>
                         <span className="font-bold text-rose-600">Live: Rp {(d.gmvLive || 0).toLocaleString()}</span>
                         <span className="text-[11px] text-slate-400 mt-1 border-t border-slate-100 pt-1">Total: Rp {(d.gmvOrganic || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="text-right font-bold text-blue-600 pr-6 align-top pt-[20px]">
                      Rp {(d.gmvAds || 0).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-[16px] border-t border-line flex items-center justify-between bg-white text-[13px]">
            <div className="text-text-soft">
              Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, dailyData.length)} dari {dailyData.length} hari
            </div>
            <div className="flex items-center gap-[8px]">
              <button 
                className="px-[12px] py-[6px] border border-line rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >Sebelumnya</button>
              <span className="font-bold px-[8px] text-indigo-600">Hal {currentPage} / {totalPages}</span>
              <button 
                className="px-[12px] py-[6px] border border-line rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors font-medium"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >Selanjutnya</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
