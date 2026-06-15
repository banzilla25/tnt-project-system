"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
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

  useEffect(() => {
    const fetchDailyData = async () => {
      if (!campaignId) return;
      setLoading(true);
      
      let allSales: any[] = [];
      let allVideosFromCreators: any[] = [];
      
      const isAwareness = campaign?.tipe_campaign === 'awareness';
      const isHybrid = campaign?.tipe_campaign === 'gmv_awareness';

      // 1. Fetch Sales (for Non-Awareness)
      if (!isAwareness) {
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

      if (!isAwareness && allSales.length > 0) {
        allSales.forEach(sale => {
          if (!sale.tanggal) return;
          // Extract YYYY-MM-DD
          const dateStr = sale.tanggal.substring(0, 10);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Performa Harian (Automated)</h2>
          <p className="text-sm text-slate-500">
            {isAwareness 
              ? "Rekap performa VT harian yang dihitung otomatis dari file CSV."
              : "Rekap GMV harian yang dihitung otomatis dari file CSV Organik tanpa perlu input manual."}
          </p>
        </div>
      </div>

      {!loading && monthlyData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {monthlyData.map((m, idx) => {
            const dateObj = new Date(m.month + '-01');
            const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            return (
              <Card key={idx} className={`bg-gradient-to-br ${isAwareness ? 'from-indigo-50 to-purple-100/50 border-indigo-100' : 'from-blue-50 to-indigo-100/50 border-blue-100'} shadow-sm`}>
                <CardContent className="p-4">
                  <p className={`text-xs font-medium uppercase tracking-wider ${isAwareness ? 'text-indigo-800' : 'text-blue-800'}`}>{monthName}</p>
                  
                  {isAwareness || isHybrid ? (
                    <div className="mt-2 flex gap-4">
                      <div>
                        <h3 className={`text-xl font-bold ${isAwareness ? 'text-indigo-900' : 'text-blue-900'}`}>{m.totalVideos} <span className="text-sm font-normal">VT</span></h3>
                      </div>
                      <div>
                        <h3 className={`text-xl font-bold ${isAwareness ? 'text-indigo-900' : 'text-blue-900'}`}>{m.totalCreators} <span className="text-sm font-normal">Kreator</span></h3>
                      </div>
                    </div>
                  ) : null}

                  {!isAwareness && (
                    <div className="mt-2">
                      <h3 className="text-xl font-bold text-blue-900">Rp {(m.gmvOrganic / 1000000).toFixed(1)}M</h3>
                      <p className="text-[10px] font-semibold text-blue-800/80 mt-1">Rp {m.gmvOrganic.toLocaleString()}</p>
                    </div>
                  )}
                  
                  <p className={`text-[10px] mt-2 ${isAwareness ? 'text-indigo-600' : 'text-blue-600'}`}>Total {isAwareness ? 'Video & Kreator' : 'Penjualan Organik'}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <CardTitle className="text-base">{isAwareness ? 'Daily Video Tracker' : 'Organic Daily Performance'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-4">Tanggal</TableHead>
                {isAwareness || isHybrid ? (
                  <>
                    <TableHead className="py-4 text-center">Video Baru</TableHead>
                    <TableHead className="py-4 text-center">Kreator Aktif</TableHead>
                  </>
                ) : null}
                {!isAwareness && (
                  <TableHead className="py-4 text-right">GMV Organik</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isHybrid ? 4 : 3} className="text-center py-8 text-slate-400">
                    Mengkalkulasi data dari ribuan baris CSV...
                  </TableCell>
                </TableRow>
              ) : dailyData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isHybrid ? 4 : 3} className="text-center py-8 text-slate-400">
                    Belum ada data untuk campaign ini.
                  </TableCell>
                </TableRow>
              ) : (
                dailyData.map((d, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium text-slate-700">
                      {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </TableCell>
                    
                    {isAwareness || isHybrid ? (
                      <>
                        <TableCell className="text-center font-bold text-indigo-700 bg-indigo-50/30">
                          {d.totalVideos} VT
                        </TableCell>
                        <TableCell className="text-center text-slate-600 font-medium">
                          {d.totalCreators} Kreator
                        </TableCell>
                      </>
                    ) : null}

                    {!isAwareness && (
                      <TableCell className="text-right font-bold text-slate-900">
                        Rp {d.gmvOrganic.toLocaleString()}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
