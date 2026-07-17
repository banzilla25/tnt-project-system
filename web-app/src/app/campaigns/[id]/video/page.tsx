import React from "react";
import { getInternalVideoData } from "../../actions/videoActions";
import CampaignVideoClient from "./VideoClient";

export default async function CampaignVideoPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const campaignId = Number(resolvedParams.id);
  
  if (isNaN(campaignId)) {
    return <div>Invalid Campaign ID</div>;
  }

  // Fetch initial data without search keyword
  const data = await getInternalVideoData(campaignId, "");

  if (!data || !data.campaign) {
    return <div className="p-8 text-center text-slate-500">Campaign not found or loading failed.</div>;
  }

  return (
    <CampaignVideoClient 
      initialListingData={data.listingData}
      initialVideos={data.allVideos}
    />
  );
}
