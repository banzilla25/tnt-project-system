import React from 'react';
import { Loader2 } from 'lucide-react';

export default function PortalLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      <div className="text-center">
        <h3 className="text-lg font-bold text-slate-800">Menyiapkan Data Portal</h3>
        <p className="text-sm text-slate-500">Sedang menarik data dari database secara real-time...</p>
      </div>
    </div>
  );
}
