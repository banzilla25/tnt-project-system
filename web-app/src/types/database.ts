export type Brand = {
  id: number;
  nama: string;
  status: 'aktif' | 'arsip';
  created_at: string;
};

export type Campaign = {
  id: number;
  brand_id: number;
  nama: string;
  tipe_campaign: 'sales' | 'awareness' | 'gmv_awareness';
  persiapan_14hari: string | null;
  start_date: string;
  end_date: string;
  target_gmv: number | null;
  target_video: number | null;
  target_creator: number | null;
  budget_creator_plafon: number;
  budget_ads_plafon: number;
  vsa_gmv_max: number | null;
  pic: string | null;
  assist: string | null;
  file_concept_url: string | null;
  status: 'aktif' | 'selesai';
  pin: string | null;
  require_client_approval: boolean;
  created_at: string;
};

export type Creator = {
  id: number;
  username: string;
  nama_asli: string | null;
  link_account: string | null;
  rekening: string | null;
  alamat_penerima: string | null;
  alamat_jalan: string | null;
  alamat_kecamatan: string | null;
  alamat_kota: string | null;
  alamat_provinsi: string | null;
  alamat_kodepos: string | null;
  created_at: string;
};

export type CreatorSnapshot = {
  id: number;
  creator_id: number;
  tanggal_update: string;
  audience_age: string | null;
  followers: number | null;
  level: number | null;
  ratecard: number | null;
  tier: string | null;
  gmv_30d: number | null; // stored as number, but logic might say "1jt+" in real DB it's bigint so number here is ok
  created_at: string;
};

export type CreatorContact = {
  id: number;
  creator_id: number;
  nomor: string;
  status: 'aktif' | 'arsip';
  tanggal_mulai: string;
  tanggal_diganti: string | null;
};

export type Niche = {
  id: number;
  nama: string;
};

export type CreatorNiche = {
  creator_id: number;
  niche_id: number;
  peringkat: number;
};

export type CreatorNote = {
  id: number;
  creator_id: number;
  isi: string;
  penulis: string;
  created_at: string;
};

export type CampaignCreator = {
  id: number;
  campaign_id: number;
  creator_id: number;
  tier: string | null;
  price: number;
  qty_vt: number;
  content_type: string | null;
  approval: 'pending' | 'approved' | 'alternate' | 'not_approved';
  status_bayar: 'belum' | 'sebagian' | 'lunas';
  pic_assist: string | null;
  notes_manager: string | null;
  notes_pic: string | null;
  sample_progress: string | null;
  gmv_organic_legacy: number | null;
  gmv_ads_legacy: number | null;
  client_approval: 'pending' | 'approved' | 'rejected' | 'not_required';
  added_by: string | null;
  last_updated_by: string | null;
  last_updated_at: string | null;
  created_at: string;
};

export type Video = {
  id: number;
  campaign_creator_id: number;
  urutan: number;
  concept: string | null;
  link_video: string | null;
  content_uid: string | null;
  vt_approval: 'pending' | 'approved' | 'reject';
  created_at: string;
};

export type AuditLog = {
  id: number;
  tabel: string;
  record_id: number;
  field: string;
  nilai_lama: string | null;
  nilai_baru: string | null;
  diubah_oleh: string;
  created_at: string;
};

export type Sku = {
  id: number;
  campaign_id: number;
  link_gmv_max: string | null;
  nama_produk: string;
  product_id: string;
  satuan_bundle: string | null;
  link_tap: string | null;
  commission: number | null;
};

export type CampaignSummary = {
  campaign_id: number;
  nama: string;
  tipe_campaign: 'sales' | 'awareness' | 'gmv_awareness';
  status: 'aktif' | 'selesai';
  start_date: string;
  end_date: string;
  target_gmv: number | null;
  target_video: number | null;
  target_creator: number | null;
  budget_creator_plafon: number;
  budget_ads_plafon: number;
  tracked_creator_gmv: number;
  total_daily_organic: number;
  total_daily_vsa: number;
  official_daily_gmv: number;
  total_gmv_achievement: number;
  achievement_video: number;
  achievement_creator: number;
  budget_ads_terpakai: number;
  sisa_budget_ads: number;
  total_pembayaran_kreator: number;
  require_client_approval: boolean;
};

