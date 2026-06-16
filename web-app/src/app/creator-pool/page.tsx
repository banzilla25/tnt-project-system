"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import { getCreatorType } from "@/utils/computed";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Search, Loader2, Download } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/utils/supabase/client";
import { exportToCSV } from "@/utils/exportCsv";

const supabase = createClient();
const PAGE_SIZE = 48;

export default function CreatorPoolPage() {
  const { niches, campaigns, addCreatorFull } = useDatabaseStore();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterNiche, setFilterNiche] = useState<string>("");
  const [filterCampaign, setFilterCampaign] = useState<string>("");
  
  // Debounce search to avoid spamming Supabase on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Server-Side Data State
  const [data, setData] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Add Creator State
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ username: "", nama_asli: "", nomor: "", audience_age: "", level: "", gmv_30d: "", niche_ids: [] as number[] });

  const fetchCreators = useCallback(async (pageNum: number, isReset: boolean = false) => {
    setIsLoading(true);
    try {
      let query: any = supabase.from('creators').select(`
        id, username, nama_asli, link_account,
        creator_snapshots ( audience_age, level, tanggal_update ),
        creator_niches ( niche_id ),
        campaign_creators ( campaign_id )
      `);

      if (debouncedSearch) {
        query = query.or(`username.ilike.%${debouncedSearch}%,nama_asli.ilike.%${debouncedSearch}%`);
      }

      // Supabase PostgREST doesn't easily filter parent based on nested relationships natively without inner joins.
      // For this SME MVP, we fetch and filter, or we use a database function. 
      // To strictly follow "Free Tier", filtering on nested relations using standard .select() is okay, 
      // but if we do .range(), we might get empty pages if we filter post-fetch.
      // The best way in Supabase to filter by related table is using !inner.
      if (filterCampaign) {
        // We redefine query to use inner join on campaign_creators
        query = supabase.from('creators').select(`
          id, username, nama_asli, link_account,
          creator_snapshots ( audience_age, level, tanggal_update ),
          creator_niches ( niche_id ),
          campaign_creators!inner ( campaign_id )
        `).eq('campaign_creators.campaign_id', filterCampaign);

        if (debouncedSearch) {
          query = query.or(`username.ilike.%${debouncedSearch}%,nama_asli.ilike.%${debouncedSearch}%`);
        }
      }

      if (filterNiche) {
        // If we also filter by Niche, we append to inner join
        // For simplicity, we just use !inner on creator_niches if filterCampaign is not set.
        // If both are set, Supabase allows chaining.
        const baseSelect = `
          id, username, nama_asli, link_account,
          creator_snapshots ( audience_age, level, tanggal_update ),
          creator_niches!inner ( niche_id )
          ${filterCampaign ? ', campaign_creators!inner ( campaign_id )' : ''}
        `;
        query = supabase.from('creators').select(baseSelect)
          .eq('creator_niches.niche_id', filterNiche);
          
        if (filterCampaign) {
          query = query.eq('campaign_creators.campaign_id', filterCampaign);
        }
        if (debouncedSearch) {
          query = query.or(`username.ilike.%${debouncedSearch}%,nama_asli.ilike.%${debouncedSearch}%`);
        }
      }

      // Add pagination
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.order('id', { ascending: false }).range(from, to);

      const { data: res, error } = await query;
      if (error) throw error;

      // Type Filter (Audience Age -> Type) needs to be done post-fetch because it's computed
      let filteredRes = res || [];
      if (filterType) {
         filteredRes = filteredRes.filter((c: any) => {
            const snaps = c.creator_snapshots || [];
            const latest = snaps.length > 0 ? snaps.sort((a:any, b:any) => new Date(b.tanggal_update).getTime() - new Date(a.tanggal_update).getTime())[0] : null;
            const type = getCreatorType(latest?.audience_age || null);
            return type === filterType;
         });
      }

      if (isReset) {
        setData(filteredRes);
      } else {
        setData(prev => [...prev, ...filteredRes]);
      }

      setHasMore((res || []).length === PAGE_SIZE);
    } catch (err: any) {
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filterType, filterNiche, filterCampaign]);

  // Trigger fetch when filters change
  useEffect(() => {
    setPage(0);
    fetchCreators(0, true);
  }, [debouncedSearch, filterType, filterNiche, filterCampaign, fetchCreators]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCreators(nextPage, false);
  };

  const handleExport = () => {
    const exportData = data.map(c => ({
      'Username': c.username,
      'Nama Asli': c.nama_asli || '',
      'Audience Age': c.creator_snapshots?.[0]?.audience_age || '',
      'Level': c.creator_snapshots?.[0]?.level || '',
      'GMV 30D': c.creator_snapshots?.[0]?.gmv_30d || 0
    }));
    exportToCSV(exportData, 'creator_pool_export');
  };

  const handleAddCreator = async () => {
    if (!form.username) {
      alert("Username harus diisi");
      return;
    }
    setIsAdding(true);
    try {
      await addCreatorFull(
        { username: form.username.replace('@', ''), nama_asli: form.nama_asli, link_account: `https://tiktok.com/@${form.username.replace('@', '')}`, rekening: null },
        { 
          audience_age: form.audience_age || null, 
          level: parseInt(form.level) || null, 
          gmv_30d: parseInt(form.gmv_30d) || 0,
          tanggal_update: new Date().toISOString().split('T')[0]
        },
        form.nomor,
        form.niche_ids
      );
      setIsAdding(false);
      setForm({ username: "", nama_asli: "", nomor: "", audience_age: "", level: "", gmv_30d: "", niche_ids: [] });
      // Refresh first page
      setPage(0);
      fetchCreators(0, true);
    } catch (e) {
      alert("Gagal menambahkan kreator. Mungkin username sudah ada.");
      setIsAdding(false);
    }
  };

  const toggleNiche = (id: number) => {
    setForm(prev => ({
      ...prev,
      niche_ids: prev.niche_ids.includes(id) 
        ? prev.niche_ids.filter(n => n !== id)
        : [...prev.niche_ids, id]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creator Pool</h1>
          <p className="text-slate-500">Database aset creator lintas campaign. (Paginated)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
            <DialogTrigger asChild>
              <Button>+ Tambah Kreator Baru</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Tambah Kreator Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username TikTok</label>
                  <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500">@</span>
                  <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="w-full pl-8 p-2 border rounded text-sm" placeholder="username" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Asli / Panggilan</label>
                <input type="text" value={form.nama_asli} onChange={e => setForm({...form, nama_asli: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Nama..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nomor WhatsApp Aktif</label>
                <input type="text" value={form.nomor} onChange={e => setForm({...form, nomor: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="08..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Audience Age</label>
                  <input type="text" value={form.audience_age} onChange={e => setForm({...form, audience_age: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="25 - 34" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Level TikTok</label>
                  <input type="number" value={form.level} onChange={e => setForm({...form, level: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="1-8" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Niche Utama</label>
                <div className="flex flex-wrap gap-2">
                  {niches.map(n => (
                    <Badge 
                      key={n.id} 
                      variant={form.niche_ids.includes(n.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleNiche(n.id)}
                    >
                      {n.nama}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={handleAddCreator} disabled={isAdding} className="w-full mt-4">
                {isAdding ? "Menyimpan..." : "Simpan Kreator"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari username atau nama asli..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        
        <select 
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">Semua Tipe</option>
          <option value="Nano">Nano</option>
          <option value="Micro">Micro</option>
          <option value="Macro">Macro</option>
          <option value="Mega">Mega</option>
        </select>

        <select 
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          value={filterNiche}
          onChange={(e) => setFilterNiche(e.target.value)}
        >
          <option value="">Semua Niche</option>
          {niches.map(n => <option key={n.id} value={n.id}>{n.nama}</option>)}
        </select>

        <select 
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
        >
          <option value="">Pernah di Campaign</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map(creator => {
          // Extract nested data safely
          const snaps = creator.creator_snapshots || [];
          const snapshot = snaps.length > 0 ? snaps.sort((a:any, b:any) => new Date(b.tanggal_update).getTime() - new Date(a.tanggal_update).getTime())[0] : null;
          const type = getCreatorType(snapshot?.audience_age || null);
          const cNiches = (creator.creator_niches || []).map((cn:any) => niches.find(n => n.id === cn.niche_id)?.nama).filter(Boolean);

          return (
            <Link key={creator.id} href={`/creator-pool/${creator.id}`}>
              <Card className="hover:border-blue-500 transition-colors cursor-pointer h-full">
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg truncate max-w-[200px]">@{creator.username}</h3>
                        {creator.nama_asli && <p className="text-sm text-slate-500 truncate max-w-[200px]">{creator.nama_asli}</p>}
                      </div>
                      <Badge variant="secondary">{type}</Badge>
                    </div>
                    
                    <div className="flex gap-2 mb-4 flex-wrap">
                      {cNiches.map((niche: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-[10px] uppercase">{niche}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded-lg mt-auto">
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Audience Age</p>
                      <p className="font-semibold">{snapshot?.audience_age || '-'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Level</p>
                      <p className="font-semibold">{snapshot?.level ? `Level ${snapshot.level}` : '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {data.length === 0 && !isLoading && (
          <div className="col-span-full text-center py-12 text-slate-500 border border-dashed border-slate-200 rounded-xl">
            Tidak ada kreator yang cocok dengan filter pencarian.
          </div>
        )}
      </div>

      {hasMore && data.length > 0 && (
        <div className="flex justify-center mt-8">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoading} className="w-[200px]">
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isLoading ? "Memuat..." : "Muat Lebih Banyak"}
          </Button>
        </div>
      )}
      
      {isLoading && data.length === 0 && (
         <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
         </div>
      )}
    </div>
  );
}
