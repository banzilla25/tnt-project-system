"use client";

import React, { useMemo, useRef, useEffect } from "react";

type TimelineTargetProps = {
  campaign: any;
  dailyData: any[];
};

export default function TimelineTarget({ campaign, dailyData }: TimelineTargetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAwareness = campaign.tipe_campaign === 'awareness';
  const isHybrid = campaign.tipe_campaign === 'gmv_awareness';
  const isSales = campaign.tipe_campaign === 'sales' || !campaign.tipe_campaign;

  const targetGmv = Number(campaign.target_gmv) || 0;
  const targetVideo = Number(campaign.target_video) || 0;
  const targetLive = Number(campaign.target_live) || 0;
  const targetCreator = Number(campaign.target_creator) || 0;
  const targetCreatorLive = Number(campaign.target_creator_live) || 0;

  const hasAnyTarget = targetGmv > 0 || targetVideo > 0 || targetCreator > 0;

  const timelineData = useMemo(() => {
    if (!campaign.start_date) return [];

    const startDate = new Date(campaign.start_date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = campaign.end_date ? new Date(campaign.end_date) : new Date();
    endDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Determine the last day of the timeline
    // If it's past end_date and not finished, extend to today
    let lastTimelineDate = new Date(endDate);
    if (campaign.status !== 'selesai' && today.getTime() > endDate.getTime()) {
      lastTimelineDate = new Date(today);
    }

    // Pre-calculate total working days
    let totalWorkingDays = 0;
    let tempCurr = new Date(startDate);
    while (tempCurr.getTime() <= lastTimelineDate.getTime()) {
      if (tempCurr.getDay() !== 0 && tempCurr.getDay() !== 6) totalWorkingDays++;
      tempCurr.setDate(tempCurr.getDate() + 1);
    }

    const achievedMap = new Map();
    dailyData.forEach(d => {
      const dDate = new Date(d.date);
      dDate.setHours(0, 0, 0, 0);
      achievedMap.set(dDate.getTime(), {
        gmv: (Number(d.gmvOrganic) || 0) + (Number(d.gmvAds) || 0),
        video: Number(d.totalVideos) || 0,
        live: Number(d.totalLiveSessions) || 0,
        creator: Number(d.totalCreators) || 0,
        pendingCreator: Number(d.totalPendingCreators) || 0,
        pendingNano: Number(d.pendingNano) || 0,
        pendingMicro: Number(d.pendingMicro) || 0,
        pendingMacro: Number(d.pendingMacro) || 0,
        pendingMega: Number(d.pendingMega) || 0,
        approvedNano: Number(d.approvedNano) || 0,
        approvedMicro: Number(d.approvedMicro) || 0,
        approvedMacro: Number(d.approvedMacro) || 0,
        approvedMega: Number(d.approvedMega) || 0,
        liveCreator: Number(d.totalLiveCreators) || 0,
        pendingLiveCreator: Number(d.totalPendingLiveCreators) || 0,
        pendingLiveNano: Number(d.pendingLiveNano) || 0,
        pendingLiveMicro: Number(d.pendingLiveMicro) || 0,
        pendingLiveMacro: Number(d.pendingLiveMacro) || 0,
        pendingLiveMega: Number(d.pendingLiveMega) || 0,
        approvedLiveNano: Number(d.approvedLiveNano) || 0,
        approvedLiveMicro: Number(d.approvedLiveMicro) || 0,
        approvedLiveMacro: Number(d.approvedLiveMacro) || 0,
        approvedLiveMega: Number(d.approvedLiveMega) || 0,
      });
    });

    let cumulativeGmv = 0;
    let cumulativeVideo = 0;
    let cumulativeLive = 0;
    let cumulativeCreator = 0;
    let cumulativePendingCreator = 0;
    let cumulativeLiveCreator = 0;
    let cumulativePendingLiveCreator = 0;

    const data = [];

    // Weekly aggregates
    let currentWeekGmvTargetVelocity = 0;
    let currentWeekVideoTargetVelocity = 0;
    let currentWeekLiveTargetVelocity = 0;
    let currentWeekCreatorTargetVelocity = 0;
    let currentWeekLiveCreatorTargetVelocity = 0;
    let currentWeekWorkingDaysCount = 0;

    let currentWeekGmvAchieve = 0;
    let currentWeekVideoAchieve = 0;
    let currentWeekLiveAchieve = 0;
    let currentWeekCreatorAchieve = 0;
    let currentWeekPendingCreatorAchieve = 0;
    let currentWeekPendingNano = 0;
    let currentWeekPendingMicro = 0;
    let currentWeekPendingMacro = 0;
    let currentWeekPendingMega = 0;
    let currentWeekApprovedNano = 0;
    let currentWeekApprovedMicro = 0;
    let currentWeekApprovedMacro = 0;
    let currentWeekApprovedMega = 0;

    let currentWeekLiveCreatorAchieve = 0;
    let currentWeekPendingLiveCreatorAchieve = 0;
    let currentWeekPendingLiveNano = 0;
    let currentWeekPendingLiveMicro = 0;
    let currentWeekPendingLiveMacro = 0;
    let currentWeekPendingLiveMega = 0;
    let currentWeekApprovedLiveNano = 0;
    let currentWeekApprovedLiveMicro = 0;
    let currentWeekApprovedLiveMacro = 0;
    let currentWeekApprovedLiveMega = 0;

    let remainingWorkingDays = totalWorkingDays;
    let curr = new Date(startDate);
    let lastNodeIndex = -1;

    while (curr.getTime() <= lastTimelineDate.getTime()) {
      const time = curr.getTime();
      const dayOfWeek = curr.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isPastEndDate = time > endDate.getTime();
      
      const achievedToday = achievedMap.get(time) || { gmv: 0, video: 0, live: 0, creator: 0, pendingCreator: 0 };

      // Accumulate achievements (EVERY day)
      currentWeekGmvAchieve += achievedToday.gmv;
      currentWeekVideoAchieve += achievedToday.video;
      currentWeekLiveAchieve += achievedToday.live;
      currentWeekCreatorAchieve += achievedToday.creator;
      currentWeekPendingCreatorAchieve += achievedToday.pendingCreator;
      currentWeekPendingNano += achievedToday.pendingNano;
      currentWeekPendingMicro += achievedToday.pendingMicro;
      currentWeekPendingMacro += achievedToday.pendingMacro;
      currentWeekPendingMega += achievedToday.pendingMega;
      currentWeekApprovedNano += achievedToday.approvedNano;
      currentWeekApprovedMicro += achievedToday.approvedMicro;
      currentWeekApprovedMacro += achievedToday.approvedMacro;
      currentWeekApprovedMega += achievedToday.approvedMega;
      currentWeekLiveCreatorAchieve += achievedToday.liveCreator;
      currentWeekPendingLiveCreatorAchieve += achievedToday.pendingLiveCreator;
      currentWeekPendingLiveNano += achievedToday.pendingLiveNano;
      currentWeekPendingLiveMicro += achievedToday.pendingLiveMicro;
      currentWeekPendingLiveMacro += achievedToday.pendingLiveMacro;
      currentWeekPendingLiveMega += achievedToday.pendingLiveMega;
      currentWeekApprovedLiveNano += achievedToday.approvedLiveNano;
      currentWeekApprovedLiveMicro += achievedToday.approvedLiveMicro;
      currentWeekApprovedLiveMacro += achievedToday.approvedLiveMacro;
      currentWeekApprovedLiveMega += achievedToday.approvedLiveMega;

      let targetForTodayGmv = 0;
      let targetForTodayVideo = 0;
      let targetForTodayLive = 0;
      let targetForTodayCreator = 0;
      let targetForTodayLiveCreator = 0;

      if (!isWeekend) {
        const remGmv = Math.max(0, targetGmv - cumulativeGmv);
        const remVideo = Math.max(0, targetVideo - cumulativeVideo);
        const remLive = Math.max(0, targetLive - cumulativeLive);
        const remCreator = Math.max(0, targetCreator - cumulativeCreator);
        const remLiveCreator = Math.max(0, targetCreatorLive - cumulativeLiveCreator);

        const divisor = isPastEndDate ? 1 : Math.max(1, remainingWorkingDays);

        targetForTodayGmv = remGmv / divisor;
        targetForTodayVideo = remVideo / divisor;
        targetForTodayLive = remLive / divisor;
        targetForTodayCreator = remCreator / divisor;
        targetForTodayLiveCreator = remLiveCreator / divisor;

        // If this is the first working day of the week, lock in the weekly velocity
        if (currentWeekWorkingDaysCount === 0) {
          currentWeekGmvTargetVelocity = targetForTodayGmv;
          currentWeekVideoTargetVelocity = targetForTodayVideo;
          currentWeekLiveTargetVelocity = targetForTodayLive;
          currentWeekCreatorTargetVelocity = targetForTodayCreator;
          currentWeekLiveCreatorTargetVelocity = targetForTodayLiveCreator;
        }
        currentWeekWorkingDaysCount++;

        remainingWorkingDays--;
      }

      const node = {
        date: new Date(curr),
        isPastEndDate,
        targetGmv: targetForTodayGmv,
        targetVideo: targetForTodayVideo,
        targetLive: targetForTodayLive,
        targetCreator: targetForTodayCreator,
        targetCreatorLive: targetForTodayLiveCreator,
        achievedGmv: achievedToday.gmv,
        achievedVideo: achievedToday.video,
        achievedLive: achievedToday.live,
        achievedCreator: achievedToday.creator,
        achievedPendingCreator: achievedToday.pendingCreator,
        achievedPendingNano: achievedToday.pendingNano,
        achievedPendingMicro: achievedToday.pendingMicro,
        achievedPendingMacro: achievedToday.pendingMacro,
        achievedPendingMega: achievedToday.pendingMega,
        achievedApprovedNano: achievedToday.approvedNano,
        achievedApprovedMicro: achievedToday.approvedMicro,
        achievedApprovedMacro: achievedToday.approvedMacro,
        achievedApprovedMega: achievedToday.approvedMega,
        liveCreator: achievedToday.liveCreator,
        pendingLiveCreator: achievedToday.pendingLiveCreator,
        pendingLiveNano: achievedToday.pendingLiveNano,
        pendingLiveMicro: achievedToday.pendingLiveMicro,
        pendingLiveMacro: achievedToday.pendingLiveMacro,
        pendingLiveMega: achievedToday.pendingLiveMega,
        approvedLiveNano: achievedToday.approvedLiveNano,
        approvedLiveMicro: achievedToday.approvedLiveMicro,
        approvedLiveMacro: achievedToday.approvedLiveMacro,
        approvedLiveMega: achievedToday.approvedLiveMega,
        weeklySummary: null as any
      };
      
      data.push(node);
      lastNodeIndex = data.length - 1;

      // Update cumulatives for NEXT day calculation
      cumulativeGmv += achievedToday.gmv;
      cumulativeVideo += achievedToday.video;
      cumulativeLive += achievedToday.live;
      cumulativeCreator += achievedToday.creator;
      cumulativePendingCreator += achievedToday.pendingCreator;

      // End of week logic: Sunday is the true end of the week, or it's the absolute last day of timeline
      const isSunday = dayOfWeek === 0;
      const isLastDay = curr.getTime() === lastTimelineDate.getTime();
      
      if (isSunday || isLastDay) {
        if (lastNodeIndex >= 0) {
          data[lastNodeIndex].weeklySummary = {
            targetGmv: currentWeekGmvTargetVelocity * currentWeekWorkingDaysCount,
            targetVideo: currentWeekVideoTargetVelocity * currentWeekWorkingDaysCount,
            targetLive: currentWeekLiveTargetVelocity * currentWeekWorkingDaysCount,
            targetCreator: currentWeekCreatorTargetVelocity * currentWeekWorkingDaysCount,
            targetCreatorLive: currentWeekLiveCreatorTargetVelocity * currentWeekWorkingDaysCount,
            achievedGmv: currentWeekGmvAchieve,
            achievedVideo: currentWeekVideoAchieve,
            achievedLive: currentWeekLiveAchieve,
            achievedCreator: currentWeekCreatorAchieve,
            achievedPendingCreator: currentWeekPendingCreatorAchieve,
            achievedPendingNano: currentWeekPendingNano,
            achievedPendingMicro: currentWeekPendingMicro,
            achievedPendingMacro: currentWeekPendingMacro,
            achievedPendingMega: currentWeekPendingMega,
            achievedApprovedNano: currentWeekApprovedNano,
            achievedApprovedMicro: currentWeekApprovedMicro,
            achievedApprovedMacro: currentWeekApprovedMacro,
            achievedApprovedMega: currentWeekApprovedMega,
            liveCreatorAchieve: currentWeekLiveCreatorAchieve,
            pendingLiveCreatorAchieve: currentWeekPendingLiveCreatorAchieve,
            pendingLiveNano: currentWeekPendingLiveNano,
            pendingLiveMicro: currentWeekPendingLiveMicro,
            pendingLiveMacro: currentWeekPendingLiveMacro,
            pendingLiveMega: currentWeekPendingLiveMega,
            approvedLiveNano: currentWeekApprovedLiveNano,
            approvedLiveMicro: currentWeekApprovedLiveMicro,
            approvedLiveMacro: currentWeekApprovedLiveMacro,
            approvedLiveMega: currentWeekApprovedLiveMega,
          };
        }
        
        // Reset for next week
        currentWeekGmvTargetVelocity = 0;
        currentWeekVideoTargetVelocity = 0;
        currentWeekLiveTargetVelocity = 0;
        currentWeekCreatorTargetVelocity = 0;
        currentWeekLiveCreatorTargetVelocity = 0;
        currentWeekWorkingDaysCount = 0;

        currentWeekGmvAchieve = 0;
        currentWeekVideoAchieve = 0;
        currentWeekLiveAchieve = 0;
        currentWeekCreatorAchieve = 0;
        currentWeekPendingCreatorAchieve = 0;
        currentWeekPendingNano = 0;
        currentWeekPendingMicro = 0;
        currentWeekPendingMacro = 0;
        currentWeekPendingMega = 0;
        currentWeekApprovedNano = 0;
        currentWeekApprovedMicro = 0;
        currentWeekApprovedMacro = 0;
        currentWeekApprovedMega = 0;
        currentWeekLiveCreatorAchieve = 0;
        currentWeekPendingLiveCreatorAchieve = 0;
        currentWeekPendingLiveNano = 0;
        currentWeekPendingLiveMicro = 0;
        currentWeekPendingLiveMacro = 0;
        currentWeekPendingLiveMega = 0;
        currentWeekApprovedLiveNano = 0;
        currentWeekApprovedLiveMicro = 0;
        currentWeekApprovedLiveMacro = 0;
        currentWeekApprovedLiveMega = 0;
      }

      curr.setDate(curr.getDate() + 1);
    }

    return data;
  }, [campaign, dailyData, targetGmv, targetVideo, targetLive, targetCreator]);

  const scrollToToday = () => {
    if (scrollRef.current) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let closestIdx = timelineData.length - 1;
      for (let i = 0; i < timelineData.length; i++) {
        if (timelineData[i].date.getTime() === today.getTime()) {
          closestIdx = i;
          break;
        }
      }
      
      const itemWidth = 216; // width 200 + gap 16
      const targetLeft = Math.max(0, closestIdx * itemWidth - scrollRef.current.clientWidth / 2 + 100);
      
      scrollRef.current.scrollTo({
        left: targetLeft,
        behavior: 'smooth'
      });
    }
  };

  // Auto-scroll to current day or end
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToToday();
    }, 300); // Give it a bit of time to render the DOM width correctly

    return () => clearTimeout(timer);
  }, [timelineData]);

  if (timelineData.length === 0) return null;

  return (
    <div className="ccard mb-[24px]">
      <div className="p-[16px] border-b border-line flex justify-between items-center">
        <div>
          <h3 className="text-[16px] font-bold text-text">Timeline Target Harian</h3>
          <p className="text-[13px] text-text-soft">Target otomatis disesuaikan secara dinamis (sisa target dibagi sisa hari kerja).</p>
        </div>
        <button 
          onClick={scrollToToday}
          className="px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors shadow-sm whitespace-nowrap"
        >
          Hari Ini
        </button>
      </div>
      
      <div 
        ref={scrollRef}
        className="overflow-x-auto pb-10 pt-10 px-8 custom-scrollbar"
        style={{ cursor: 'grab' }}
        onMouseDown={(e) => {
          const ele = scrollRef.current;
          if (!ele) return;
          ele.style.cursor = 'grabbing';
          ele.style.userSelect = 'none';
          
          let pos = {
            left: ele.scrollLeft,
            x: e.clientX,
          };
          
          const mouseMoveHandler = (e: MouseEvent) => {
            const dx = e.clientX - pos.x;
            ele.scrollLeft = pos.left - dx;
          };
          
          const mouseUpHandler = () => {
            ele.style.cursor = 'grab';
            ele.style.removeProperty('user-select');
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
          };
          
          document.addEventListener('mousemove', mouseMoveHandler);
          document.addEventListener('mouseup', mouseUpHandler);
        }}
      >
        <div className="relative min-w-max">
          {/* Main timeline line */}
          <div className="absolute top-[50%] left-0 right-0 h-[2px] border-t-2 border-dashed border-slate-300 -translate-y-1/2 z-0"></div>
          
          <div className="flex items-center gap-[16px] relative z-10 min-h-[300px]">
            {timelineData.map((day, idx) => {
              const isToday = day.date.getTime() === new Date().setHours(0, 0, 0, 0);
              const showWeekly = !!day.weeklySummary;
              const isTop = !showWeekly && (idx % 2 === 0);
              
              return (
                <div key={idx} className="relative flex flex-col items-center min-w-[200px]">
                  
                  {/* Highlight Block for Today */}
                  {isToday && (
                    <div className="absolute inset-y-[-24px] left-[-8px] right-[-8px] bg-rose-50/50 border border-rose-100 rounded-xl z-0 shadow-sm pointer-events-none"></div>
                  )}

                  {/* Top Area (For weekly blocks or alternate daily blocks) */}
                  <div className="h-[120px] w-full flex items-end justify-center pb-[24px]">
                    {showWeekly && day.weeklySummary ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 w-full shadow-sm text-center relative z-20">
                        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-50 border-b border-r border-blue-200 rotate-45"></div>
                        <h4 className="text-xs font-bold text-blue-900 mb-1">Target Minggu Ini</h4>
                        
                        <div className="text-[10px] text-blue-800 flex justify-between px-2">
                          <span>GMV:</span>
                          <span className={day.weeklySummary.achievedGmv >= day.weeklySummary.targetGmv && targetGmv > 0 ? 'text-emerald-700 font-bold' : 'font-medium'}>
                            Rp {Math.round(day.weeklySummary.achievedGmv).toLocaleString()} {targetGmv > 0 ? `/ Rp ${Math.round(day.weeklySummary.targetGmv).toLocaleString()}` : ''}
                          </span>
                        </div>
                        <div className="text-[10px] text-blue-800 flex justify-between px-2">
                          <span>VT:</span>
                          <span className={day.weeklySummary.achievedVideo >= day.weeklySummary.targetVideo && targetVideo > 0 ? 'text-emerald-700 font-bold' : 'font-medium'}>
                            {Math.round(day.weeklySummary.achievedVideo)} {targetVideo > 0 ? `/ ${Math.round(day.weeklySummary.targetVideo)}` : ''}
                          </span>
                        </div>
                        <div className="text-[10px] text-blue-800 flex justify-between px-2">
                          <span>Live:</span>
                          <span className={day.weeklySummary.achievedLive >= day.weeklySummary.targetLive && targetLive > 0 ? 'text-emerald-700 font-bold' : 'font-medium'}>
                            {Math.round(day.weeklySummary.achievedLive)} {targetLive > 0 ? `/ ${Math.round(day.weeklySummary.targetLive)}` : ''}
                          </span>
                        </div>
                        <div className="text-[10px] text-blue-800 flex flex-col px-2 mt-1">
                          <div className="flex justify-between">
                            <span>Kr Ditambah:</span>
                            <span className="font-medium text-amber-600">
                              {Math.round(day.weeklySummary.achievedPendingCreator)}
                            </span>
                          </div>
                          <div className="text-[9px] text-blue-600/70 mt-[2px] leading-tight">
                             N: {day.weeklySummary.achievedPendingNano} | Mi: {day.weeklySummary.achievedPendingMicro} | Ma: {day.weeklySummary.achievedPendingMacro} | Me: {day.weeklySummary.achievedPendingMega}
                          </div>
                        </div>
                        <div className="text-[10px] text-blue-800 flex flex-col px-2 mt-1">
                          <div className="flex justify-between">
                            <span>Kr Approve:</span>
                            <span className={day.weeklySummary.achievedCreator >= day.weeklySummary.targetCreator && targetCreator > 0 ? 'text-emerald-700 font-bold' : 'font-medium'}>
                              {Math.round(day.weeklySummary.achievedCreator)} {targetCreator > 0 ? `/ ${Math.round(day.weeklySummary.targetCreator)}` : ''}
                            </span>
                          </div>
                          <div className="text-[9px] text-blue-600/70 mt-[2px] leading-tight">
                             N: {day.weeklySummary.achievedApprovedNano} | Mi: {day.weeklySummary.achievedApprovedMicro} | Ma: {day.weeklySummary.achievedApprovedMacro} | Me: {day.weeklySummary.achievedApprovedMega}
                          </div>
                        </div>
                        {/* Live Creator Weekly UI */}
                        {targetCreatorLive > 0 && (
                          <>
                            <div className="text-[10px] text-purple-800 flex flex-col px-2 mt-1">
                              <div className="flex justify-between">
                                <span>Kr Live Ditambah:</span>
                                <span className="font-medium text-amber-600">
                                  {Math.round(day.weeklySummary.pendingLiveCreatorAchieve)}
                                </span>
                              </div>
                              <div className="text-[9px] text-purple-600/70 mt-[2px] leading-tight">
                                 N: {day.weeklySummary.pendingLiveNano} | Mi: {day.weeklySummary.pendingLiveMicro} | Ma: {day.weeklySummary.pendingLiveMacro} | Me: {day.weeklySummary.pendingLiveMega}
                              </div>
                            </div>
                            <div className="text-[10px] text-purple-800 flex flex-col px-2 mt-1 border-t border-purple-200/50 pt-1">
                              <div className="flex justify-between">
                                <span>Kr Live Approve:</span>
                                <span className={day.weeklySummary.liveCreatorAchieve >= day.weeklySummary.targetCreatorLive && targetCreatorLive > 0 ? 'text-emerald-700 font-bold' : 'font-medium'}>
                                  {Math.round(day.weeklySummary.liveCreatorAchieve)} {targetCreatorLive > 0 ? `/ ${Math.round(day.weeklySummary.targetCreatorLive)}` : ''}
                                </span>
                              </div>
                              <div className="text-[9px] text-purple-600/70 mt-[2px] leading-tight">
                                 N: {day.weeklySummary.approvedLiveNano} | Mi: {day.weeklySummary.approvedLiveMicro} | Ma: {day.weeklySummary.approvedLiveMacro} | Me: {day.weeklySummary.approvedLiveMega}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : isTop ? (
                      <div className={`rounded-lg p-3 w-[180px] shadow-sm relative z-20 ${isToday ? 'bg-rose-50 border border-rose-200' : 'bg-white border border-slate-200'}`}>
                         <div className={`absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 border-b border-r rotate-45 ${isToday ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}></div>
                         <h4 className="text-[10px] font-bold text-slate-700 mb-1">
                           {day.date.toLocaleDateString('id-ID', { weekday: 'long' })} 
                           {day.isPastEndDate && <span className="text-rose-500 ml-1">(Overdue)</span>}
                         </h4>
                         
                         <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                           <span>GMV:</span>
                           <span className={day.achievedGmv >= day.targetGmv && targetGmv > 0 ? 'text-emerald-600 font-bold' : 'font-medium'}>
                             {Math.round(day.achievedGmv).toLocaleString()} {targetGmv > 0 ? `/ ${Math.round(day.targetGmv).toLocaleString()}` : ''}
                           </span>
                         </div>
                         <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                           <span>VT:</span>
                           <span className={day.achievedVideo >= day.targetVideo && targetVideo > 0 ? 'text-emerald-600 font-bold' : 'font-medium'}>
                             {Math.round(day.achievedVideo)} {targetVideo > 0 ? `/ ${Math.round(day.targetVideo)}` : ''}
                           </span>
                         </div>
                         <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                           <span>Live:</span>
                           <span className={day.achievedLive >= day.targetLive && targetLive > 0 ? 'text-emerald-600 font-bold' : 'font-medium'}>
                             {Math.round(day.achievedLive)} {targetLive > 0 ? `/ ${Math.round(day.targetLive)}` : ''}
                           </span>
                         </div>
                         <div className="text-[10px] text-slate-600 flex flex-col border-t border-slate-100 pt-1 mt-1">
                           <div className="flex justify-between">
                             <span>Kr Ditambah:</span>
                             <span className="font-medium text-amber-600">
                               {Math.round(day.achievedPendingCreator)}
                             </span>
                           </div>
                           <div className="text-[9px] text-slate-400 mt-[2px] leading-tight">
                             N: {day.achievedPendingNano} | Mi: {day.achievedPendingMicro} | Ma: {day.achievedPendingMacro} | Me: {day.achievedPendingMega}
                           </div>
                         </div>
                         <div className="text-[10px] text-slate-600 flex flex-col border-t border-slate-100 pt-1 mt-1">
                           <div className="flex justify-between">
                             <span>Kr Approve:</span>
                             <span className={day.achievedCreator >= day.targetCreator && targetCreator > 0 ? 'text-emerald-600 font-bold' : 'font-medium'}>
                               {Math.round(day.achievedCreator)} {targetCreator > 0 ? `/ ${Math.round(day.targetCreator)}` : ''}
                             </span>
                           </div>
                           <div className="text-[9px] text-slate-400 mt-[2px] leading-tight">
                             N: {day.achievedApprovedNano} | Mi: {day.achievedApprovedMicro} | Ma: {day.achievedApprovedMacro} | Me: {day.achievedApprovedMega}
                           </div>
                         </div>
                         {/* Live Creator Daily UI */}
                         {targetCreatorLive > 0 && (
                           <>
                             <div className="text-[10px] text-purple-700 flex flex-col border-t border-purple-100 pt-1 mt-1">
                               <div className="flex justify-between">
                                 <span>Kr Live Ditambah:</span>
                                 <span className="font-medium text-amber-600">
                                   {Math.round(day.pendingLiveCreator)}
                                 </span>
                               </div>
                               <div className="text-[9px] text-purple-400/80 mt-[2px] leading-tight">
                                 N: {day.pendingLiveNano} | Mi: {day.pendingLiveMicro} | Ma: {day.pendingLiveMacro} | Me: {day.pendingLiveMega}
                               </div>
                             </div>
                             <div className="text-[10px] text-purple-700 flex flex-col border-t border-purple-100 pt-1 mt-1">
                               <div className="flex justify-between">
                                 <span>Kr Live Approve:</span>
                                 <span className={day.liveCreator >= day.targetCreatorLive && targetCreatorLive > 0 ? 'text-emerald-600 font-bold' : 'font-medium'}>
                                   {Math.round(day.liveCreator)} {targetCreatorLive > 0 ? `/ ${Math.round(day.targetCreatorLive)}` : ''}
                                 </span>
                               </div>
                               <div className="text-[9px] text-purple-400/80 mt-[2px] leading-tight">
                                 N: {day.approvedLiveNano} | Mi: {day.approvedLiveMicro} | Ma: {day.approvedLiveMacro} | Me: {day.approvedLiveMega}
                               </div>
                             </div>
                           </>
                         )}
                      </div>
                    ) : null}
                  </div>

                  {/* Center Dot */}
                  <div className="relative my-2 z-20">
                    <div className={`w-3 h-3 rounded-full border-2 border-white ring-2 ${isToday ? 'bg-blue-500 ring-blue-300 ring-4' : day.isPastEndDate ? 'bg-rose-400 ring-rose-200' : 'bg-emerald-500 ring-emerald-200'} relative`} title={day.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}></div>
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-slate-500 bg-white/80 px-1 rounded">
                      {day.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Bottom Area (For alternate daily blocks) */}
                  <div className="h-[120px] w-full flex items-start justify-center pt-[32px] gap-2">
                    
                    {!isTop && (
                      <div className={`rounded-lg p-3 w-[180px] shadow-sm relative z-20 ${isToday ? 'bg-rose-50 border border-rose-200' : 'bg-white border border-slate-200'}`}>
                         <div className={`absolute top-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 border-t border-l rotate-45 ${isToday ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}></div>
                         <h4 className="text-[10px] font-bold text-slate-700 mb-1">
                           {day.date.toLocaleDateString('id-ID', { weekday: 'long' })} 
                           {day.isPastEndDate && <span className="text-rose-500 ml-1">(Overdue)</span>}
                         </h4>
                         
                         <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                           <span>GMV:</span>
                           <span className={day.achievedGmv >= day.targetGmv && targetGmv > 0 ? 'text-emerald-600 font-bold' : 'font-medium'}>
                             {Math.round(day.achievedGmv).toLocaleString()} {targetGmv > 0 ? `/ ${Math.round(day.targetGmv).toLocaleString()}` : ''}
                           </span>
                         </div>
                         <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                           <span>VT:</span>
                           <span className={day.achievedVideo >= day.targetVideo && targetVideo > 0 ? 'text-emerald-600 font-bold' : 'font-medium'}>
                             {Math.round(day.achievedVideo)} {targetVideo > 0 ? `/ ${Math.round(day.targetVideo)}` : ''}
                           </span>
                         </div>
                         <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                           <span>Live:</span>
                           <span className={day.achievedLive >= day.targetLive && targetLive > 0 ? 'text-emerald-600 font-bold' : 'font-medium'}>
                             {Math.round(day.achievedLive)} {targetLive > 0 ? `/ ${Math.round(day.targetLive)}` : ''}
                           </span>
                         </div>
                         <div className="text-[10px] text-slate-600 flex flex-col border-t border-slate-100 pt-1 mt-1">
                           <div className="flex justify-between">
                             <span>Kr Ditambah:</span>
                             <span className="font-medium text-amber-600">
                               {Math.round(day.achievedPendingCreator)}
                             </span>
                           </div>
                           <div className="text-[9px] text-slate-400 mt-[2px] leading-tight">
                             N: {day.achievedPendingNano} | Mi: {day.achievedPendingMicro} | Ma: {day.achievedPendingMacro} | Me: {day.achievedPendingMega}
                           </div>
                         </div>
                         <div className="text-[10px] text-slate-600 flex flex-col border-t border-slate-100 pt-1 mt-1">
                           <div className="flex justify-between">
                             <span>Kr Approve:</span>
                             <span className={day.achievedCreator >= day.targetCreator && targetCreator > 0 ? 'text-emerald-600 font-bold' : 'font-medium'}>
                               {Math.round(day.achievedCreator)} {targetCreator > 0 ? `/ ${Math.round(day.targetCreator)}` : ''}
                             </span>
                           </div>
                           <div className="text-[9px] text-slate-400 mt-[2px] leading-tight">
                             N: {day.achievedApprovedNano} | Mi: {day.achievedApprovedMicro} | Ma: {day.achievedApprovedMacro} | Me: {day.achievedApprovedMega}
                           </div>
                         </div>
                         {/* Live Creator Daily UI */}
                         {targetCreatorLive > 0 && (
                           <>
                             <div className="text-[10px] text-purple-700 flex flex-col border-t border-purple-100 pt-1 mt-1">
                               <div className="flex justify-between">
                                 <span>Kr Live Ditambah:</span>
                                 <span className="font-medium text-amber-600">
                                   {Math.round(day.pendingLiveCreator)}
                                 </span>
                               </div>
                               <div className="text-[9px] text-purple-400/80 mt-[2px] leading-tight">
                                 N: {day.pendingLiveNano} | Mi: {day.pendingLiveMicro} | Ma: {day.pendingLiveMacro} | Me: {day.pendingLiveMega}
                               </div>
                             </div>
                             <div className="text-[10px] text-purple-700 flex flex-col border-t border-purple-100 pt-1 mt-1">
                               <div className="flex justify-between">
                                 <span>Kr Live Approve:</span>
                                 <span className={day.liveCreator >= day.targetCreatorLive && targetCreatorLive > 0 ? 'text-emerald-600 font-bold' : 'font-medium'}>
                                   {Math.round(day.liveCreator)} {targetCreatorLive > 0 ? `/ ${Math.round(day.targetCreatorLive)}` : ''}
                                 </span>
                               </div>
                               <div className="text-[9px] text-purple-400/80 mt-[2px] leading-tight">
                                 N: {day.approvedLiveNano} | Mi: {day.approvedLiveMicro} | Ma: {day.approvedLiveMacro} | Me: {day.approvedLiveMega}
                               </div>
                             </div>
                           </>
                         )}
                      </div>
                    )}
                  </div>
                  
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />
    </div>
  );
}