export type PayoutRequest = {
  id: number;
  campaign_id: number;
  jenis_topup: 'creator' | 'ads';
  nominal: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export type PayoutCreator = {
  id: number;
  payout_id: number;
  campaign_creator_id: number;
  nominal: number;
  tanggal_transfer: string | null;
  bukti_transfer_url: string | null;
};

export type CreatorPayment = {
  id: number;
  campaign_creator_id: number;
  rate_card: number;
  pelunasan: number;
  status_bayar: 'no_payment' | 'not_yet' | 'half_paid' | 'pay_off';
  tgl_pembayaran: string | null;
  created_at: string;
};

export type AdsSpend = {
  id: number;
  campaign_id: number;
  detail: string | null;
  nominal: number;
  status_bayar: 'not_yet' | 'half_paid' | 'pay_off';
  tanggal: string | null;
  created_at: string;
};

export type CreatorAddress = {
  id: number;
  campaign_creator_id: number;
  nama_penerima: string | null;
  nama_jalan: string | null;
  provinsi: string | null;
  kabupaten_kota: string | null;
  kecamatan: string | null;
  kelurahan: string | null;
  kode_pos: string | null;
  proses: string | null;
  tanggal_kirim: string | null;
  resi: string | null;
  notes: string | null;
  is_cancel: boolean;
  created_at: string;
};

export type LiveSchedule = {
  id: number;
  campaign_creator_id: number;
  tanggal_live: string;
  created_at: string;
};

export type CreatorAddressBook = {
  id: number;
  creator_id: number;
  label: string | null;
  nama_penerima: string | null;
  alamat_jalan: string | null;
  kecamatan: string | null;
  kota: string | null;
  provinsi: string | null;
  kodepos: string | null;
  is_primary: boolean;
  created_at: string;
};

export interface DatabaseSchema {
  brands: Brand[];
  campaigns: Campaign[];
  creators: Creator[];
  creator_snapshots: CreatorSnapshot[];
  creator_contacts: CreatorContact[];
  niches: Niche[];
  creator_niches: CreatorNiche[];
  creator_notes: CreatorNote[];
  campaign_creators: CampaignCreator[];
  videos: Video[];
  audit_logs: AuditLog[];
  skus: Sku[];
  vw_campaign_summary: CampaignSummary[];
  daily_performance: DailyPerformance[];
  payout_requests: PayoutRequest[];
  payout_creator: PayoutCreator[];
  creator_payments: CreatorPayment[];
  ads_spends: AdsSpend[];
  creator_addresses: CreatorAddress[];
  creator_address_book: CreatorAddressBook[];
  live_schedules: LiveSchedule[];
  sales: Sales[];
  ads_performance: AdsPerformance[];
  ad_name_mapping: AdNameMapping[];
}

export interface DailyPerformance {
  id: number;
  campaign_id: number;
  date: string;
  organic_sales: number;
  vsa_sales: number;
  created_at: string;
}

export type Sales = {
  id: number;
  campaign_id: number | null;
  creator_username: string | null;
  content_uid: string | null;
  sku_id: number | null;
  product_id: string | null;
  tanggal: string;
  price: number;
  quantity: number | null;
  gmv: number;
  is_refund: boolean;
  content_type: string | null;
  order_id: string | null;
  order_status: string | null;
  raw_data: any | null;
  created_at: string;
};

export type AdsPerformance = {
  id: number;
  ad_id: string;
  campaign_id: number | null;
  ad_name: string;
  creator_id: number | null;
  tanggal: string | null;
  cost_usd: number;
  gross_revenue_usd: number;
  purchases: number | null;
  impressions: number;
  clicks: number;
  kurs: number;
  created_at: string;
};

export type AdNameMapping = {
  ad_name: string;
  creator_id: number;
  created_at: string;
};
