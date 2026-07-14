"use client";

import { useEffect, useRef } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useSmartRealtime } from "@/hooks/useSmartRealtime";

export function DataLoader() {
  const { fetchData, applyRealtimeUpdate } = useDatabaseStore();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current) {
      fetchData();
      hasFetched.current = true;
    }
  }, [fetchData]);

  // Realtime listener untuk campaign_creators (Persetujuan, update status, dll)
  useSmartRealtime(
    'campaign-creators-realtime',
    'campaign_creators',
    (payload) => applyRealtimeUpdate('campaign_creators', payload),
    5, // 5 menit nganggur -> disconnect
    () => fetchData() // fetch ulang saat bangun dari idle untuk sinkronisasi
  );

  return null;
}
