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
  const targetCreator = Number(campaign.target_creator) || 0;

  const hasAnyTarget = targetGmv > 0 || targetVideo > 0 || targetCreator > 0;

  const timelineData = useMemo(() => {
    if (!campaign.start_date || !hasAnyTarget) return [];

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

    // Generate all working days
    const workingDays: Date[] = [];
    let curr = new Date(startDate);
    while (curr.getTime() <= lastTimelineDate.getTime()) {
      const dayOfWeek = curr.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday(0) and Saturday(6)
        workingDays.push(new Date(curr));
      }
      curr.setDate(curr.getDate() + 1);
    }

    // Map dailyData for easy lookup
    const achievedMap = new Map();
    dailyData.forEach(d => {
      const dDate = new Date(d.date);
      dDate.setHours(0, 0, 0, 0);
      achievedMap.set(dDate.getTime(), {
        gmv: Number(d.gmvOrganic) || 0,
        video: Number(d.totalVideos) || 0,
        creator: Number(d.totalCreators) || 0,
      });
    });

    let cumulativeGmv = 0;
    let cumulativeVideo = 0;
    let cumulativeCreator = 0;

    const data = [];

    // Also track weekly aggregates
    let currentWeekGmvTarget = 0;
    let currentWeekVideoTarget = 0;
    let currentWeekCreatorTarget = 0;
    let currentWeekGmvAchieve = 0;
    let currentWeekVideoAchieve = 0;
    let currentWeekCreatorAchieve = 0;
    let weekDaysCount = 0;

    for (let i = 0; i < workingDays.length; i++) {
      const date = workingDays[i];
      const time = date.getTime();
      
      const isPastEndDate = time > endDate.getTime();
      
      const remainingDays = isPastEndDate ? 1 : (workingDays.length - i);

      // Calculate Target for Today
      const remGmv = Math.max(0, targetGmv - cumulativeGmv);
      const remVideo = Math.max(0, targetVideo - cumulativeVideo);
      const remCreator = Math.max(0, targetCreator - cumulativeCreator);

      const targetForTodayGmv = remGmv / remainingDays;
      const targetForTodayVideo = remVideo / remainingDays;
      const targetForTodayCreator = remCreator / remainingDays;

      // Actual achieved today
      const achievedToday = achievedMap.get(time) || { gmv: 0, video: 0, creator: 0 };

      // Add to weekly aggregates
      currentWeekGmvTarget += targetForTodayGmv;
      currentWeekVideoTarget += targetForTodayVideo;
      currentWeekCreatorTarget += targetForTodayCreator;
      currentWeekGmvAchieve += achievedToday.gmv;
      currentWeekVideoAchieve += achievedToday.video;
      currentWeekCreatorAchieve += achievedToday.creator;
      weekDaysCount++;

      // Is it Friday? Or is it the last day of the timeline?
      const isFriday = date.getDay() === 5;
      const isLastDay = i === workingDays.length - 1;
      const isEndOfWeek = isFriday || isLastDay;

      const weeklySummary = isEndOfWeek ? {
        targetGmv: currentWeekGmvTarget,
        targetVideo: currentWeekVideoTarget,
        targetCreator: currentWeekCreatorTarget,
        achievedGmv: currentWeekGmvAchieve,
        achievedVideo: currentWeekVideoAchieve,
        achievedCreator: currentWeekCreatorAchieve,
      } : null;

      data.push({
        date,
        isPastEndDate,
        targetGmv: targetForTodayGmv,
        targetVideo: targetForTodayVideo,
        targetCreator: targetForTodayCreator,
        achievedGmv: achievedToday.gmv,
        achievedVideo: achievedToday.video,
        achievedCreator: achievedToday.creator,
        weeklySummary
      });

      // Reset weekly aggregates if end of week
      if (isEndOfWeek) {
        currentWeekGmvTarget = 0;
        currentWeekVideoTarget = 0;
        currentWeekCreatorTarget = 0;
        currentWeekGmvAchieve = 0;
        currentWeekVideoAchieve = 0;
        currentWeekCreatorAchieve = 0;
        weekDaysCount = 0;
      }

      // Update cumulatives for NEXT day calculation
      cumulativeGmv += achievedToday.gmv;
      cumulativeVideo += achievedToday.video;
      cumulativeCreator += achievedToday.creator;
    }

    return data;
  }, [campaign, dailyData, targetGmv, targetVideo, targetCreator, hasAnyTarget]);

  // Auto-scroll to current day or end
  useEffect(() => {
    if (scrollRef.current) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find index of today or closest past date
      let closestIdx = timelineData.length - 1;
      for (let i = 0; i < timelineData.length; i++) {
        if (timelineData[i].date.getTime() === today.getTime()) {
          closestIdx = i;
          break;
        }
      }
      
      // Scroll to that item
      const itemWidth = 216; // width 200 + gap 16
      scrollRef.current.scrollTo({
        left: Math.max(0, closestIdx * itemWidth - scrollRef.current.clientWidth / 2),
        behavior: 'smooth'
      });
    }
  }, [timelineData]);

  if (!hasAnyTarget || timelineData.length === 0) return null;

  return (
    <div className="ccard mb-[24px]">
      <div className="p-[16px] border-b border-line">
        <h3 className="text-[16px] font-bold text-text">Timeline Target Harian</h3>
        <p className="text-[13px] text-text-soft">Target otomatis disesuaikan secara dinamis (sisa target dibagi sisa hari kerja).</p>
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
                  
                  {/* Top Area (For weekly blocks or alternate daily blocks) */}
                  <div className="h-[120px] w-full flex items-end justify-center pb-[24px]">
                    {showWeekly && day.weeklySummary ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 w-full shadow-sm text-center relative z-20">
                        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-50 border-b border-r border-blue-200 rotate-45"></div>
                        <h4 className="text-xs font-bold text-blue-900 mb-1">Target Minggu Ini</h4>
                        
                        {(isSales || isHybrid) && targetGmv > 0 && (
                          <div className="text-[10px] text-blue-800 flex justify-between px-2">
                            <span>GMV:</span>
                            <span className={day.weeklySummary.achievedGmv >= day.weeklySummary.targetGmv ? 'text-emerald-700 font-bold' : ''}>
                              Rp {Math.round(day.weeklySummary.achievedGmv).toLocaleString()} / Rp {Math.round(day.weeklySummary.targetGmv).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {(isAwareness || isHybrid) && targetVideo > 0 && (
                          <div className="text-[10px] text-blue-800 flex justify-between px-2">
                            <span>Video:</span>
                            <span className={day.weeklySummary.achievedVideo >= day.weeklySummary.targetVideo ? 'text-emerald-700 font-bold' : ''}>
                              {Math.round(day.weeklySummary.achievedVideo)} / {Math.round(day.weeklySummary.targetVideo)}
                            </span>
                          </div>
                        )}
                        {(isAwareness || isHybrid) && targetCreator > 0 && (
                          <div className="text-[10px] text-blue-800 flex justify-between px-2">
                            <span>Kreator:</span>
                            <span className={day.weeklySummary.achievedCreator >= day.weeklySummary.targetCreator ? 'text-emerald-700 font-bold' : ''}>
                              {Math.round(day.weeklySummary.achievedCreator)} / {Math.round(day.weeklySummary.targetCreator)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : isTop ? (
                      <div className={`rounded-lg p-3 w-[180px] shadow-sm relative z-20 ${isToday ? 'bg-rose-50 border border-rose-200' : 'bg-white border border-slate-200'}`}>
                         <div className={`absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 border-b border-r rotate-45 ${isToday ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}></div>
                         <h4 className="text-[10px] font-bold text-slate-700 mb-1">
                           {day.date.toLocaleDateString('id-ID', { weekday: 'long' })} 
                           {day.isPastEndDate && <span className="text-rose-500 ml-1">(Overdue)</span>}
                         </h4>
                         
                         {(isSales || isHybrid) && targetGmv > 0 && (
                           <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                             <span>GMV:</span>
                             <span className={day.achievedGmv >= day.targetGmv ? 'text-emerald-600 font-bold' : ''}>
                               {Math.round(day.achievedGmv).toLocaleString()} / {Math.round(day.targetGmv).toLocaleString()}
                             </span>
                           </div>
                         )}
                         {(isAwareness || isHybrid) && targetVideo > 0 && (
                           <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                             <span>VT:</span>
                             <span className={day.achievedVideo >= day.targetVideo ? 'text-emerald-600 font-bold' : ''}>
                               {Math.round(day.achievedVideo)} / {Math.round(day.targetVideo)}
                             </span>
                           </div>
                         )}
                         {(isAwareness || isHybrid) && targetCreator > 0 && (
                           <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                             <span>Kreator:</span>
                             <span className={day.achievedCreator >= day.targetCreator ? 'text-emerald-600 font-bold' : ''}>
                               {Math.round(day.achievedCreator)} / {Math.round(day.targetCreator)}
                             </span>
                           </div>
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
                         
                         {(isSales || isHybrid) && targetGmv > 0 && (
                           <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                             <span>GMV:</span>
                             <span className={day.achievedGmv >= day.targetGmv ? 'text-emerald-600 font-bold' : ''}>
                               {Math.round(day.achievedGmv).toLocaleString()} / {Math.round(day.targetGmv).toLocaleString()}
                             </span>
                           </div>
                         )}
                         {(isAwareness || isHybrid) && targetVideo > 0 && (
                           <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                             <span>VT:</span>
                             <span className={day.achievedVideo >= day.targetVideo ? 'text-emerald-600 font-bold' : ''}>
                               {Math.round(day.achievedVideo)} / {Math.round(day.targetVideo)}
                             </span>
                           </div>
                         )}
                         {(isAwareness || isHybrid) && targetCreator > 0 && (
                           <div className="text-[10px] text-slate-600 flex justify-between border-t border-slate-100 pt-1 mt-1">
                             <span>Kreator:</span>
                             <span className={day.achievedCreator >= day.targetCreator ? 'text-emerald-600 font-bold' : ''}>
                               {Math.round(day.achievedCreator)} / {Math.round(day.targetCreator)}
                             </span>
                           </div>
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
