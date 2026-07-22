import React from "react";
import CampaignDailyPerformanceClient from "./DailyClient";

export default async function CampaignDailyPerformancePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const campaignId = Number(resolvedParams.id);
  
  if (isNaN(campaignId)) {
    return <div>Invalid Campaign ID</div>;
  }

  return (
    <CampaignDailyPerformanceClient campaignId={campaignId} />
  );
}
