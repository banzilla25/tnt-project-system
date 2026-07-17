import React from "react";
import { getLivestreamData } from "../../actions/livestreamActions";
import CampaignLiveStreamClient from "./LivestreamClient";

export default async function CampaignLiveStreamPage({
  params
}: {
  params: { id: string }
}) {
  const campaignId = Number(params.id);
  
  if (isNaN(campaignId)) {
    return <div>Invalid Campaign ID</div>;
  }

  const data = await getLivestreamData(campaignId);

  if (!data || !data.campaign) {
    return <div className="p-8 text-center text-slate-500">Campaign not found or loading failed.</div>;
  }

  return (
    <CampaignLiveStreamClient 
      campaign={data.campaign}
      initialCreators={data.creators}
      initialSalesData={data.salesData}
      initialLiveMetrics={data.liveMetrics}
    />
  );
}
