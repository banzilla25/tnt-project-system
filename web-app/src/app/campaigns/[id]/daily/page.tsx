"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useDatabaseStore } from "@/store/useDatabaseStore";

export default function CampaignDailyPerformancePage() {
  const { id } = useParams();
  const campaignId = Number(id);
  const supabase = createClient();
  const { campaigns } = useDatabaseStore();
  const campaign = campaigns.find(c => c.id === campaignId);

  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    const fetchDailyData = async () => {
      if (!campaignId) return;
      setLoading(true);
      
      let allSales: any[] = [];
      let allVideosFromCreators: any[] = [];
      
      const isAwareness = campaign?.tipe_campaign === 'awareness';
      const isHybrid = campaign?.tipe_campaign === 'gmv_awareness';

      // 1. Fetch Sales (Now always fetched because Auto-VT uses sales table for all campaign types)
      let from = 0;
      let to = 999;
      let hasMore = true;
      while (hasMore) {
        const { data: salesData, error } = await supabase
          .from('sales')
          .select('tanggal, gmv, creator_username, content_uid')
          .eq('campaign_id', campaignId)
          .eq('is_refund', false)
          .range(from, to);

        if (error) {
          console.error("Error fetching sales:", error);
          break;
        }

        if (salesData && salesData.length > 0) {
          allSales = [...allSales, ...salesData];
          if (salesData.length < 1000) {
            hasMore = false;
          } else {
            from += 1000;
            to += 1000;
          }
        } else {
          hasMore = false;
        }
      }

      // 2. Fetch Videos (for Awareness / Hybrid)
      if (isAwareness || isHybrid) {
        let from = 0;
        let to = 999;
        let hasMore = true;
        while (hasMore) {
          const { data: ccData, error } = await supabase
            .from('campaign_creators')
            .select('id, creators(username), videos(id, created_at, link_video)')
            .eq('campaign_id', campaignId)
            .range(from, to);

          if (error) {
            console.error("Error fetching creators for videos:", error);
            break;
          }

          if (ccData && ccData.length > 0) {
            allVideosFromCreators = [...allVideosFromCreators, ...ccData];
            if (ccData.length < 1000) {
              hasMore = false;
            } else {
              from += 1000;
              to += 1000;
            }
          } else {
            hasMore = false;
          }
        }
      }

      // Group by Date and Month
      const grouped: Record<string, { gmv: number; creators: Set<string>; videos: Set<string> }> = {};
      const monthlyGrouped: Record<string, { gmv: number; creators: Set<string>; videos: Set<string> }> = {};

      const campaignStartStr = campaign?.start_date || '';
      const campaignEndStr = campaign?.end_date || '';

      if (allSales.length > 0) {
        allSales.forEach(sale => {
          if (!sale.tanggal) return;
          // Extract YYYY-MM-DD
          const dateStr = sale.tanggal.substring(0, 10);
          
          if (campaignStartStr && dateStr < campaignStartStr) return;
          if (campaignEndStr && dateStr > campaignEndStr) return;

          if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, creators: new Set(), videos: new Set() };
          grouped[dateStr].gmv += (sale.gmv || 0);
          if (sale.creator_username) grouped[dateStr].creators.add(sale.creator_username);
          if (sale.content_uid) grouped[dateStr].videos.add(sale.content_uid);

          // Extract YYYY-MM
          const monthStr = sale.tanggal.substring(0, 7);
          if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, creators: new Set(), videos: new Set() };
          monthlyGrouped[monthStr].gmv += (sale.gmv || 0);
          if (sale.creator_username) monthlyGrouped[monthStr].creators.add(sale.creator_username);
          if (sale.content_uid) monthlyGrouped[monthStr].videos.add(sale.content_uid);
        });
      }

      if ((isAwareness || isHybrid) && allVideosFromCreators.length > 0) {
        allVideosFromCreators.forEach(cc => {
          const username = cc.creators?.username || 'unknown';
          if (!cc.videos || cc.videos.length === 0) return;
          
          cc.videos.forEach((v: any) => {
            // Kita hanya hitung video yang benar-benar ada linknya
            if (!v.created_at || !v.link_video) return; 
            
            const dateStr = v.created_at.substring(0, 10);
            
            if (campaignStartStr && dateStr < campaignStartStr) return;
            if (campaignEndStr && dateStr > campaignEndStr) return;
            
            if (!grouped[dateStr]) grouped[dateStr] = { gmv: 0, creators: new Set(), videos: new Set() };
            grouped[dateStr].creators.add(username);
            grouped[dateStr].videos.add(v.id.toString());

            const monthStr = v.created_at.substring(0, 7);
            if (!monthlyGrouped[monthStr]) monthlyGrouped[monthStr] = { gmv: 0, creators: new Set(), videos: new Set() };
            monthlyGrouped[monthStr].creators.add(username);
            monthlyGrouped[monthStr].videos.add(v.id.toString());
          });
        });
      }

      const formattedDaily = Object.keys(grouped).map(date => ({
        date,
        gmvOrganic: grouped[date].gmv,
        totalCreators: grouped[date].creators.size,
        totalVideos: grouped[date].videos.size
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const formattedMonthly = Object.keys(monthlyGrouped).map(month => ({
        month,
        gmvOrganic: monthlyGrouped[month].gmv,
        totalCreators: monthlyGrouped[month].creators.size,
        totalVideos: monthlyGrouped[month].videos.size
      })).sort((a, b) => new Date(b.month + '-01').getTime() - new Date(a.month + '-01').getTime());

      setDailyData(formattedDaily);
      setMonthlyData(formattedMonthly);
      setLoading(false);
    };

    fetchDailyData();
  }, [campaignId, campaign?.tipe_campaign, supabase]);

  if (!campaign) return null;

  const isAwareness = campaign.tipe_campaign === 'awareness';
  const isHybrid = campaign.tipe_campaign === 'gmv_awareness';
  
  const totalPages = Math.ceil(dailyData.length / pageSize);
  const paginatedDaily = React.useMemo(() => {
    return dailyData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [dailyData, currentPage]);

  return (
    <div className="space-y-[24px] pb-[80px]">
      <div className="flex justify-between items-center mb-[24px]">
        <div>
          <h2 className="text-[20px] font-bold text-text">Performa Harian (Automated)</h2>
          <p className="text-[13px] text-text-soft">
            {isAwareness 
              ? "Rekap performa VT harian yang dihitung otomatis dari file CSV."
              : "Rekap GMV harian yang dihitung otomatis dari file CSV Organik tanpa perlu input manual."}
          </p>
        </div>
      </div>

      {!loading && monthlyData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-[24px] mb-[24px]">
          {monthlyData.map((m, idx) => {
            const dateObj = new Date(m.month + '-01');
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            return (
              <div key={idx} className={`ccard bg-gradient-to-br ${isAwareness ? 'from-indigo-50 to-purple-100/50 border-indigo-100' : 'from-blue-50 to-indigo-100/50 border-blue-100'}`}>
                <div className="p-[24px]">
                  <p className={`text-[11px] font-medium uppercase tracking-wider ${isAwareness ? 'text-indigo-800' : 'text-blue-800'}`}>{monthName}</p>
                  
                  {isAwareness || isHybrid ? (
                    <div className="mt-[8px] flex gap-[16px]">
                      <div>
                        <h3 className={`text-[20px] font-bold ${isAwareness ? 'text-indigo-900' : 'text-blue-900'}`}>{m.totalVideos} <span className="text-[13px] font-normal">VT</span></h3>
                      </div>
                      <div>
                        <h3 className={`text-[20px] font-bold ${isAwareness ? 'text-indigo-900' : 'text-blue-900'}`}>{m.totalCreators} <span className="text-[13px] font-normal">Kreator</span></h3>
                      </div>
                    </div>
                  ) : null}

                  {!isAwareness && (
                    <div className="mt-[8px]">
                      <h3 className="text-[20px] font-bold text-blue-900">Rp {(m.gmvOrganic / 1000000).toFixed(1)}M</h3>
                      <p className="text-[11px] font-semibold text-blue-800/80 mt-[4px]">Rp {m.gmvOrganic.toLocaleString()}</p>
                    </div>
                  )}
                  
                  <p className={`text-[11px] mt-[8px] ${isAwareness ? 'text-indigo-600' : 'text-blue-600'}`}>Total {isAwareness ? 'Video & Kreator' : 'Penjualan Organik'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="ccard !p-0 overflow-hidden">
        <div className="p-[16px] border-b border-line bg-slate-50/50">
          <h3 className="text-[16px] font-bold text-text">{isAwareness ? 'Daily Video Tracker' : 'Organic Daily Performance'}</h3>
        </div>
        <div className="tbl-wrap !border-0 !rounded-none">
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <th className="py-[16px]">Tanggal</th>
                {isAwareness || isHybrid ? (
                  <>
                    <th className="py-[16px] text-center">Video Baru</th>
                    <th className="py-[16px] text-center">Kreator Aktif</th>
                  </>
                ) : null}
                {!isAwareness && (
                  <th className="py-[16px] text-right">GMV Organik</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isHybrid ? 4 : 3} className="text-center py-8 text-text-soft">
                    Mengkalkulasi data dari ribuan baris CSV...
                  </td>
                </tr>
              ) : dailyData.length === 0 ? (
                <tr>
                  <td colSpan={isHybrid ? 4 : 3} className="text-center py-8 text-text-soft">
                    Belum ada data untuk campaign ini.
                  </td>
                </tr>
              ) : (
                paginatedDaily.map((d, idx) => (
                  <tr key={idx} className="border-b border-line hover:bg-slate-50/50">
                    <td className="font-medium text-text">
                      {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    
                    {isAwareness || isHybrid ? (
                      <>
                        <td className="text-center font-bold text-indigo-700 bg-indigo-50/30">
                          {d.totalVideos} VT
                        </td>
                        <td className="text-center text-text-soft font-medium">
                          {d.totalCreators} Kreator
                        </td>
                      </>
                    ) : null}

                    {!isAwareness && (
                      <td className="text-right font-bold text-text">
                        Rp {d.gmvOrganic.toLocaleString()}
                      </td>
                    )}
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
