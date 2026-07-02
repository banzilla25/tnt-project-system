"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { createClient } from "@/utils/supabase/client";
import { useParams } from "next/navigation";
import { Search, Radio, Loader2, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

export default function CampaignLiveStreamPage() {
  const { id } = useParams();
  const campaignId = Number(id);
  
  const { campaigns } = useDatabaseStore();
  const campaign = campaigns.find(c => c.id === campaignId);

  const [creators, setCreators] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('gmv');

  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch approved creators
        const { data: ccData, error: ccError } = await supabase
          .from('campaign_creators')
          .select('*, creators!inner(*)')
          .eq('campaign_id', campaignId)
          .eq('approval', 'approved');

        if (ccError) throw ccError;

        // 2. Fetch Livestream Sales
        const { data: sData, error: sError } = await supabase
          .from('sales')
          .select('*')
          .eq('campaign_id', campaignId)
          .in('content_type', ['Livestream', 'Live']);

        if (sError) throw sError;

        // 3. Fetch Livestream Metrics from organic_videos
        const contentUids = sData ? Array.from(new Set(sData.map(s => s.content_uid).filter(Boolean))) : [];
        let metricsData: any[] = [];
        
        if (contentUids.length > 0) {
          const { data: oData } = await supabase
            .from('organic_videos')
            .select('*')
            .in('content_uid', contentUids);
          if (oData) metricsData = oData;
        }

        setCreators(ccData || []);
        setSalesData(sData || []);
        setLiveMetrics(metricsData);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    if (campaignId) fetchData();
  }, [campaignId]);

  const aggregatedData = useMemo(() => {
    let data = creators.map(cc => {
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

    if (searchQuery) {
      data = data.filter(d => d.creators.username.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (sortBy === 'gmv') {
      data.sort((a, b) => b.totalGmv - a.totalGmv);
    } else if (sortBy === 'views') {
      data.sort((a, b) => b.totalViews - a.totalViews);
    } else if (sortBy === 'orders') {
      data.sort((a, b) => b.totalOrders - a.totalOrders);
    }

    return data;
  }, [creators, salesData, liveMetrics, searchQuery, sortBy]);

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
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="none">Urutkan</option>
            <option value="gmv">GMV Tertinggi</option>
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
