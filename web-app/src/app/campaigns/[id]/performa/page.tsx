import React from "react";
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

  return (
    <CampaignPerformaClient campaignId={campaignId} />
  );
}
