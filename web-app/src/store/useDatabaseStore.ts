import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { DatabaseSchema, Creator, CreatorSnapshot, CreatorContact, CampaignCreator, Video, AuditLog, CreatorNote, CreatorPayment, AdsSpend, CreatorAddress, LiveSchedule, DailyPerformance } from '@/types/database';

type DatabaseState = DatabaseSchema & {
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  
  // Actions for Creator Pool
  addCreatorFull: (
    creator: Omit<Creator, 'id' | 'created_at'>,
    snapshot?: Omit<CreatorSnapshot, 'id' | 'created_at' | 'creator_id'>,
    contact?: string,
    nicheIds?: number[]
  ) => Promise<void>;
  updateCreator: (id: number, updates: Partial<Creator>) => Promise<void>;
  addCreatorSnapshot: (snapshot: Omit<CreatorSnapshot, 'id' | 'created_at'>) => Promise<void>;
  updateCreatorContact: (creatorId: number, newNomor: string) => Promise<void>;
  addCreatorNote: (note: Omit<CreatorNote, 'id' | 'created_at'>) => Promise<void>;
  updateCreatorNiches: (creatorId: number, nicheIds: number[]) => Promise<void>;
  
  // Actions for Campaigns
  addCampaign: (campaign: Omit<DatabaseSchema['campaigns'][0], 'id' | 'created_at'>) => Promise<DatabaseSchema['campaigns'][0] | null>;
  updateCampaign: (id: number, updates: Partial<DatabaseSchema['campaigns'][0]>) => Promise<void>;
  
  // Actions for Campaign Listing
  addCampaignCreator: (cc: Omit<CampaignCreator, 'id' | 'created_at'>) => Promise<void>;
  updateCampaignCreator: (id: number, updates: Partial<CampaignCreator>, changedBy: string) => Promise<void>;
  deleteCampaignCreator: (id: number) => Promise<void>;
  addVideo: (video: Omit<Video, 'id' | 'created_at'>) => Promise<void>;
  updateVideoApproval: (id: number, approval: Video['vt_approval'], changedBy: string) => Promise<void>;
  
  // Budgeting Actions
  fetchCreatorPayments: (campaignId: number) => Promise<void>;
  updateCreatorPayment: (id: number | null, payment: Partial<CreatorPayment>) => Promise<CreatorPayment | null>;
  fetchAdsSpends: (campaignId: number) => Promise<void>;
  addAdsSpend: (spend: Omit<AdsSpend, 'id' | 'created_at'>) => Promise<AdsSpend | null>;
  updateAdsSpend: (id: number, spend: Partial<AdsSpend>) => Promise<AdsSpend | null>;

  // Operations Actions
  fetchCreatorAddresses: (campaignId: number) => Promise<void>;
  updateCreatorAddress: (id: number | null, address: Partial<CreatorAddress>) => Promise<CreatorAddress | null>;
  fetchLiveSchedules: (campaignId: number) => Promise<void>;
  addLiveSchedule: (schedule: Omit<LiveSchedule, 'id' | 'created_at'>) => Promise<LiveSchedule | null>;
  deleteLiveSchedule: (id: number) => Promise<void>;
  // Settings Actions
  addBrand: (brand: Omit<DatabaseSchema['brands'][0], 'id' | 'created_at'>) => Promise<DatabaseSchema['brands'][0] | null>;
  updateBrand: (id: number, updates: Partial<DatabaseSchema['brands'][0]>) => Promise<void>;
  addNiche: (niche: Omit<DatabaseSchema['niches'][0], 'id'>) => Promise<void>;
  updateNiche: (id: number, updates: Partial<DatabaseSchema['niches'][0]>) => Promise<void>;

  // Daily Performance Actions
  addDailyPerformance: (record: Omit<DailyPerformance, 'id' | 'created_at'>) => Promise<void>;
  updateDailyPerformance: (id: number, updates: Partial<DailyPerformance>) => Promise<void>;

  // SKU Actions
  addSku: (sku: Omit<DatabaseSchema['skus'][0], 'id'>) => Promise<void>;
  updateSku: (id: number, updates: Partial<DatabaseSchema['skus'][0]>) => Promise<void>;
  deleteSku: (id: number) => Promise<void>;
};

