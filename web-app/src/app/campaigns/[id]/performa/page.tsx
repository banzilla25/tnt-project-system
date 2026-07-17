import React from "react";
import { getInternalPerformaData } from "../../actions/performaActions";
import CampaignPerformaClient from "./PerformaClient";

export default async function CampaignPerformaPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params;
  const campaignId = Number(resolvedParams.id);
  
  if (isNaN(campaignId)) {
    return <div>Invalid Campaign ID</div>;
  }

  const data = await getInternalPerformaData(campaignId);

  if (!data || !data.campaign) {
    return <div className="p-8 text-center text-slate-500">Campaign not found or loading failed.</div>;
  }

  return (
    <CampaignPerformaClient 
      campaign={data.campaign}
      rpcPerformance={data.rpcPerformance}
      baseCreatorStats={data.baseCreatorStats}
      localCreators={data.baseCreatorStats} // Reused for length calculations
      initialTotalAdsGmv={data.totalAdsGmv}
      initialTotalAdsGmvUsd={data.totalAdsGmvUsd}
      initialTotalAdsSpend={data.totalAdsSpend}
      initialAdsData={data.adsData}
    />
  );
}
