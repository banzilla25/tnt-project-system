# Architecture & Context Mapping

## 1. High-Level Overview
Aplikasi ini adalah **Project Tracking System** (atau Sistem Manajemen Kampanye & Kreator) yang dirancang untuk mengelola berbagai aspek dari influencer marketing dan e-commerce campaigns. Sistem ini menangani lifecycle kampanye mulai dari pendataan kreator (Creator Pool), manajemen budget (Budgeting & Invoice), hingga pelacakan performa konten, penjualan (GMV), dan laporan iklan (Ads Report).

**Tech Stack Utama:**
- **Framework & UI:** Next.js (App Router), React 19, Tailwind CSS, Radix UI (Headless UI components), Lucide React (Icons).
- **Backend & Database:** Supabase (PostgreSQL untuk Database, Authentication, dan Row Level Security).
- **State Management & Data Fetching:** Zustand (useDatabaseStore), Optimistic UI Updates, SWR.
- **Data Processing:** xlsx, exceljs, papaparse (untuk keperluan import/export data Excel dan CSV secara massal).

## 2. Directory & Module Mapping
Struktur direktori aplikasi menggunakan pola standar Next.js App Router dengan pemisahan komponen dan utilitas yang jelas:

- **src/app/**: Berisi seluruh routing dan halaman aplikasi. Modul utama meliputi:
  - **campaigns/**: Modul paling kompleks. Menangani manajemen kampanye per ID ([id]), termasuk listing kreator, pelacakan video, live stream, keuangan (batch pembayaran), dan performa (GMV).
  - **creator-pool/**: Database master kreator, berfungsi untuk menambahkan atau mengimpor data kreator secara massal.
  - **udgeting/ & invoice/**: Modul keuangan untuk memantau pengeluaran, pengajuan pembayaran, dan workflow persetujuan (approval). Modul ini menggunakan RPC khusus (pc_get_payment_batches) untuk efisiensi beban query.
  - **ds-report/ & input-penjualan/**: Modul analitik dan pelaporan data iklan serta konversi organik. Telah dioptimasi dengan pembagian *chunking* pengiriman data (100-200 baris per batch).
  - **manajemen-akun/ & uth/ & login/**: Modul autentikasi dan otorisasi berbasis Role (Admin, Manager, Executive, dll).
  - **rand-portal/ & portal/**: Akses eksternal atau dashboard khusus untuk klien/brand melihat ringkasan kampanye.
- **src/components/**: Komponen UI yang reusable (menggunakan Radix UI), modul sinkronisasi (*SyncModal.tsx), dan layout (Sidebar, GlobalCommandCenter).
- **src/store/**: Global state management menggunakan Zustand (useDatabaseStore.ts).
- **src/utils/**: Helper functions, integrasi Supabase (client.ts, server.ts), dan formatter.
- **src/types/**: Definisi tipe TypeScript (database.ts yang di-generate dari Supabase schema).
- **supabase/migrations/**: Berisi seluruh file SQL untuk migrasi database, fungsi RPC, dan trigger (sangat krusial untuk logika backend).
- **scripts/**: Kumpulan skrip-skrip operasional eksternal atau *maintenance* .js, .ts, .py, dll (yang sebelumnya berceceran di root).

## 3. Core Data Flow & State Management
- **Client-Server Communication:** Sebagian besar data dimanipulasi melalui Server Actions di folder ctions/ (contoh: paymentActions.ts, ideoActions.ts).
- **Optimistic UI & Real-Time Sync (Baru diimplementasi):** 
  - Karena pemanggilan outer.refresh() di Next.js App Router tidak menyegarkan state dalam useEffect, sistem kini dimigrasi untuk menggunakan **Optimistic UI Updates**.
  - **Listing (ListingClient):** Aksi perbaruan kolom (GMV, Followers, Approval) menggunakan sistem *Auto-Save/Pending Changes* yang secara instan merubah UI ke *amber-text* sementara menunggu *batch save* otomatis 2 detik, sehingga halaman tidak patah/memuat ulang (F5).
  - **Keuangan (BatchDetail & CampaignKeuanganContent):** Penghapusan/pengeditan Batch memicu injeksi fungsi onRefreshList() yang otomatis me-render ulang list data tanpa reload halaman.
  - **Performa (PerformaClient):** Mengganti outer.refresh() menjadi panggilan re-kalkulasi lokal via etchData() demi *responsiveness* tabel total GMV.
- **Global State:** Dikelola oleh **Zustand** (useDatabaseStore.ts).
- **Vercel & Supabase Free Tier Optimization:** 
  - **Batch Processing Flow:** Data Excel dikirim dengan metode *chunking* (misal: 100 baris) per pemanggilan fungsi, menghindari error *Payload Too Large*.
  - **Database Aggregation:** Query *Join* bersarang 4 tingkat seperti pada etchCommandCenterBatches() ditangani penuh oleh PostgreSQL Server melalui fungsi **RPC (jsonb_agg)**, menyelesaikan masalah *504 Gateway Timeout* di Vercel Serverless.

## 4. Critical Dependencies & Hotspots
Berdasarkan analisis *God Nodes* dari Graphify, berikut adalah modul dan file yang menjadi pusat ketergantungan tertinggi (Hotspots):
1. **@supabase/supabase-js & createClient()** (176+ edges): Titik pusat interaksi database.
2. **eact** (86 edges): Dependency inti UI.
3. **xlsx** (69 edges): Digunakan luas di fitur Import Kreator, Ads Report, dan ekspor.
4. **useDatabaseStore** (63 edges): Pusat manajemen state global di sisi klien.
5. **lucide-react & cn()** (62 & 27 edges): Inti dari sistem desain (Tailwind merge utils).
6. **useAuth()**: Mengontrol akses, role-based access control (RBAC), dan proteksi rute.

## 5. Technical Debt Status (Resolved & Monitored)
- **[RESOLVED] Client State Stagnation (Non-Reactive UI):** Isu di mana user harus menekan tombol F5 untuk melihat perubahan (setelah *Delete* atau *Update*) telah terselesaikan dengan perombakan arsitektur pembaruan berbasis *Optimistic UI* dan sinkronisasi useEffect secara dinamis.
- **[RESOLVED] Server Action Bottlenecks:** Risiko *timeout* akibat query masif di Vercel telah direduksi dengan migrasi ke Supabase RPC (pc_get_payment_batches).
- **[RESOLVED] Scattered Scripts & False Dangling Edges:** Ratusan file script telah dipindah ke folder scripts/. Hasil evaluasi graphify membuktikan dangling edges turun drastis, dan aplikasi dalam kondisi *codebase health* yang optimal.
- **[MONITORED] Isolated Nodes (Unused Code):** Meskipun jumlahnya sudah ditekan dari 690 ke 4 (hanya skrip operasional), sistem akan terus dipantau jika sewaktu-waktu terdapat penumpukan fungsi-fungsi UI usang.
