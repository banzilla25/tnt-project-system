import React from "react";
import { getDailyData } from "../../actions/dailyActions";
import CampaignDailyPerformanceClient from "./DailyClient";

export default async function CampaignDailyPerformancePage({
  params
}: {
  params: { id: string }
}) {
  const campaignId = Number(params.id);
  
  if (isNaN(campaignId)) {
    return <div>Invalid Campaign ID</div>;
  }

  const data = await getDailyData(campaignId);

  if (!data || !data.campaign) {
    return <div className="p-8 text-center text-slate-500">Campaign not found or loading failed.</div>;
  }

  return (
    <CampaignDailyPerformanceClient 
      campaign={data.campaign}
      initialDailyData={data.dailyData}
      initialMonthlyData={data.monthlyData}
    />
  );
}