const supabase = createClient();

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  brands: [],
  campaigns: [],
  creators: [],
  creator_snapshots: [],
  creator_contacts: [],
  niches: [],
  creator_niches: [],
  creator_notes: [],
  campaign_creators: [],
  videos: [],
  audit_logs: [],
  skus: [],
  vw_campaign_summary: [],
  payout_requests: [],
  payout_creator: [],
  creator_payments: [],
  ads_spends: [],
  creator_addresses: [],
  live_schedules: [],
  daily_performance: [],
  sales: [],
  ads_performance: [],
  ad_name_mapping: [],
  isLoading: false,
  error: null,

  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const fetchAll = async (table: string, orderByCol: string = 'id') => {
        let allData: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;
        while (hasMore) {
          let query = supabase.from(table).select('*');
          if (orderByCol) {
            query = query.order(orderByCol, { ascending: true });
          }
          const { data, error } = await query.range(from, to);
          
          if (error) throw error;
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (data.length < 1000) hasMore = false;
            else { from += 1000; to += 1000; }
          } else {
            hasMore = false;
          }
        }
        return allData;
      };

      // Heavy tables (creators, campaign_creators, snapshots, videos, sales) are lazily loaded in their components
      
      const [
        brandsRes, campaignsRes, nichesRes, creatorNichesRes, creatorNotesRes,
        skusRes, vwCampaignSummaryRes,
        dailyPerformanceRes, payoutRequestsRes, payoutCreatorRes, creatorPaymentsRes,
        adsSpendsRes, creatorAddressesRes, liveSchedulesRes, adsPerformanceRes, adNameMappingRes
      ] = await Promise.all([
        supabase.from('brands').select('*'),
        supabase.from('campaigns').select('*'),
        supabase.from('niches').select('*'),
        fetchAll('creator_niches', 'creator_id'),
        fetchAll('creator_notes'),
        supabase.from('skus').select('*'),
        supabase.from('vw_campaign_summary').select('*'), // Usually < 1000
        fetchAll('daily_performance'),
        fetchAll('payout_requests'),
        fetchAll('payout_creator'),
        fetchAll('creator_payments'),
        fetchAll('ads_spends'),
        fetchAll('creator_addresses'),
        fetchAll('live_schedules'),
        fetchAll('ads_performance'),
        supabase.from('ad_name_mapping').select('*')
      ]);

      set({
        brands: brandsRes.data || [],
        campaigns: campaignsRes.data || [],
        creators: [], // Creators are now paginated in their respective pages
        creator_snapshots: [], 
        creator_contacts: [],
        niches: nichesRes.data || [],
        creator_niches: creatorNichesRes || [],
        creator_notes: creatorNotesRes || [],
        campaign_creators: [], 
        videos: [],
        audit_logs: [],
        skus: skusRes.data || [],
        vw_campaign_summary: vwCampaignSummaryRes.data || [],
        daily_performance: dailyPerformanceRes || [],
        payout_requests: payoutRequestsRes || [],
        payout_creator: payoutCreatorRes || [],
        creator_payments: creatorPaymentsRes || [],
        ads_spends: adsSpendsRes || [],
        creator_addresses: creatorAddressesRes || [],
        live_schedules: liveSchedulesRes || [],
        sales: [],
        ads_performance: adsPerformanceRes || [],
        ad_name_mapping: adNameMappingRes.data || [],
        isLoading: false
      });
    } catch (err: any) {
      console.error("fetchData Error:", err);
      set({ error: err.message, isLoading: false });
    }
  },

  addCreatorFull: async (creator, snapshot, contact, nicheIds) => {
    try {
      // Insert Creator
      const { data: cData, error: cErr } = await supabase.from('creators').insert(creator).select().single();
      if (cErr || !cData) throw cErr;
      
      const newCreatorId = cData.id;
      set({ creators: [...get().creators, cData] });

      // Insert Snapshot
      if (snapshot) {
        const { data: sData } = await supabase.from('creator_snapshots').insert({
          ...snapshot,
          creator_id: newCreatorId
        }).select().single();
        if (sData) set({ creator_snapshots: [...get().creator_snapshots, sData] });
      }

      // Insert Contact
      if (contact) {
        const { data: ctData } = await supabase.from('creator_contacts').insert({
          creator_id: newCreatorId,
          nomor: contact,
          status: 'aktif',
          tanggal_mulai: new Date().toISOString().split('T')[0]
        }).select().single();
        if (ctData) set({ creator_contacts: [...get().creator_contacts, ctData] });
      }

      // Insert Niches
      if (nicheIds && nicheIds.length > 0) {
        const nicheRows = nicheIds.map((nId, idx) => ({
          creator_id: newCreatorId,
          niche_id: nId,
          peringkat: idx + 1
        }));
        const { data: nData } = await supabase.from('creator_niches').insert(nicheRows).select();
        if (nData) set({ creator_niches: [...get().creator_niches, ...nData] });
      }
    } catch (err) {
      console.error('Error adding creator full:', err);
      throw err;
    }
  },

  updateCreator: async (id, updates) => {
    const { data, error } = await supabase.from('creators').update(updates).eq('id', id).select().single();
    if (!error && data) {
      set(state => ({
        creators: state.creators.map(c => c.id === id ? { ...c, ...data } : c)
      }));
    }
  },

  addCreatorSnapshot: async (snapshot) => {
    // Deduplication check
    const existing = get().creator_snapshots
      .filter(s => s.creator_id === snapshot.creator_id)
      .sort((a, b) => new Date(b.tanggal_update).getTime() - new Date(a.tanggal_update).getTime())[0];
    
    if (existing) {
      if (existing.audience_age === snapshot.audience_age && 
          existing.level === snapshot.level && 
          existing.gmv_30d === snapshot.gmv_30d) {
        console.log("Snapshot identical to previous, skipping insert.");
        return; // Deduplicated
      }
    }

    const { data, error } = await supabase.from('creator_snapshots').insert(snapshot).select().single();
    if (!error && data) {
      set({ creator_snapshots: [...get().creator_snapshots, data] });
    }
  },

  updateCreatorContact: async (creatorId, newNomor) => {
    try {
      const activeContacts = get().creator_contacts.filter(c => c.creator_id === creatorId && c.status === 'aktif');
      
      // Check if the new number is already in archive
      const { data: existingArchived } = await supabase.from('creator_contacts')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('nomor', newNomor)
        .single();
      
      const today = new Date().toISOString().split('T')[0];

      // Archive all current active contacts
      for (const ac of activeContacts) {
        await supabase.from('creator_contacts').update({
          status: 'arsip',
          tanggal_diganti: today
        }).eq('id', ac.id);
        
        set(state => ({
          creator_contacts: state.creator_contacts.map(c => c.id === ac.id ? { ...c, status: 'arsip', tanggal_diganti: today } : c)
        }));
      }

      if (existingArchived) {
        // Upsert / Reactivate old number
        const { data: reactivated } = await supabase.from('creator_contacts').update({
          status: 'aktif',
          tanggal_mulai: today,
          tanggal_diganti: null
        }).eq('id', existingArchived.id).select().single();
        
        if (reactivated) {
          set(state => ({
            creator_contacts: state.creator_contacts.map(c => c.id === reactivated.id ? reactivated : c)
          }));
        }
      } else {
        // Insert new active number
        const { data: inserted } = await supabase.from('creator_contacts').insert({
          creator_id: creatorId,
          nomor: newNomor,
          status: 'aktif',
          tanggal_mulai: today
        }).select().single();
        
        if (inserted) {
          set(state => ({
            creator_contacts: [...state.creator_contacts, inserted]
          }));
        }
      }
    } catch (err) {
      console.error("Error updating contact:", err);
    }
  },

  updateCreatorNiches: async (creatorId, nicheIds) => {
    try {
      // Delete old niches
      await supabase.from('creator_niches').delete().eq('creator_id', creatorId);
      
      if (nicheIds.length > 0) {
        const rows = nicheIds.map((nId, idx) => ({
          creator_id: creatorId,
          niche_id: nId,
          peringkat: idx + 1
        }));
        const { data } = await supabase.from('creator_niches').insert(rows).select();
        set(state => ({
          creator_niches: [...state.creator_niches.filter(cn => cn.creator_id !== creatorId), ...(data || [])]
        }));
      } else {
        set(state => ({
          creator_niches: state.creator_niches.filter(cn => cn.creator_id !== creatorId)
        }));
      }
    } catch (err) {
      console.error(err);
    }
  },

  addCreatorNote: async (note) => {
    const { data, error } = await supabase.from('creator_notes').insert(note).select().single();
    if (!error && data) {
      set({ creator_notes: [...get().creator_notes, data] });
    }
  },

  addCampaign: async (campaign) => {
    try {
      const { data, error } = await supabase.from('campaigns').insert(campaign).select().single();
      if (error) throw error;
      if (data) {
        set({ campaigns: [...get().campaigns, data] });
        return data;
      }
      return null;
    } catch (err) {
      console.error('Error adding campaign:', err);
      throw err;
    }
  },

  updateCampaign: async (id, updates) => {
    const { error } = await supabase.from('campaigns').update(updates).eq('id', id);
    if (!error) {
      set((state) => ({
        campaigns: state.campaigns.map(c => c.id === id ? { ...c, ...updates } : c)
      }));
    }
  },

  addCampaignCreator: async (cc) => {
    const { data, error } = await supabase.from('campaign_creators').insert(cc).select().single();
    if (!error && data) {
      set({ campaign_creators: [...get().campaign_creators, data] });
    }
  },

  updateCampaignCreator: async (id, updates, changedBy) => {
    // Triggers in Supabase will handle the audit log automatically!
    const { error } = await supabase.from('campaign_creators').update(updates).eq('id', id);
    if (!error) {
      set((state) => ({
        campaign_creators: state.campaign_creators.map(c => c.id === id ? { ...c, ...updates } : c)
      }));
    }
  },

  addVideo: async (video) => {
    const { data, error } = await supabase.from('videos').insert(video).select().single();
    if (!error && data) {
      set({ videos: [...get().videos, data] });
    }
  },

  updateVideoApproval: async (id, approval, changedBy) => {
    const { error } = await supabase.from('videos').update({ vt_approval: approval }).eq('id', id);
    if (!error) {
      set((state) => ({
        videos: state.videos.map(v => v.id === id ? { ...v, vt_approval: approval } : v)
      }));
    }
  },

  updateCreatorPayment: async (id, payment) => {
    try {
      if (id) {
        const { data, error } = await supabase.from('creator_payments').update(payment).eq('id', id).select().single();
        if (error) throw error;
        set((state) => ({
          creator_payments: state.creator_payments.map(p => p.id === id ? { ...p, ...data } : p)
        }));
        
        // sync status_bayar to campaign_creators backwards compatibility
        if (payment.status_bayar && data.campaign_creator_id) {
          let syncStatus = 'belum';
          if (payment.status_bayar === 'pay_off') syncStatus = 'lunas';
          else if (payment.status_bayar === 'half_paid') syncStatus = 'sebagian';
          await supabase.from('campaign_creators').update({ status_bayar: syncStatus }).eq('id', data.campaign_creator_id);
          set((state) => ({
            campaign_creators: state.campaign_creators.map(c => c.id === data.campaign_creator_id ? { ...c, status_bayar: syncStatus as any } : c)
          }));
        }
        return data;
      } else if (payment.campaign_creator_id) {
        const cc = get().campaign_creators.find(c => c.id === payment.campaign_creator_id);
        const { data, error } = await supabase.from('creator_payments').insert({
          campaign_creator_id: payment.campaign_creator_id,
          rate_card: cc?.price || 0,
          ...payment
        }).select().single();
        
        if (error) throw error;
        set({ creator_payments: [...get().creator_payments, data] });

        if (payment.status_bayar) {
          let syncStatus = 'belum';
          if (payment.status_bayar === 'pay_off') syncStatus = 'lunas';
          else if (payment.status_bayar === 'half_paid') syncStatus = 'sebagian';
          await supabase.from('campaign_creators').update({ status_bayar: syncStatus }).eq('id', payment.campaign_creator_id);
          set((state) => ({
            campaign_creators: state.campaign_creators.map(c => c.id === payment.campaign_creator_id ? { ...c, status_bayar: syncStatus as any } : c)
          }));
        }
        return data;
      }
      return null;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  addAdsSpend: async (spend) => {
    try {
      const { data, error } = await supabase.from('ads_spends').insert(spend).select().single();
      if (!error && data) {
        set({ ads_spends: [...get().ads_spends, data] });
        return data;
      }
      return null;
    } catch (err) {
      return null;
    }
  },

  fetchCreatorPayments: async (campaignId) => {
    // Currently fetched in fetchData, left as stub
  },
  fetchAdsSpends: async (campaignId) => {
    // Currently fetched in fetchData, left as stub
  },
  updateAdsSpend: async (id, spend) => {
    try {
      const { data, error } = await supabase.from('ads_spends').update(spend).eq('id', id).select().single();
      if (!error && data) {
        set((state) => ({
          ads_spends: state.ads_spends.map(s => s.id === id ? { ...s, ...data } : s)
        }));
        return data;
      }
      return null;
    } catch {
      return null;
    }
  },

  fetchCreatorAddresses: async (campaignId) => {
    set({ isLoading: true, error: null });
    try {
      const { data: campaignCreators } = await supabase
        .from('campaign_creators')
        .select('id')
        .eq('campaign_id', campaignId);
      
      const ccIds = campaignCreators?.map(cc => cc.id) || [];
      
      if (ccIds.length > 0) {
        const { data, error } = await supabase
          .from('creator_addresses')
          .select('*')
          .in('campaign_creator_id', ccIds);
        
        if (error) throw error;
        set({ creator_addresses: data || [], isLoading: false });
      } else {
        set({ creator_addresses: [], isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  updateCreatorAddress: async (id, address) => {
    try {
      if (id) {
        const { data, error } = await supabase
          .from('creator_addresses')
          .update(address)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        set(state => ({
          creator_addresses: state.creator_addresses.map(a => a.id === id ? data : a)
        }));
        return data;
      } else {
        const { data, error } = await supabase
          .from('creator_addresses')
          .insert([address])
          .select()
          .single();
        if (error) throw error;
        set(state => ({
          creator_addresses: [...state.creator_addresses, data]
        }));
        return data;
      }
    } catch (err: any) {
      console.error(err);
      return null;
    }
  },

  fetchLiveSchedules: async (campaignId) => {
    set({ isLoading: true, error: null });
    try {
      const { data: campaignCreators } = await supabase
        .from('campaign_creators')
        .select('id')
        .eq('campaign_id', campaignId);
      
      const ccIds = campaignCreators?.map(cc => cc.id) || [];
      
      if (ccIds.length > 0) {
        const { data, error } = await supabase
          .from('live_schedules')
          .select('*')
          .in('campaign_creator_id', ccIds)
          .order('tanggal_live', { ascending: true });
        
        if (error) throw error;
        set({ live_schedules: data || [], isLoading: false });
      } else {
        set({ live_schedules: [], isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  addLiveSchedule: async (schedule) => {
    try {
      const { data, error } = await supabase
        .from('live_schedules')
        .insert([schedule])
        .select()
        .single();
      if (error) throw error;
      set(state => ({
        live_schedules: [...state.live_schedules, data].sort((a, b) => new Date(a.tanggal_live).getTime() - new Date(b.tanggal_live).getTime())
      }));
      return data;
    } catch (err: any) {
      console.error(err);
      return null;
    }
  },

  deleteLiveSchedule: async (id) => {
    try {
      const { error } = await supabase.from('live_schedules').delete().eq('id', id);
      if (error) throw error;
      set(state => ({
        live_schedules: state.live_schedules.filter(l => l.id !== id)
      }));
    } catch (err: any) {
      console.error(err);
    }
  },

  addBrand: async (brand) => {
    const { data, error } = await supabase.from('brands').insert(brand).select().single();
    if (!error && data) {
      set(state => ({ brands: [...state.brands, data] }));
      return data;
    }
    return null;
  },
  
  updateBrand: async (id, updates) => {
    const { error } = await supabase.from('brands').update(updates).eq('id', id);
    if (!error) {
      set(state => ({
        brands: state.brands.map(b => b.id === id ? { ...b, ...updates } : b)
      }));
    }
  },

  addNiche: async (niche) => {
    const { data, error } = await supabase.from('niches').insert(niche).select().single();
    if (!error && data) {
      set(state => ({ niches: [...state.niches, data] }));
    }
  },

  updateNiche: async (id, updates) => {
    const { error } = await supabase.from('niches').update(updates).eq('id', id);
    if (!error) {
      set(state => ({
        niches: state.niches.map(n => n.id === id ? { ...n, ...updates } : n)
      }));
    }
  },

  addDailyPerformance: async (record) => {
    const { data, error } = await supabase.from('daily_performance').insert(record).select().single();
    if (!error && data) {
      set(state => ({ daily_performance: [...state.daily_performance, data] }));
    } else if (error) {
      throw error;
    }
  },

  updateDailyPerformance: async (id, updates) => {
    const { data, error } = await supabase.from('daily_performance').update(updates).eq('id', id).select().single();
    if (!error && data) {
      set(state => ({
        daily_performance: state.daily_performance.map(d => d.id === id ? { ...d, ...updates } : d)
      }));
    } else if (error) {
      throw error;
    }
  },

  addSku: async (sku) => {
    const { data, error } = await supabase.from('skus').insert(sku).select().single();
    if (error) throw error;
    if (data) {
      set(state => ({ skus: [...state.skus, data] }));
    }
  },

  updateSku: async (id, updates) => {
    const { data, error } = await supabase.from('skus').update(updates).eq('id', id).select().single();
    if (error) throw error;
    if (data) {
      set(state => ({
        skus: state.skus.map(s => s.id === id ? data : s)
      }));
    }
  },

  deleteSku: async (id) => {
    const { error } = await supabase.from('skus').delete().eq('id', id);
    if (error) throw error;
    set(state => ({
      skus: state.skus.filter(s => s.id !== id)
    }));
  }
}));
