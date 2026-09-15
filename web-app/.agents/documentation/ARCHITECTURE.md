# Architecture & Context Mapping

## 1. High-Level Overview
Aplikasi ini adalah **Project Tracking System** (atau Sistem Manajemen Kampanye & Kreator) yang dirancang untuk mengelola berbagai aspek dari influencer marketing dan e-commerce campaigns. Sistem ini menangani lifecycle kampanye mulai dari pendataan kreator (Creator Pool), manajemen budget (Budgeting & Invoice), hingga pelacakan performa konten, penjualan (GMV), dan laporan iklan (Ads Report).

**Tech Stack Utama:**
- **Framework & UI:** Next.js (App Router), React 19, Tailwind CSS, Radix UI (Headless UI components), Lucide React (Icons).
- **Backend & Database:** Supabase (PostgreSQL untuk Database, Authentication, dan Row Level Security).
- **State Management & Data Fetching:** Zustand (`useDatabaseStore`), SWR.
- **Data Processing:** `xlsx`, `exceljs`, `papaparse` (untuk keperluan import/export data Excel dan CSV secara massal).

## 2. Directory & Module Mapping
Struktur direktori aplikasi menggunakan pola standar Next.js App Router dengan pemisahan komponen dan utilitas yang jelas:

- **`src/app/`**: Berisi seluruh routing dan halaman aplikasi. Modul utama meliputi:
  - **`campaigns/`**: Modul paling kompleks. Menangani manajemen kampanye per ID (`[id]`), termasuk listing kreator, pelacakan video, live stream, keuangan (batch pembayaran), dan performa (GMV).
  - **`creator-pool/`**: Database master kreator, berfungsi untuk menambahkan atau mengimpor data kreator secara massal.
  - **`budgeting/` & `invoice/`**: Modul keuangan untuk memantau pengeluaran, pengajuan pembayaran, dan workflow persetujuan (approval). Modul ini menggunakan RPC khusus (`rpc_get_payment_batches`) untuk efisiensi beban query.
  - **`ads-report/` & `input-penjualan/`**: Modul analitik dan pelaporan data iklan serta konversi organik. Telah dioptimasi dengan pembagian *chunking* pengiriman data (100-200 baris per batch).
  - **`manajemen-akun/` & `auth/` & `login/`**: Modul autentikasi dan otorisasi berbasis Role (Admin, Manager, Executive, dll).
  - **`brand-portal/` & `portal/`**: Akses eksternal atau dashboard khusus untuk klien/brand melihat ringkasan kampanye.
- **`src/components/`**: Komponen UI yang reusable (menggunakan Radix UI), modul sinkronisasi (`*SyncModal.tsx`), dan layout (`Sidebar`, `GlobalCommandCenter`).
- **`src/store/`**: Global state management menggunakan Zustand (`useDatabaseStore.ts`).
- **`src/utils/`**: Helper functions, integrasi Supabase (`client.ts`, `server.ts`), dan formatter.
- **`src/types/`**: Definisi tipe TypeScript (`database.ts` yang di-generate dari Supabase schema).
- **`supabase/migrations/`**: Berisi seluruh file SQL untuk migrasi database, fungsi RPC, dan trigger (sangat krusial untuk logika backend).
- **`scripts/`**: Kumpulan skrip-skrip operasional eksternal atau *maintenance* `.js`, `.ts`, `.py`, dll (yang sebelumnya berceceran di root).

## 3. Core Data Flow & State Management
- **Client-Server Communication:** Data mengalir melalui **Supabase Client/Server Components**. Sebagian besar pengambilan data dilakukan menggunakan Server Actions di folder `actions/` (contoh: `paymentActions.ts`, `videoActions.ts`) atau menggunakan hooks langsung dari Supabase client.
- **State Management:** 
  - **Global State:** Dikelola oleh **Zustand** (`useDatabaseStore.ts`).
  - **Server State:** Mengandalkan **SWR** dan Next.js App Router Server Components/Server Actions untuk revalidasi dan caching data.
- **Vercel & Supabase Free Tier Optimization (System Flow):** 
  - **Batch Processing Flow:** Data Excel di-parse di sisi klien menggunakan `xlsx` atau `papaparse`, lalu dikirim dengan metode *chunking* (misal: 100-200 baris) per pemanggilan fungsi, menghindari error *Payload Too Large*.
  - **Database Aggregation:** Query besar (*Join* bersarang 4 tingkat ke atas) seperti pada `fetchCommandCenterBatches()` tidak dilakukan melalui ORM PostgREST bawaan, melainkan ditangani penuh oleh PostgreSQL Server melalui fungsi **RPC (Remote Procedure Call)** yang mengembalikan `jsonb`, menyelesaikan limitasi timeout 10 detik dari Vercel Serverless.
  - **Query Culling:** Pemanggilan data dalam skala ribuan difilter sejak dari database (seperti filter barter menggunakan `.gt('price', 0)`) alih-alih di sisi klien.

## 4. Critical Dependencies & Hotspots
Berdasarkan analisis *God Nodes* dari Graphify, berikut adalah modul dan file yang menjadi pusat ketergantungan tertinggi (Hotspots):
1. **`@supabase/supabase-js` & `createClient()`** (176+ edges): Titik pusat dari seluruh interaksi database dan autentikasi. Sangat kritikal.
2. **`react`** (86 edges): Dependency inti UI.
3. **`xlsx`** (69 edges): Hotspot untuk pemrosesan file Excel. Banyak fitur (seperti Import Kreator, Ads Report) sangat bergantung pada modul ini.
4. **`useDatabaseStore`** (63 edges): Pusat manajemen state global di sisi klien. Perubahan pada store ini akan memicu re-render di banyak komponen.
5. **`lucide-react` & `cn()`** (62 & 27 edges): Inti dari sistem desain dan styling komponen UI (Tailwind merge utils).
6. **`useAuth()`**: Mengontrol akses, role-based access control (RBAC), dan proteksi rute.

## 5. Technical Debt Status (Resolved & Monitored)
- **[RESOLVED] Server Action Bottlenecks:** Risiko *timeout* Vercel akibat join data masif di modul Keuangan dan Budgeting telah diselesaikan dengan migrasi logika ke fungsi SQL RPC. Query kreator *unpaid* juga telah dioptimasi dengan pembuangan kreator barter.
- **[RESOLVED] Scattered Scripts:** Ratusan file script (*isolated nodes*) yang tadinya berada di root direktori telah dipindahkan dan diorganisir ke dalam folder `scripts/`, membersihkan *namespace* proyek dan mereduksi potensi *overhead* di *build-time*.
- **[RESOLVED] Dangling Endpoints:** Evaluasi lebih dalam membuktikan *dangling edges* 158 buah merupakan alarm palsu (*false positive*) dari identifikasi pustaka eksternal (*node_modules*). *Broken imports* sesungguhnya (2 di `input-penjualan`) telah ditangani dan dihapus dari halaman produksi.
- **[MONITORED] Isolated Nodes (Unused Code):** Meskipun skrip lepasan sudah dipindah, mungkin masih terdapat banyak komponen *frontend* atau sisa pengujian yang berwujud isolasi. Masih perlu pengamatan jangka panjang untuk pembersihan kode usang (*code cleanup*).
