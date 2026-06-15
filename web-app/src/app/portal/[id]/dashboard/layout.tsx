import { ReactNode } from "react";
import { getPortalData, logoutPortal } from "../../actions/portalActions";
import { redirect } from "next/navigation";

export default async function PortalDashboardLayout({ children, params }: { children: ReactNode, params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaignId = parseInt(id, 10);
  const data = await getPortalData(campaignId);

  if (!data.authenticated) {
    redirect(`/portal/${campaignId}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="font-bold text-slate-800 text-xl tracking-tight">TNT<span className="text-blue-600">.</span> Portal</div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 hidden md:inline-block">Logged in as Client</span>
          <form action={async () => {
            'use server'
            await logoutPortal(campaignId);
            redirect(`/portal/${campaignId}`);
          }}>
            <button type="submit" className="text-sm bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 px-4 py-2 rounded-full font-medium transition-colors">
              Keluar Portal
            </button>
          </form>
        </div>
      </nav>
      <main>
        {children}
      </main>
    </div>
  );
}
