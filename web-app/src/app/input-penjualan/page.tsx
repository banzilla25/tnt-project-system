"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, Lock } from 'lucide-react';
import * as xlsx from 'xlsx';
import { uploadOrganik } from './actions/uploadOrganik';
import { uploadAds } from './actions/uploadAds';
import OrganicImport from './OrganicImport';
import AdsImport from './AdsImport';
import { useAuth } from '@/providers/AuthProvider';
import { LiveSyncModal } from '@/components/LiveSyncModal';

export default function InputPenjualanPage() {
  const [activeTab, setActiveTab] = useState<'organik' | 'ads' | 'live'>('organik');
  const { profile } = useAuth();
  
  const isManager = profile?.role === 'manager';

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-2">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Akses Ditolak</h2>
        <p className="text-slate-500 max-w-md">
          Hanya pengguna dengan role <span className="font-semibold text-slate-700">Manager</span> yang diizinkan untuk melakukan import data penjualan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Input Penjualan</h1>
        <p className="text-slate-500 mt-1">Upload file export dari TikTok Partner Center & Ads Manager</p>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'organik' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('organik')}
        >
          Data Organik
          {activeTab === 'organik' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'ads' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('ads')}
        >
          Data Ads
          {activeTab === 'ads' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
          )}
        </button>
        <button
          className={`pb-4 px-4 font-medium text-sm transition-colors relative ${activeTab === 'live' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('live')}
        >
          Data Live Organik
          {activeTab === 'live' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'organik' && (
        <OrganicImport />
      )}

      {activeTab === 'ads' && (
        <AdsImport />
      )}

      {activeTab === 'live' && (
        <div className="py-8">
          <LiveSyncModal />
        </div>
      )}
    </div>
  );
}
