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
                <th className="py-[16px]">Tanggal</th>
                <th className="py-[16px] text-center">Video Baru</th>
                <th className="py-[16px] text-center">Kreator Aktif</th>
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
                    <td className="font-medium text-text">
                      {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </td>
                    
                    <td className="text-center font-bold text-indigo-700 bg-indigo-50/30">
                      {d.totalVideos} VT
                    </td>
                    <td className="text-center text-text-soft font-medium">
                      {d.totalCreators} Kreator
                    </td>
                    <td className="text-right font-bold text-emerald-600">
                      Rp {(d.gmvOrganic || 0).toLocaleString()}
                    </td>
                    <td className="text-right font-bold text-blue-600 pr-6">
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
