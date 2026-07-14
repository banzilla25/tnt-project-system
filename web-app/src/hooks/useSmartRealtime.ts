"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function useSmartRealtime(
  channelName: string,
  tables: string[],
  onPayload: (table: string, payload: any) => void,
  idleTimeoutMinutes: number = 5,
  onWakeUp?: () => void
) {
  const supabase = createClient();
  const [isIdle, setIsIdle] = useState(false);
  const isIdleRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const subscribe = () => {
    if (channelRef.current) return;
    
    let channel = supabase.channel(channelName);
    
    tables.forEach(table => {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: table }, (payload) => {
        onPayload(table, payload);
      });
    });
    
    channelRef.current = channel.subscribe();
  };

  const unsubscribe = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  const resetTimer = () => {
    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
      // Wake up and subscribe
      subscribe();
      if (onWakeUp) onWakeUp();
    }
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
      setIsIdle(true);
      unsubscribe();
    }, idleTimeoutMinutes * 60 * 1000);
  };

  useEffect(() => {
    // Initial subscribe
    subscribe();
    resetTimer();

    // Listeners for user activity
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    const handleActivity = () => resetTimer();

    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isIdle };
}
