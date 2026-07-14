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

  // Realtime listener untuk tabel-tabel penting yang butuh kolaborasi
  useSmartRealtime(
    'global-collaboration-realtime',
    [
      'campaign_creators', 
      'videos', 
      'live_schedules', 
      'creator_payments', 
      'creator_addresses', 
      'ads_spends'
    ],
    (table, payload) => applyRealtimeUpdate(table as any, payload),
    5, // 5 menit nganggur -> disconnect
    () => fetchData() // fetch ulang saat bangun dari idle untuk sinkronisasi
  );

  return null;
}
