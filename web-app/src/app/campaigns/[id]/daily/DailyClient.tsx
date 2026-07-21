"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import TimelineTarget from "./TimelineTarget";

export default function CampaignDailyPerformanceClient({
  campaign,
  initialDailyData,
  initialMonthlyData
}: {
  campaign: any;
  initialDailyData: any[];
  initialMonthlyData: any[];
}) {
  const campaignId = campaign.id;

  const [loading, setLoading] = useState(false);
  const [dailyData, setDailyData] = useState<any[]>(initialDailyData || []);
  const [monthlyData, setMonthlyData] = useState<any[]>(initialMonthlyData || []);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

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
