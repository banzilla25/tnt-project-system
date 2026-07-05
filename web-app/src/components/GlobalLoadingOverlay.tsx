"use client";

import { useEffect, useState } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

export function SkeletonTableRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <SkeletonBlock className={`h-4 ${j === 0 ? "w-24" : j === cols - 1 ? "w-16" : "w-full"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function GlobalLoadingOverlay() {
  const isLoading = useDatabaseStore((s) => s.isLoading);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Also show on initial mount (page refresh)
    setVisible(true);
    const t = setTimeout(() => {
      if (!isLoading) setVisible(false);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  if (!mounted || !visible) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
        isLoading ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10">
        <svg className="w-4 h-4 animate-spin text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <div>
          <p className="text-sm font-semibold leading-none">Mohon bersabar</p>
          <p className="text-xs text-slate-400 mt-0.5">Sedang mengambil data...</p>
        </div>
      </div>
    </div>
  );
}
