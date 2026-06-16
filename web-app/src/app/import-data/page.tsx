"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { FolderKanban, Users, MapPin, TrendingUp, AlertCircle, UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, Download } from 'lucide-react';
import { CreatorSyncModal } from '@/components/CreatorSyncModal';
import { CampaignSyncModal } from '@/components/CampaignSyncModal';
import { AddressSyncModal } from '@/components/AddressSyncModal';
import { downloadCreatorSyncTemplate } from '@/utils/importCreatorSync';
import { downloadCampaignSyncTemplate } from '@/utils/importCampaignSync';
import { downloadAddressSyncTemplate } from '@/utils/importAddressSync';

export default function ImportDataPage() {
  const [activeTab, setActiveTab] = useState<'creator' | 'listing' | 'alamat' | 'organik'>('creator');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pusat Migrasi Data</h1>
          <p className="text-slate-500">Impor dan sinkronisasi data dari Spreadsheet ke dalam sistem</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <button 
          onClick={() => setActiveTab('creator')}
          className={`p-4 rounded-xl border text-left transition-colors flex flex-col gap-2 ${activeTab === 'creator' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 hover:border-blue-300'}`}
        >
          <Users className="w-6 h-6" />
          <h3 className="font-bold">Migrasi Creator Pool</h3>
          <p className={`text-xs ${activeTab === 'creator' ? 'text-blue-100' : 'text-slate-500'}`}>Upload ratusan kreator baru</p>
        </button>

        <button 
          onClick={() => setActiveTab('listing')}
          className={`p-4 rounded-xl border text-left transition-colors flex flex-col gap-2 ${activeTab === 'listing' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 hover:border-blue-300'}`}
        >
          <FolderKanban className="w-6 h-6" />
          <h3 className="font-bold">Migrasi Listing Campaign</h3>
          <p className={`text-xs ${activeTab === 'listing' ? 'text-blue-100' : 'text-slate-500'}`}>Sync status approval ke campaign</p>
        </button>

        <button 
          onClick={() => setActiveTab('alamat')}
          className={`p-4 rounded-xl border text-left transition-colors flex flex-col gap-2 ${activeTab === 'alamat' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 hover:border-blue-300'}`}
        >
          <MapPin className="w-6 h-6" />
          <h3 className="font-bold">Migrasi Buku Alamat</h3>
          <p className={`text-xs ${activeTab === 'alamat' ? 'text-blue-100' : 'text-slate-500'}`}>Upload resi & alamat logistik</p>
        </button>

        <button 
          disabled
          className={`p-4 rounded-xl border text-left opacity-60 bg-slate-50 cursor-not-allowed`}
        >
          <TrendingUp className="w-6 h-6 text-slate-400" />
          <h3 className="font-bold text-slate-500">Migrasi Organik</h3>
          <p className="text-xs text-slate-400">Pindah ke menu Input Penjualan</p>
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
        {activeTab === 'creator' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h2 className="text-2xl font-bold mb-2">Migrasi Creator Pool</h2>
              <p className="text-slate-600">Gunakan fitur ini saat Anda memiliki database spreadsheet berisi ribuan kreator baru yang belum pernah dimasukkan ke dalam aplikasi.</p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 text-blue-800 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">Catatan Penting:</p>
                <ul className="list-disc list-inside ml-1 mt-1 space-y-1 text-slate-700">
                  <li>Kolom yang wajib ada adalah <strong>Username</strong>.</li>
                  <li>Sistem otomatis menolak username yang sudah ada (duplicate prevention).</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6">
              <CreatorSyncModal />
              <button 
                onClick={downloadCreatorSyncTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <Download className="w-4 h-4" /> Unduh Template CSV
              </button>
            </div>
          </div>
        )}

        {activeTab === 'listing' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h2 className="text-2xl font-bold mb-2">Migrasi Listing Campaign</h2>
              <p className="text-slate-600">Menyinkronkan data approval (Approve/Reject), catatan PIC, dan progres sample dari Spreadsheet ke dalam sebuah Campaign yang sudah dibuat.</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 text-blue-800 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">Persiapan Data:</p>
                <ul className="list-disc list-inside ml-1 mt-1 space-y-1 text-slate-700">
                  <li>Pastikan Anda sudah membuat Campaign tujuan di menu Campaign.</li>
                  <li>Data di Excel harus memiliki kolom <strong>Username</strong> dan <strong>Status Approval</strong>.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6">
              <CampaignSyncModal />
              <button 
                onClick={downloadCampaignSyncTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <Download className="w-4 h-4" /> Unduh Template CSV
              </button>
            </div>
          </div>
        )}

        {activeTab === 'alamat' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h2 className="text-2xl font-bold mb-2">Migrasi Buku Alamat & Logistik</h2>
              <p className="text-slate-600">Menyinkronkan data alamat pengiriman dan resi paket untuk kreator yang sudah berstatus <strong>Approved</strong> di suatu Campaign.</p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3 text-blue-800 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">Cara Kerja:</p>
                <ul className="list-disc list-inside ml-1 mt-1 space-y-1 text-slate-700">
                  <li>Alamat baru yang belum ada di profil kreator akan <strong>Otomatis ditambahkan ke Buku Alamat</strong> kreator tersebut.</li>
                  <li>Sistem akan mengabaikan kreator yang berstatus Reject/Pending di campaign terpilih.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6">
              <AddressSyncModal />
              <button 
                onClick={downloadAddressSyncTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <Download className="w-4 h-4" /> Unduh Template CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
