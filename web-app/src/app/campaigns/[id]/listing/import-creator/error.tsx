"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AlertCircle, RefreshCw, ArrowLeft, Trash2 } from "lucide-react";

export default function ImportCreatorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;
  const campaignId = Number(Array.isArray(rawId) ? rawId[0] : rawId);

  useEffect(() => {
    console.error("Import Creator Error Boundary caught:", error);
  }, [error]);

  const handleClearDraftAndReload = () => {
    try {
      if (typeof window !== "undefined") {
        if (campaignId) {
          localStorage.removeItem(`tnt_import_creator_${campaignId}`);
        }
        // Also remove any possible NaN key
        localStorage.removeItem("tnt_import_creator_NaN");
      }
    } catch (e) {
      console.warn("Failed to clear localStorage:", e);
    }
    reset();
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-50/50">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800">
            Halaman Import Mengalami Kendala
          </h2>
          <p className="text-sm text-slate-500">
            Terjadi error saat memuat tabel data. Ini biasanya terjadi jika terdapat riwayat salinan (draft) data Excel yang rusak atau terlalu besar di browser laptop ini.
          </p>
        </div>

        {error?.message && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs font-mono text-slate-600 max-h-24 overflow-y-auto">
            {error.message}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={handleClearDraftAndReload}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Bersihkan Draft & Muat Ulang
          </Button>

          <Button
            variant="outline"
            onClick={() => reset()}
            className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Coba Lagi
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              if (campaignId) {
                router.push(`/campaigns/${campaignId}/listing`);
              } else {
                router.back();
              }
            }}
            className="w-full text-slate-500 hover:text-slate-700 text-xs flex items-center justify-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Listing
          </Button>
        </div>
      </div>
    </div>
  );
}
