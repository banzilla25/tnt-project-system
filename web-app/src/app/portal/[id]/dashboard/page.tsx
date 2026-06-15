import PortalDashboardClient from "../PortalDashboardClient";
import { getPortalData } from "../../actions/portalActions";
import { redirect } from "next/navigation";

export default async function PortalDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  const data = await getPortalData(campaignId);

  if (!data.authenticated) {
    redirect(`/portal/${campaignId}`);
  }

  return <PortalDashboardClient data={data} campaignId={campaignId} />;
}
