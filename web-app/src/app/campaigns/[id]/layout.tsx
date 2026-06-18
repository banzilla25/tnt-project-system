"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { cn } from "@/utils/cn";
import { Settings2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams();
  const pathname = usePathname();
  const campaignId = Number(id);
  
  const { campaigns, brands, updateCampaign } = useDatabaseStore();
  const campaign = campaigns.find(c => c.id === campaignId);
  const brand = brands.find(b => b.id === campaign?.brand_id);

  if (!campaign) return <div className="p-8">Campaign tidak ditemukan.</div>;

  const tabs = [
    { name: 'Listing & Seleksi', href: `/campaigns/${campaignId}/listing`, disabled: false },
    { name: 'Video & VT', href: `/campaigns/${campaignId}/video`, disabled: false },
    { name: 'Performa', href: `/campaigns/${campaignId}/performa`, disabled: false },
    { name: 'Harian (Daily)', href: `/campaigns/${campaignId}/daily`, disabled: false },
    { name: 'Sampel & Alamat', href: `/campaigns/${campaignId}/alamat`, disabled: false },
    { name: 'Jadwal Live', href: `/campaigns/${campaignId}/live`, disabled: false },
    { name: 'SKU', href: `/campaigns/${campaignId}/sku`, disabled: false },
  ];

  const portalLink = typeof window !== 'undefined' ? `${window.location.origin}/portal/${campaign.id}` : `/portal/${campaign.id}`;
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [formData, setFormData] = useState({
    nama: '',
    tipe_campaign: 'sales',
    start_date: '',
    end_date: '',
    target_gmv: '',
    target_video: '',
    target_creator: '',
    target_views: '',
    budget_creator_plafon: '',
    budget_ads_plafon: '',
    require_client_approval: false,
    pin: ''
  });

  useEffect(() => {
    if (campaign && isSettingsOpen) {
      setFormData({
        nama: campaign.nama,
        tipe_campaign: campaign.tipe_campaign,
        start_date: campaign.start_date,
        end_date: campaign.end_date,
        target_gmv: campaign.target_gmv?.toString() || '',
        target_video: campaign.target_video?.toString() || '',
        target_creator: campaign.target_creator?.toString() || '',
        target_views: campaign.target_views?.toString() || '',
        budget_creator_plafon: campaign.budget_creator_plafon?.toString() || '',
        budget_ads_plafon: campaign.budget_ads_plafon?.toString() || '',
        require_client_approval: campaign.require_client_approval || false,
        pin: campaign.pin || ''
      });
    }
  }, [campaign, isSettingsOpen]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateCampaign(campaignId, {
      nama: formData.nama,
      tipe_campaign: formData.tipe_campaign as any,
      start_date: formData.start_date,
      end_date: formData.end_date,
      target_gmv: formData.target_gmv ? Number(formData.target_gmv) : null,
      target_video: formData.target_video ? Number(formData.target_video) : null,
      target_creator: formData.target_creator ? Number(formData.target_creator) : null,
      target_views: formData.target_views ? Number(formData.target_views) : null,
      budget_creator_plafon: Number(formData.budget_creator_plafon || 0),
      budget_ads_plafon: Number(formData.budget_ads_plafon || 0),
      require_client_approval: formData.require_client_approval,
      pin: formData.pin
    });
    setIsSettingsOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline">{brand?.nama}</Badge>
            <Badge variant={campaign.tipe_campaign === 'sales' ? 'success' : campaign.tipe_campaign === 'gmv_awareness' ? 'warning' : 'default'} className="uppercase text-[10px]">
              {campaign.tipe_campaign.replace('_', ' + ')}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{campaign.nama}</h1>
            <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <DialogTrigger asChild>
                <button className="p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
                  <Settings2 className="w-5 h-5" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Pengaturan & Detail Campaign</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdate} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nama Campaign</label>
                      <input required type="text" className="w-full p-2 border rounded" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tipe Campaign</label>
                      <select required className="w-full p-2 border rounded" value={formData.tipe_campaign} onChange={e => setFormData({...formData, tipe_campaign: e.target.value})}>
                        <option value="sales">Sales (Fokus GMV)</option>
                        <option value="awareness">Awareness (Fokus Views)</option>
                        <option value="gmv_awareness">GMV + AWARENESS</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Wajib Client Approval?</label>
                      <select required className="w-full p-2 border rounded" value={formData.require_client_approval ? 'true' : 'false'} onChange={e => setFormData({...formData, require_client_approval: e.target.value === 'true'})}>
                        <option value="false">Tidak (Langsung Jalan)</option>
                        <option value="true">Ya (Wajib di-Approve Client)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">PIN Akses Klien</label>
                      <input required type="text" className="w-full p-2 border rounded font-mono" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} placeholder="Contoh: 1234" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Start Date</label>
                      <input required type="date" className="w-full p-2 border rounded" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">End Date</label>
                      <input required type="date" className="w-full p-2 border rounded" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                    </div>
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-bold mb-3 text-sm text-slate-500 uppercase">Target & Plafon Budget</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Target GMV (Rp)</label>
                        <input type="number" min="0" className="w-full p-2 border rounded" value={formData.target_gmv} onChange={e => setFormData({...formData, target_gmv: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Target Video (Pcs)</label>
                        <input type="number" min="0" className="w-full p-2 border rounded" value={formData.target_video} onChange={e => setFormData({...formData, target_video: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Target Kreator (Orang)</label>
                        <input type="number" min="0" className="w-full p-2 border rounded" value={formData.target_creator} onChange={e => setFormData({...formData, target_creator: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Target Views</label>
                        <input type="number" min="0" className="w-full p-2 border rounded" value={formData.target_views} onChange={e => setFormData({...formData, target_views: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Budget Kreator Plafon (Rp)</label>
                        <input required type="number" min="0" className="w-full p-2 border rounded" value={formData.budget_creator_plafon} onChange={e => setFormData({...formData, budget_creator_plafon: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Budget Ads Plafon (Rp)</label>
                        <input required type="number" min="0" className="w-full p-2 border rounded" value={formData.budget_ads_plafon} onChange={e => setFormData({...formData, budget_ads_plafon: e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="button" variant="outline" className="mr-2" onClick={() => setIsSettingsOpen(false)}>Batal</Button>
                    <Button type="submit">Simpan Perubahan</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <div className="text-right p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs text-blue-600 font-semibold mb-1 uppercase tracking-wider">Akses Portal Klien</p>
          <div className="flex gap-4 text-sm items-center">
            <div>
              <span className="text-slate-500">Link: </span>
              <a href={portalLink} target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">/portal/{campaign.id}</a>
            </div>
            <div>
              <span className="text-slate-500">PIN: </span>
              <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">{campaign.pin || '1234'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.disabled ? '#' : tab.href}
                className={cn(
                  "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : tab.disabled
                      ? "border-transparent text-slate-300 cursor-not-allowed"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                )}
                onClick={(e) => {
                  if (tab.disabled) {
                    e.preventDefault();
                    alert('Tab ini akan tersedia pada Fase berikutnya.');
                  }
                }}
              >
                {tab.name} {tab.disabled && <span className="ml-1 text-[10px] bg-slate-100 text-slate-400 px-1 py-0.5 rounded">Fase 2</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-2">
        {children}
      </div>
    </div>
  );
}
