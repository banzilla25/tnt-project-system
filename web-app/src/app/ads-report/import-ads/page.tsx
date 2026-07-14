"use client";

import AdsImport from "@/app/input-penjualan/AdsImport";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ImportAdsPage() {
  return (
    <div className="w-full mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/ads-report" className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Data Iklan (TikTok Ads)</h1>
          <p className="text-slate-500">Unggah CSV performa iklan harian dari platform TikTok Ads Manager secara massal.</p>
        </div>
      </div>
      <AdsImport />
    </div>
  );
}
