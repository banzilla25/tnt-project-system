"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import Link from "next/link";
import { useState } from "react";

export default function CampaignsPage() {
  const { campaigns, brands, addCampaign, addBrand } = useDatabaseStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNewBrand, setIsAddingNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [formData, setFormData] = useState({
    nama: '',
    brand_id: '',
    tipe_campaign: 'sales',
    start_date: '',
    end_date: '',
    target_gmv: '',
    target_video: '',
    target_creator: '',
    budget_creator_plafon: '',
    budget_ads_plafon: '',
    require_client_approval: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalBrandId = Number(formData.brand_id);
    
    if (isAddingNewBrand && newBrandName.trim()) {
      const newBrand = await addBrand({
        nama: newBrandName.trim(),
        status: 'aktif'
      });
      if (newBrand) {
        finalBrandId = newBrand.id;
      } else {
        alert("Gagal membuat brand baru");
        return;
      }
    } else if (!finalBrandId) {
      alert("Pilih brand atau buat brand baru!");
      return;
    }

    await addCampaign({
      nama: formData.nama,
      brand_id: finalBrandId,
      tipe_campaign: formData.tipe_campaign as any,
      start_date: formData.start_date,
      end_date: formData.end_date,
      target_gmv: formData.target_gmv ? Number(formData.target_gmv) : null,
      target_video: formData.target_video ? Number(formData.target_video) : null,
      target_creator: formData.target_creator ? Number(formData.target_creator) : null,
      budget_creator_plafon: Number(formData.budget_creator_plafon || 0),
      budget_ads_plafon: Number(formData.budget_ads_plafon || 0),
      require_client_approval: formData.require_client_approval,
      persiapan_14hari: null,
      vsa_gmv_max: null,
      pic: null,
      assist: null,
      file_concept_url: null,
      status: 'aktif',
      pin: null
    });
    setIsOpen(false);
    setIsAddingNewBrand(false);
    setNewBrandName('');
    setFormData({
      nama: '', brand_id: '', tipe_campaign: 'sales', start_date: '', end_date: '',
      target_gmv: '', target_video: '', target_creator: '', budget_creator_plafon: '', budget_ads_plafon: '', require_client_approval: false
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-slate-500">Pilih campaign untuk melihat detail dan mengelola creator.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>+ Tambah Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tambah Campaign Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Campaign</label>
                  <input required type="text" className="w-full p-2 border rounded" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} placeholder="Contoh: Ramadhan Mega Sale" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brand</label>
                  {!isAddingNewBrand ? (
                    <select required className="w-full p-2 border rounded" value={formData.brand_id} onChange={e => {
                      if (e.target.value === 'new') {
                        setIsAddingNewBrand(true);
                        setFormData({...formData, brand_id: ''});
                      } else {
                        setFormData({...formData, brand_id: e.target.value});
                      }
                    }}>
                      <option value="">Pilih Brand...</option>
                      {brands.map(b => (
                        <option key={b.id} value={b.id}>{b.nama}</option>
                      ))}
                      <option value="new" className="font-bold text-blue-600">+ Tambah Brand Baru</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input required type="text" className="w-full p-2 border rounded" value={newBrandName} onChange={e => setNewBrandName(e.target.value)} placeholder="Nama Brand Baru" />
                      <Button type="button" variant="outline" onClick={() => setIsAddingNewBrand(false)}>Batal</Button>
                    </div>
                  )}
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
                    <input type="number" min="0" className="w-full p-2 border rounded" value={formData.target_gmv} onChange={e => setFormData({...formData, target_gmv: e.target.value})} placeholder="Opsional" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Video (Pcs)</label>
                    <input type="number" min="0" className="w-full p-2 border rounded" value={formData.target_video} onChange={e => setFormData({...formData, target_video: e.target.value})} placeholder="Opsional" />
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
                <Button type="button" variant="outline" className="mr-2" onClick={() => setIsOpen(false)}>Batal</Button>
                <Button type="submit">Buat Campaign</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map(campaign => {
          const brand = brands.find(b => b.id === campaign.brand_id);
          return <CampaignCardItem key={campaign.id} campaign={campaign} brand={brand} />;
        })}
      </div>
    </div>
  );
}

function CampaignCardItem({ campaign, brand }: { campaign: any, brand: any }) {
  const { updateCampaign } = useDatabaseStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nama: campaign.nama,
    tipe_campaign: campaign.tipe_campaign,
    status: campaign.status,
    start_date: campaign.start_date,
    end_date: campaign.end_date,
    target_gmv: campaign.target_gmv || '',
    target_video: campaign.target_video || '',
    target_creator: campaign.target_creator || '',
    budget_creator_plafon: campaign.budget_creator_plafon || '',
    budget_ads_plafon: campaign.budget_ads_plafon || '',
    require_client_approval: campaign.require_client_approval || false
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateCampaign(campaign.id, {
      nama: formData.nama,
      tipe_campaign: formData.tipe_campaign as any,
      status: formData.status as any,
      start_date: formData.start_date,
      end_date: formData.end_date,
      target_gmv: formData.target_gmv ? Number(formData.target_gmv) : null,
      target_video: formData.target_video ? Number(formData.target_video) : null,
      target_creator: formData.target_creator ? Number(formData.target_creator) : null,
      budget_creator_plafon: Number(formData.budget_creator_plafon || 0),
      budget_ads_plafon: Number(formData.budget_ads_plafon || 0),
      require_client_approval: formData.require_client_approval
    });
    setSaving(false);
    setIsExpanded(false);
  };

  return (
    <Card className="hover:border-blue-500 transition-colors h-full flex flex-col relative overflow-hidden">
      <Link href={`/campaigns/${campaign.id}/listing`} className="block flex-1 cursor-pointer">
        <CardContent className="p-5 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{brand?.nama}</p>
              <h3 className="font-bold text-lg leading-tight">{campaign.nama}</h3>
            </div>
            <Badge variant={campaign.tipe_campaign === 'sales' ? 'success' : campaign.tipe_campaign === 'gmv_awareness' ? 'warning' : 'default'} className="uppercase text-[10px]">
              {campaign.tipe_campaign.replace('_', ' + ')}
            </Badge>
          </div>
          
          <div className="mt-auto space-y-3 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Status</span>
              <Badge variant={campaign.status === 'aktif' ? 'secondary' : 'outline'}>{campaign.status}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Periode</span>
              <span className="font-medium text-slate-700">
                {new Date(campaign.start_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })} - {new Date(campaign.end_date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            {campaign.target_gmv && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Target GMV</span>
                <span className="font-bold text-slate-900">Rp {campaign.target_gmv.toLocaleString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Link>
      
      {/* Settings Accordion Area */}
      <div className="border-t border-slate-100 bg-slate-50 mt-auto">
        <button 
          onClick={(e) => { e.preventDefault(); setIsExpanded(!isExpanded); }} 
          className="w-full text-center p-3 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex justify-center items-center gap-2 transition-colors"
        >
          {isExpanded ? "Tutup Pengaturan" : "Buka Pengaturan"}
          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        
        {isExpanded && (
          <div className="p-4 border-t border-slate-200 bg-white shadow-inner">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Nama Campaign</label>
                <input required type="text" className="w-full p-2 text-sm border rounded" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Status</label>
                  <select required className="w-full p-2 text-sm border rounded" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="aktif">Aktif</option>
                    <option value="selesai">Selesai</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Tipe Campaign</label>
                  <select required className="w-full p-2 text-sm border rounded" value={formData.tipe_campaign} onChange={e => setFormData({...formData, tipe_campaign: e.target.value})}>
                    <option value="sales">Sales</option>
                    <option value="awareness">Awareness</option>
                    <option value="gmv_awareness">GMV + AWARENESS</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Start Date</label>
                  <input required type="date" className="w-full p-2 text-sm border rounded" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">End Date</label>
                  <input required type="date" className="w-full p-2 text-sm border rounded" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                </div>
              </div>

              <div className="border-t pt-3 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target & Plafon</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Target GMV</label>
                    <input type="number" min="0" className="w-full p-2 text-sm border rounded" value={formData.target_gmv} onChange={e => setFormData({...formData, target_gmv: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Target Video</label>
                    <input type="number" min="0" className="w-full p-2 text-sm border rounded" value={formData.target_video} onChange={e => setFormData({...formData, target_video: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Target Creator</label>
                    <input type="number" min="0" className="w-full p-2 text-sm border rounded" value={formData.target_creator} onChange={e => setFormData({...formData, target_creator: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Client Approval</label>
                    <select className="w-full p-2 text-sm border rounded" value={formData.require_client_approval ? 'true' : 'false'} onChange={e => setFormData({...formData, require_client_approval: e.target.value === 'true'})}>
                      <option value="false">Tidak</option>
                      <option value="true">Ya</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Plafon Kreator</label>
                    <input type="number" min="0" className="w-full p-2 text-sm border rounded" value={formData.budget_creator_plafon} onChange={e => setFormData({...formData, budget_creator_plafon: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Plafon Ads</label>
                    <input type="number" min="0" className="w-full p-2 text-sm border rounded" value={formData.budget_ads_plafon} onChange={e => setFormData({...formData, budget_ads_plafon: e.target.value})} />
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </Card>
  );
}
