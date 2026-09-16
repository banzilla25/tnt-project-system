# Arsitektur Sistem Tracking & Sinkronisasi Penjualan TNT

## 1. Ikhtisar Alur Import Data (Organik Sales, Awareness Video, Awareness Live)

Aplikasi TNT Project Tracking System memiliki 3 alur utama import data dari TikTok Partner Center / Ads Manager:

1. **Organik Sales (`mode = 'sales'`)**:
   - **Tabel Target**: `sales`
   - **Composite Conflict Key**: `order_id` (`${orderIdRaw}_${skuIdStr}_${rawProductId}_${tiktokCampaignId}`)
   - **Metrik Utama**: GMV, Quantity, Price, Status Order, Komisi, Tanggal Transaksi, Creator Username, Product ID.
   - **Fungsi Bisnis**: Menghitung performa penjualan campaign, tracking GMV kreator, dan rekonsiliasi pembayaran.

2. **Awareness Video (`mode = 'video'`)**:
   - **Tabel Target**: `organic_videos`
   - **Composite Conflict Key**: `content_uid, product_id`
   - **Metrik Utama**: Video Views, Video Likes, Video Duration, Video Product RPM, Creator Username, Post Time, Content Type (`'Video'`).
   - **Fungsi Bisnis**: Tracking view dan engagement video organik, serta auto-populasi ke tabel `videos` (Pending Video) untuk approval konten.

3. **Awareness Live (`mode = 'live'`)**:
   - **Tabel Target**: `organic_videos`
   - **Composite Conflict Key**: `content_uid, product_id`
   - **Metrik Utama**: Live Views, Live Likes, Duration, RPM, Content Type (`'Livestream'`).
   - **Fungsi Bisnis**: Tracking exposure sesi livestreaming kreator per campaign.

---

## 2. Aturan Smart Routing & Hierarki Pemetaan Campaign

Saat data diimport melalui file Excel/CSV:
- **Prioritas 1 (Absolute Priority)**: **Product ID (SKU Match)**
  Sistem mencocokkan `product_id` pada setiap baris data dengan master SKU (`skus.product_id`). Jika cocok, data secara absolut dialokasikan ke `skus.campaign_id`.
- **Prioritas 2 (Fallback)**: **TikTok Campaign ID**
  Jika `product_id` belum terdaftar di tabel SKU, sistem memeriksa apakah `tiktok_campaign_id` terdaftar pada campaign yang ada.
- **Unmapped State (`campaign_id = NULL`)**:
  Jika baris data tidak cocok dengan SKU maupun Campaign ID mana pun, data **tetap disimpan ke database** (`sales` atau `organic_videos`) dengan status `campaign_id = NULL`. Hal ini menjamin tidak ada data historis yang hilang saat diupload sebelum campaign dibuat.

---

## 3. Preservasi Status Approval Kreator & Auto-Registration

Sistem menjamin keutuhan data listing kreator saat data baru diimport:

1. **Kreator yang SUDAH ADA di Campaign (`campaign_creators`)**:
   - Status approval (`approved`, `not_approved`, `alternate`) **TIDAK AKAN PERNAH DI-RESET**.
   - Ratecard (`price`), status bayar (`status_bayar`), catatan PIC/Manager, dan kuota VT **tetap utuh**.
   - Sistem **hanya** memperbarui array `assigned_sku_ids` jika terdeteksi produk baru yang dipromosikan oleh kreator tersebut.

2. **Kreator yang BELUM ADA di Campaign**:
   - Jika username kreator belum pernah terdaftar di sistem secara global, sistem membuat record baru di tabel `creators`.
   - Kreator otomatis didaftarkan ke `campaign_creators` untuk campaign tersebut dengan status default:
     - `approval`: `'pending'`
     - `client_approval`: `'not_required'`
     - `status_bayar`: `'belum'`
     - `tier`: `'Auto-Detect'`
     - `qty_vt`: `1`
     - `price`: `0`

3. **Auto-Populasi Konten ke Tabel Videos**:
   - Untuk setiap video baru yang terdeteksi pada Awareness Video / Sync Unmapped, sistem otomatis menambahkan baris baru ke tabel `videos` dengan nomor urutan (`urutan`) berikutnya.
   - Status awal VT approval adalah `pending`.

---

## 4. Mekanisme Sinkronisasi Otomatis Data Historis (Auto-Sync Unmapped Data)

Ketika pengguna membuat campaign baru atau menambahkan Product ID ke suatu campaign:
1. **Direct Server-Side Execution (`src/lib/syncUnmapped.ts`)**:
   - Pemetaan data unmapped dieksekusi langsung pada level server Supabase tanpa loopback HTTP fetch lokal.
   - Fungsi `syncUnmappedForProduct(productId, campaignId, skuId)` secara instan mengupdate:
     * `UPDATE sales SET campaign_id = campaignId, sku_id = skuId WHERE campaign_id IS NULL AND product_id = productId`
     * `UPDATE organic_videos SET campaign_id = campaignId WHERE campaign_id IS NULL AND product_id = productId`
   - Seluruh kreator dari transaksi/video tersebut langsung didaftarkan ke `campaign_creators` dengan status `pending` (jika belum ada).
2. **Pemicu Sinkronisasi (Sync Triggers)**:
   - **Saat Input Produk Massal**: Dieksekusi otomatis oleh `saveBatchSkusAction`.
   - **Saat Edit Produk**: Dieksekusi otomatis oleh `updateSkuAction`.
   - **Tombol Manual di Halaman SKU Campaign**: Tombol *"Sinkronkan Data Unmapped"* di `/campaigns/[id]/sku` untuk rekonsiliasi instan data kapan saja.

---

## 5. Sistem Master Konsep & Dropdown Pemilihan Konsep

1. **Struktur Master Konsep (`campaign_concepts`)**:
   - Dikelola melalui menu Master Konsep (`/campaigns/[id]/concepts`).
   - Setiap konsep memiliki `no_konsep`, `sku_id` (terhubung ke tabel `skus`), `judul_konsep`, `tier_konsep`, `hook`, `fitur_usp`, `cta`, `status_approval`, dan `notes`.

2. **Dropdown Pemilihan Konsep di Listing & Video Approval**:
   - Diterapkan pada baris video kreator di halaman **Listing (`CreatorRow.tsx`)** dan **Video Approval (`VideoClient.tsx`)**.
   - **Format Opsi Dropdown**:
     `No. {no_konsep} - {nama_produk} - {judul_konsep}`
   - **Handling Master Konsep Kosong**:
     Jika campaign belum memiliki master konsep (`masterConcepts.length === 0`), UI menampilkan banner notifikasi yang rapi:
     *"Belum ada konsep di master konsep campaign ini."* disertai tautan langsung *"+ Tambah di Menu Konsep"* (`/campaigns/[id]/concepts`).
   - **Preservasi Data & Modal Detail**:
     - Jika konsep dipilih, tombol info detail (`[Info]`) muncul di samping dropdown untuk membuka modal brief lengkap (Hook, USP, CTA, Catatan).
     - Nilai yang disimpan ke database (`videos.concept`) tetap berupa string `no_konsep` yang kompatibel 100% dengan filter video, performa mingguan/bulanan, dan export CSV.
