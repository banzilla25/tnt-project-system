"use client";

import { useEffect } from "react";
import { useDatabaseStore } from "@/store/useDatabaseStore";

export function DataLoader() {
  const { fetchData } = useDatabaseStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return null;
}
