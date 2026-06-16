"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { getCreatorType, getLatestSnapshot, computeCampaignGMV, computeHighestVideoGMV, getJenisKerjasama } from "@/utils/computed";
import { useDraftLocalStorage } from "@/hooks/useDraftLocalStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { ArrowLeft, UserPlus, Phone, CreditCard, Activity, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, ReactNode, useEffect } from "react";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Edit2 } from "lucide-react";

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export default function CreatorProfilePage() {
  const { id } = useParams();
  const creatorId = Number(id);
  const { 
    niches, 
    campaigns,
    addCreatorSnapshot,
    updateCreatorContact,
    updateCreator,
    addCreatorNote,
    addCampaignCreator,
  } = useDatabaseStore();

  const [isLoading, setIsLoading] = useState(true);
  const [localData, setLocalData] = useState<{
    creator: any;
    snapshots: any[];
    contacts: any[];
    creatorNiches: any[];
    notes: any[];
    ccs: any[];
    videos: any[];
    sales: any[];
    ads: any[];
  } | null>(null);

  useEffect(() => {
    const fetchCreatorData = async () => {
      setIsLoading(true);
      try {
        const { data: creator } = await supabase.from('creators').select('*').eq('id', creatorId).single();
        if (!creator) {
          setLocalData(null);
          setIsLoading(false);
          return;
        }

        const [
          { data: snapshots },
          { data: contacts },
          { data: creatorNiches },
          { data: notes },
          { data: ccs },
          { data: ads }
        ] = await Promise.all([
          supabase.from('creator_snapshots').select('*').eq('creator_id', creatorId),
          supabase.from('creator_contacts').select('*').eq('creator_id', creatorId),
          supabase.from('creator_niches').select('*').eq('creator_id', creatorId),
          supabase.from('creator_notes').select('*').eq('creator_id', creatorId),
          supabase.from('campaign_creators').select('*').eq('creator_id', creatorId),
          supabase.from('ads_performance').select('*').eq('creator_id', creatorId)
        ]);

        let vids: any[] = [];
        if (ccs && ccs.length > 0) {
          const ccIds = ccs.map((c: any) => c.id);
          const { data: fetchedVids } = await supabase.from('videos').select('*').in('campaign_creator_id', ccIds);
          vids = fetchedVids || [];
        }

        let sls: any[] = [];
        const contentUids = vids.map(v => v.content_uid).filter(Boolean);
        if (contentUids.length > 0) {
          // fetch sales for these content_uids
          // split into chunks to avoid too large query
          const chunkSize = 100;
          let allSls: any[] = [];
          for (let i = 0; i < contentUids.length; i += chunkSize) {
            const chunk = contentUids.slice(i, i + chunkSize);
            const { data: sData } = await supabase.from('sales').select('*').in('content_uid', chunk);
            if (sData) allSls = [...allSls, ...sData];
          }
          sls = allSls;
        }

        // Also fetch sales by creator_username for awareness campaigns
        const { data: salesByUsername } = await supabase.from('sales').select('*').eq('creator_username', creator.username);
        if (salesByUsername) {
          sls = [...sls, ...salesByUsername];
        }

        setLocalData({
          creator,
          snapshots: snapshots || [],
          contacts: contacts || [],
          creatorNiches: creatorNiches || [],
          notes: notes || [],
          ccs: ccs || [],
          videos: vids,
          sales: sls,
          ads: ads || []
        });
      } catch (err) {
        console.error("Error fetching creator data:", err);
        setLocalData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCreatorData();
  }, [creatorId]);

  // Derived states based on localData
  const creator = localData?.creator;
  const snapshots = localData?.snapshots?.sort((a: any, b: any) => new Date(b.tanggal_update).getTime() - new Date(a.tanggal_update).getTime()) || [];
  const latestSnapshot = snapshots[0] || null;
  const type = getCreatorType(latestSnapshot?.audience_age || null);
  
  const activeContact = localData?.contacts?.find((c: any) => c.status === 'aktif');
  
  const displayNiches = localData?.creatorNiches
    ?.sort((a: any, b: any) => a.peringkat - b.peringkat)
    ?.map((cn: any) => niches.find(n => n.id === cn.niche_id)?.nama)
    ?.filter(Boolean) || [];

  const notes = localData?.notes?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];
  
  // States
  const [sortField, setSortField] = useState<'gmv' | 'highestVideoGmv' | 'campaign_name' | 'price'>('gmv');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [videoSortField, setVideoSortField] = useState<'urutan' | 'views' | 'sold' | 'gmv'>('urutan');
  const [videoSortOrder, setVideoSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleVideoSort = (field: 'urutan' | 'views' | 'sold' | 'gmv') => {
    if (videoSortField === field) {
      setVideoSortOrder(videoSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setVideoSortField(field);
      setVideoSortOrder('desc'); // default high to low for metrics
    }
  };

  let trackRecords = (localData?.ccs || [])
    .map((cc: any) => {
      const campaign = campaigns.find(c => c.id === cc.campaign_id);
      return {
        ...cc,
        campaign_name: campaign?.nama || 'Unknown',
        gmv: computeCampaignGMV(cc, localData?.videos || [], localData?.sales || []),
        highestVideoGmv: computeHighestVideoGMV(cc, localData?.videos || [], localData?.sales || []),
        jenis_kerjasama: getJenisKerjasama(cc.price)
      };
    });

  trackRecords = trackRecords.sort((a, b) => {
    let comparison = 0;
    if (sortField === 'gmv') comparison = a.gmv - b.gmv;
    else if (sortField === 'highestVideoGmv') comparison = a.highestVideoGmv - b.highestVideoGmv;
    else if (sortField === 'price') comparison = a.price - b.price;
    else if (sortField === 'campaign_name') comparison = a.campaign_name.localeCompare(b.campaign_name);
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const [snapForm, setSnapForm] = useState({ audience_age: '', level: '', gmv_30d: '' });
  const [snapOpen, setSnapOpen] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<number, boolean>>({});

  const toggleCampaign = (id: number) => {
    setExpandedCampaigns(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const [contactForm, setContactForm] = useState('');
  const [contactOpen, setContactOpen] = useState(false);

  const [rekForm, setRekForm] = useState({ rekening: '', nama_asli: '' });
  const [rekOpen, setRekOpen] = useState(false);

  const [noteForm, setNoteForm, clearNoteDraft] = useDraftLocalStorage(`draft_note_creator_${creatorId}`, { isi: '', penulis: '' });
  const [noteOpen, setNoteOpen] = useState(false);

  const [nicheForm, setNicheForm] = useState<number[]>([]);
  const [nicheOpen, setNicheOpen] = useState(false);

  const [campForm, setCampForm] = useState({ campaign_id: '', price: 0, qty_vt: 1 });
  const [campOpen, setCampOpen] = useState(false);

  const [videoLink, setVideoLink] = useState('');
  const [activeCcId, setActiveCcId] = useState<number | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  if (isLoading) return <div className="p-8 text-center text-slate-500">Memuat data kreator...</div>;
  if (!creator) return <div className="p-8 text-center">Creator tidak ditemukan.</div>;

  const handleUpdateSnapshot = async () => {
    await addCreatorSnapshot({
      creator_id: creatorId,
      audience_age: snapForm.audience_age || null,
      level: parseInt(snapForm.level) || null,
      gmv_30d: parseInt(snapForm.gmv_30d) || 0,
      tanggal_update: new Date().toISOString().split('T')[0]
    });
    setSnapOpen(false);
    setSnapForm({ audience_age: '', level: '', gmv_30d: '' });
  };

  const handleUpdateContact = async () => {
    if(!contactForm) return;
    await updateCreatorContact(creatorId, contactForm);
    setContactOpen(false);
    setContactForm('');
  };

  const handleUpdateRekening = async () => {
    await updateCreator(creatorId, { rekening: rekForm.rekening, nama_asli: rekForm.nama_asli });
    setRekOpen(false);
  };

  const handleUpdateNiche = async () => {
    await useDatabaseStore.getState().updateCreatorNiches(creatorId, nicheForm);
    setNicheOpen(false);
    // Ideally we should refetch or update localData here, but since it's a quick patch,
    // reloading the page or letting the user refresh is fine, or we can update localData manually.
    window.location.reload();
  };

  const handleAddNote = async () => {
    if(!noteForm.isi || !noteForm.penulis) return;
    await addCreatorNote({
      creator_id: creatorId,
      isi: noteForm.isi,
      penulis: noteForm.penulis
    });
    setNoteOpen(false);
    clearNoteDraft();
  };

  const handleTarikCampaign = async () => {
    if(!campForm.campaign_id) return;
    await addCampaignCreator({
      campaign_id: Number(campForm.campaign_id),
      creator_id: creatorId,
      tier: null,
      price: campForm.price,
      qty_vt: campForm.qty_vt,
      content_type: null,
      approval: 'pending',
      status_bayar: 'belum',
      pic_assist: null,
      notes_manager: null,
      notes_pic: null,
      sample_progress: null,
      gmv_organic_legacy: null,
      gmv_ads_legacy: null,
      client_approval: 'pending' // default
    });
    setCampOpen(false);
  };

  const handleAddVideo = async () => {
    if (!videoLink || !activeCcId) return;
    try {
      let content_uid = videoLink.trim();
      const match = videoLink.match(/video\/(\d+)/);
      if (match) {
        content_uid = match[1];
      } else if (!/^\d+$/.test(content_uid)) {
        alert("Link tidak valid. Pastikan Anda memasukkan Link TikTok Panjang atau Angka Content ID.");
        return;
      }

      const username = creator.username.startsWith('@') ? creator.username : `@${creator.username}`;
      const longLink = `https://www.tiktok.com/${username}/video/${content_uid}`;

      await useDatabaseStore.getState().addVideo({
        campaign_creator_id: activeCcId,
        content_uid: content_uid,
        link_video: longLink,
        urutan: 1,
        vt_approval: 'pending',
        concept: null
      });
      setVideoOpen(false);
      setVideoLink('');
      setActiveCcId(null);
    } catch (e: any) {
      alert("Gagal menyimpan video. Mungkin content_uid ini sudah ada?");
    }
  };

  const handleSort = (field: 'gmv' | 'highestVideoGmv' | 'campaign_name' | 'price') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/creator-pool">
          <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">@{creator.username}</h1>
            <Badge variant="secondary" className="text-sm">{type}</Badge>
          </div>
          <p className="text-slate-500">{creator.nama_asli || 'Nama asli belum diisi'}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Dialog open={snapOpen} onOpenChange={setSnapOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Activity className="w-4 h-4 mr-2" /> Update Data</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Update Data Snapshot</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Audience Age</label>
                  <input type="text" value={snapForm.audience_age} onChange={e=>setSnapForm({...snapForm, audience_age: e.target.value})} className="w-full p-2 border rounded" placeholder={latestSnapshot?.audience_age || ''} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Level TikTok</label>
                  <input type="number" value={snapForm.level} onChange={e=>setSnapForm({...snapForm, level: e.target.value})} className="w-full p-2 border rounded" placeholder={latestSnapshot?.level?.toString() || '1'} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimasi GMV 30 Hari Terakhir (Rp)</label>
                  <input type="number" value={snapForm.gmv_30d} onChange={e=>setSnapForm({...snapForm, gmv_30d: e.target.value})} className="w-full p-2 border rounded" placeholder="0" />
                </div>
                <Button onClick={handleUpdateSnapshot} className="w-full">Simpan Snapshot</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={campOpen} onOpenChange={setCampOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="w-4 h-4 mr-2" /> Tarik ke Campaign</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tarik Creator ke Campaign</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Pilih Campaign Aktif</label>
                  <select value={campForm.campaign_id} onChange={e=>setCampForm({...campForm, campaign_id: e.target.value})} className="w-full p-2 border rounded bg-white">
                    <option value="">-- Pilih Campaign --</option>
                    {campaigns.filter(c => c.status === 'aktif').map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rate Card (0 = Barter)</label>
                    <input type="number" value={campForm.price} onChange={e=>setCampForm({...campForm, price: Number(e.target.value)})} className="w-full p-2 border rounded" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Qty Video</label>
                    <input type="number" value={campForm.qty_vt} onChange={e=>setCampForm({...campForm, qty_vt: Number(e.target.value)})} className="w-full p-2 border rounded" />
                  </div>
                </div>
                <Button onClick={handleTarikCampaign} className="w-full" disabled={!campForm.campaign_id}>Tambahkan ke Listing</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Kolom Kiri: Info Utama & Kontak */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profil Utama</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-center">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Audience Age</p>
                  <p className="font-bold text-lg">{latestSnapshot?.audience_age || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Level</p>
                  <p className="font-bold text-lg">{latestSnapshot?.level || '-'}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Niche</p>
                  <Dialog open={nicheOpen} onOpenChange={(v) => { 
                    setNicheOpen(v); 
                    if(v) setNicheForm(localData?.creatorNiches?.map((cn: any) => cn.niche_id) || []);
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5"><Edit2 className="h-3 w-3"/></Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Update Niche Kreator</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                          {niches.map(niche => (
                            <label key={niche.id} className="flex items-center gap-2 text-sm p-2 border rounded cursor-pointer hover:bg-slate-50">
                              <input 
                                type="checkbox" 
                                checked={nicheForm.includes(niche.id)}
                                onChange={(e) => {
                                  if(e.target.checked) setNicheForm([...nicheForm, niche.id]);
                                  else setNicheForm(nicheForm.filter(id => id !== niche.id));
                                }}
                              />
                              {niche.nama}
                            </label>
                          ))}
                        </div>
                        <Button onClick={handleUpdateNiche} className="w-full">Simpan Niche</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayNiches.length > 0 ? displayNiches.map((n, i) => (
                    <Badge key={i} variant="outline">{n}</Badge>
                  )) : <p className="text-sm text-slate-400">Belum ada niche</p>}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kontak Aktif</p>
                  <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5"><Edit2 className="h-3 w-3"/></Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Update Nomor WhatsApp</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm">Nomor Baru</label>
                          <input type="text" value={contactForm} onChange={e=>setContactForm(e.target.value)} className="w-full p-2 border rounded" placeholder="08..." />
                          <p className="text-xs text-slate-500">Nomor lama akan otomatis diarsipkan.</p>
                        </div>
                        <Button onClick={handleUpdateContact} className="w-full">Simpan Kontak</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                {activeContact ? (
                  <div className="flex items-center gap-2 text-sm p-2 border border-slate-200 rounded-lg">
                    <Phone className="w-4 h-4 text-green-600" />
                    <span>{activeContact.nomor}</span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Belum ada kontak aktif</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rekening & Nama Asli</p>
                  <Dialog open={rekOpen} onOpenChange={(v) => { setRekOpen(v); if(v) setRekForm({ rekening: creator.rekening || '', nama_asli: creator.nama_asli || '' })}}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5"><Edit2 className="h-3 w-3"/></Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Update Rekening & Nama Asli</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm">Nama Asli</label>
                          <input type="text" value={rekForm.nama_asli} onChange={e=>setRekForm({...rekForm, nama_asli: e.target.value})} className="w-full p-2 border rounded" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm">Rekening</label>
                          <input type="text" value={rekForm.rekening} onChange={e=>setRekForm({...rekForm, rekening: e.target.value})} className="w-full p-2 border rounded" />
                        </div>
                        <Button onClick={handleUpdateRekening} className="w-full">Simpan</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex items-center gap-2 text-sm p-2 border border-slate-200 rounded-lg">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>{creator.rekening || 'Belum diisi'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Catatan Evaluasi</CardTitle>
              <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">Tambah</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex justify-between items-center w-full">
                      Tambah Catatan Evaluasi
                      {noteForm.isi && <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-1 rounded">Tersimpan di Draft Lokal ✓</span>}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm">Nama Anda (Penulis)</label>
                      <input type="text" value={noteForm.penulis} onChange={e=>setNoteForm({...noteForm, penulis: e.target.value})} className="w-full p-2 border rounded" placeholder="Nama..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm">Catatan</label>
                      <textarea value={noteForm.isi} onChange={e=>setNoteForm({...noteForm, isi: e.target.value})} className="w-full p-2 border rounded min-h-[100px]" placeholder="Misal: Creator responsif, video cepat." />
                    </div>
                    <Button onClick={handleAddNote} className="w-full" disabled={!noteForm.isi || !noteForm.penulis}>Simpan Catatan</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {notes.length > 0 ? (
                <div className="space-y-4">
                  {notes.map(n => (
                    <div key={n.id} className="text-sm border-l-2 border-blue-500 pl-3 py-1">
                      <p className="text-slate-800">{n.isi}</p>
                      <p className="text-xs text-slate-400 mt-1">{n.penulis} • {new Date(n.created_at).toLocaleDateString('id-ID')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">Belum ada catatan.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Rekam Jejak & Riwayat Snapshot */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rekam Jejak (Campaign History)</CardTitle>
            </CardHeader>
            <CardContent>
              {trackRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('campaign_name')}>Campaign <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                      <TableHead>Kerjasama</TableHead>
                      <TableHead className="cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('price')}>Rate/Price <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                      <TableHead className="text-center">Total VT</TableHead>
                      <TableHead className="text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('gmv')}>Total GMV Campaign <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                      <TableHead className="text-right cursor-pointer hover:bg-slate-50 transition-colors select-none" onClick={() => handleSort('highestVideoGmv')}>GMV Video Tertinggi <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                      <TableHead>Approval</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackRecords.map((tr, i) => {
                      const hasDetails = tr.approval === 'approved' || (localData?.videos || []).filter((v: any) => v.campaign_creator_id === tr.id).length > 0;
                      const isExpanded = expandedCampaigns[tr.id];
                      
                      return (
                      <React.Fragment key={tr.id}>
                        <TableRow 
                          className={`${i === 0 && tr.gmv > 0 && sortField === 'gmv' && sortOrder === 'desc' ? "bg-amber-50/50" : ""} ${hasDetails ? "cursor-pointer hover:bg-slate-50 transition-colors" : ""}`}
                          onClick={() => hasDetails && toggleCampaign(tr.id)}
                        >
                          <TableCell className="font-medium flex items-center gap-2">
                            {hasDetails && (
                              <span className="text-slate-400">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </span>
                            )}
                            {tr.campaign_name}
                          </TableCell>
                          <TableCell className="capitalize">{tr.jenis_kerjasama}</TableCell>
                          <TableCell>Rp {tr.price.toLocaleString()}</TableCell>
                          <TableCell className="text-center font-medium">
                            {localData?.videos?.filter((v: any) => v.campaign_creator_id === tr.id).length || 0}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {tr.gmv > 0 ? `Rp ${tr.gmv.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">
                            {tr.highestVideoGmv > 0 ? `Rp ${tr.highestVideoGmv.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tr.approval === 'approved' ? 'success' : 'outline'}>
                              {tr.approval}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {hasDetails && isExpanded && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-slate-50/50 p-4 border-b-2 border-slate-200">
                              <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
                                <Table className="text-sm">
                                  <TableHeader className="bg-slate-50">
                                    <TableRow>
                                      <TableHead className="w-16 h-8 text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:bg-slate-200" onClick={() => handleVideoSort('urutan')}>Video <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                                      <TableHead className="h-8 text-xs font-semibold uppercase tracking-wider text-slate-500">Link TikTok</TableHead>
                                      <TableHead className="h-8 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:bg-slate-200" onClick={() => handleVideoSort('views')}>Views <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                                      <TableHead className="h-8 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:bg-slate-200" onClick={() => handleVideoSort('sold')}>Item Sold <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                                      <TableHead className="h-8 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:bg-slate-200" onClick={() => handleVideoSort('gmv')}>Organic GMV <ArrowUpDown className="w-3 h-3 inline ml-1"/></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {localData?.videos?.filter((v: any) => v.campaign_creator_id === tr.id).length === 0 ? (
                                      <TableRow><TableCell colSpan={5} className="text-center text-slate-400 py-3 text-xs">Belum ada video/VT diunggah.</TableCell></TableRow>
                                    ) : localData?.videos?.filter((v: any) => v.campaign_creator_id === tr.id).map((v: any) => {
                                      const videoSales = localData?.sales?.filter((s: any) => s.content_uid && v.content_uid && s.content_uid === v.content_uid) || [];
                                      const organicGmv = videoSales.reduce((sum, row) => sum + row.gmv, 0);
                                      const itemsSold = videoSales.reduce((sum, row) => sum + (row.quantity || 0), 0);
                                      const maxViews = videoSales.length > 0 ? Math.max(...videoSales.map((s: any) => Number(s.raw_data?.['Video views'] || 0))) : 0;
                                      return { ...v, organicGmv, itemsSold, maxViews };
                                    }).sort((a: any, b: any) => {
                                      let diff = 0;
                                      if (videoSortField === 'urutan') diff = a.urutan - b.urutan;
                                      if (videoSortField === 'views') diff = a.maxViews - b.maxViews;
                                      if (videoSortField === 'sold') diff = a.itemsSold - b.itemsSold;
                                      if (videoSortField === 'gmv') diff = a.organicGmv - b.organicGmv;
                                      return videoSortOrder === 'asc' ? diff : -diff;
                                    }).map((v: any) => {
                                      return (
                                        <TableRow key={v.id}>
                                          <TableCell className="font-medium text-slate-700">VT {v.urutan}</TableCell>
                                          <TableCell>
                                            {v.link_video ? (
                                              <a href={v.link_video} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">
                                                {v.link_video}
                                              </a>
                                            ) : <span className="text-slate-400 italic">Belum ada link</span>}
                                          </TableCell>
                                          <TableCell className="text-center font-bold text-slate-700">
                                            {v.maxViews > 0 ? v.maxViews.toLocaleString() : '-'}
                                          </TableCell>
                                          <TableCell className="text-center font-bold text-slate-700">
                                            {v.itemsSold} pcs
                                          </TableCell>
                                          <TableCell className="text-right font-bold text-green-700">
                                            {v.organicGmv > 0 ? `Rp ${v.organicGmv.toLocaleString()}` : '-'}
                                          </TableCell>
                                        </TableRow>
                                      )                                     })}
                                      <TableRow>
                                        <TableCell colSpan={5} className="p-0 border-t border-slate-200">
                                          <div className="bg-white hover:bg-slate-50 transition-colors">
                                            <Dialog open={videoOpen && activeCcId === tr.id} onOpenChange={(v) => { setVideoOpen(v); if(v) setActiveCcId(tr.id); else setActiveCcId(null); }}>
                                              <DialogTrigger asChild>
                                                <button className="w-full text-center text-xs font-semibold text-blue-600 py-2">
                                                  + Tambah Link Video Manual
                                                </button>
                                              </DialogTrigger>
                                              <DialogContent>
                                                <DialogHeader><DialogTitle>Input Link Video</DialogTitle></DialogHeader>
                                                <div className="space-y-4 py-4">
                                                  <div className="space-y-2">
                                                    <label className="text-sm font-medium">Link Panjang TikTok / Content ID</label>
                                                    <input 
                                                      type="text"
                                                      className="w-full p-2 border rounded"
                                                      placeholder="Contoh: https://www.tiktok.com/@user/video/12345" 
                                                      value={videoLink} 
                                                      onChange={e => setVideoLink(e.target.value)} 
                                                    />
                                                    <p className="text-xs text-slate-500">Sistem akan otomatis mengekstrak Content ID dan mengubahnya menjadi format standar.</p>
                                                  </div>
                                                  <Button onClick={handleAddVideo} className="w-full">Simpan Video</Button>
                                                </div>
                                              </DialogContent>
                                            </Dialog>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Bagian Laporan Iklan */}
                                {localData?.ads?.filter((a: any) => a.campaign_id === tr.campaign_id).length > 0 && (
                                  <div className="mt-4 rounded-lg border border-indigo-200 overflow-hidden bg-indigo-50/30 shadow-sm">
                                    <div className="bg-indigo-100/50 px-4 py-2 border-b border-indigo-200 flex justify-between items-center">
                                      <h4 className="text-xs font-bold text-indigo-900 uppercase">Riwayat Ads Performance (TikTok)</h4>
                                      <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold">Terverifikasi</span>
                                    </div>
                                    <Table className="text-sm">
                                      <TableHeader className="bg-indigo-50/50">
                                        <TableRow>
                                          <TableHead className="h-8 text-xs font-semibold text-slate-500">Ad Name / Ad ID</TableHead>
                                          <TableHead className="h-8 text-right text-xs font-semibold text-slate-500">Cost (IDR)</TableHead>
                                          <TableHead className="h-8 text-right text-xs font-semibold text-slate-500">Revenue (IDR)</TableHead>
                                          <TableHead className="h-8 text-center text-xs font-semibold text-slate-500">ROAS</TableHead>
                                          <TableHead className="h-8 text-center text-xs font-semibold text-slate-500">Purchases</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {localData?.ads?.filter((a: any) => a.campaign_id === tr.campaign_id).map((ad: any) => {
                                          const costIdr = ad.cost_usd * ad.kurs;
                                          const revenueIdr = ad.gross_revenue_usd * ad.kurs;
                                          const roas = costIdr > 0 ? (revenueIdr / costIdr).toFixed(2) : '-';
                                          return (
                                            <TableRow key={ad.id} className="hover:bg-indigo-50">
                                              <TableCell>
                                                <p className="font-medium text-slate-700 truncate max-w-[150px]" title={ad.ad_name}>{ad.ad_name}</p>
                                                <p className="font-mono text-[10px] text-slate-500">{ad.ad_id}</p>
                                              </TableCell>
                                              <TableCell className="text-right font-medium text-red-600">Rp {costIdr.toLocaleString()}</TableCell>
                                              <TableCell className="text-right font-bold text-emerald-600">Rp {revenueIdr.toLocaleString()}</TableCell>
                                              <TableCell className="text-center font-bold text-indigo-700">{roas}</TableCell>
                                              <TableCell className="text-center text-slate-600">{ad.purchases}</TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )})}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-slate-500">Belum pernah mengikuti campaign.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat Snapshot (Pertumbuhan)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-right">Audience Age</TableHead>
                    <TableHead className="text-right">Level</TableHead>
                    <TableHead className="text-right">GMV 30 Hari</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{new Date(s.tanggal_update).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell className="text-right">{s.audience_age || '-'}</TableCell>
                      <TableCell className="text-right">{s.level || '-'}</TableCell>
                      <TableCell className="text-right">{s.gmv_30d ? `Rp ${s.gmv_30d.toLocaleString()}` : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
