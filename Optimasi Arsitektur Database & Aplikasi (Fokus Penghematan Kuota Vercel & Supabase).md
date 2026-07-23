# Optimasi Arsitektur Database & Aplikasi (Fokus Penghematan Kuota Vercel & Supabase)

Tujuan utama dari optimasi ini adalah menyelamatkan batas kuota gratis pada Vercel (*CPU Time*) dan Supabase (*Bandwidth/Egress*), yang saat ini kondisinya sangat kritis (nyaris jebol limit maksimal). 

> [!NOTE]
> **Keputusan Bapak (Review):**
> - **Materialized Views:** DI-SKIP (Bapak memilih untuk tetap memakai *Real-Time* menggunakan RPC yang mana sudah super cepat).
> - **Partisi Tabel:** DI-SKIP (Karena ukuran tabel `sales` saat ini masih 257MB, ini masih aman untuk dijalankan tanpa partisi, dan kita terhindar dari risiko merombak data *Live*).

---

## Proposed Changes (Rencana Eksekusi Bertahap)

Kita akan fokus pada migrasi logika penarikan data dari "Tarik Semua lalu Hitung" (Client-Side) menjadi "Hitung Langsung di Database" (RPC / Server-Side).

### TAHAP 1: Membasmi *Looping* di Halaman Performa (Prioritas Darurat)

**Apa masalah yang diselesaikan?**
Saat ini, ketika Klien atau Tim membuka Halaman Performa, sistem akan memaksa Vercel untuk mengunduh puluhan ribu data mentah `sales` dan `organic_videos` milik ratusan kreator hanya untuk dijumlahkan secara manual menggunakan kode `while(true)`.
**Mengapa ini buruk?**
Ini sangat boros *Bandwidth* (menyebabkan jebolnya limit 2 GB Supabase Egress) dan membuat CPU Vercel menyala terlalu lama (Limit 4 jam hampir habis). Tampilan *dashboard* juga akan terasa lambat (bisa sampai 10 detik).
**Bagaimana solusinya?**
Kita membuat fungsi (RPC) di PostgreSQL bernama `get_campaign_creator_performance`. Fungsi ini akan ditanam di *database*, sehingga *database* sendirilah yang akan melakukan penjumlahan/rekap (hanya butuh sekian milidetik). Vercel cukup memanggil fungsi ini dan menerima 1 set hasil akhir berukuran sangat kecil (KB).

#### [NEW] `db_rpc_creator_performance.sql`
- Membuat fungsi `get_campaign_creator_performance(p_campaign_id)`.
- **Dampak:** *Query* 1000x lebih instan dibanding dijumlahkan pakai Javascript.

#### [MODIFY] `src/app/campaigns/[id]/performa/PerformaClient.tsx` & `performaActions.ts`
- Menghapus semua blok `while(true)`.
- Menggantinya dengan panggilan `supabase.rpc('get_campaign_creator_performance')`.
- **Dampak:** Halaman terbuka seketika (*0 loading* dari sisi penjumlahan) dan hemat kuota jutaan persen.

---

### TAHAP 2: Membasmi *Looping* di Halaman Video & Daily

**Apa masalah yang diselesaikan?**
Sama seperti Halaman Performa, halaman Video dan Halaman Daily (Harian) juga menggunakan struktur `while(true)` untuk memuat semua histori `sales` dan *likes/views* dari awal sampai akhir, padahal hanya butuh angka totalnya saja.
**Mengapa ini buruk?**
Bayangkan ada 500 video di satu *campaign*, dan masing-masing video punya ratusan transaksi `sales`. Vercel harus memuat puluhan ribu baris itu secara berulang-ulang setiap harinya.
**Bagaimana solusinya?**
Kita pecah beban ini dengan membuat 2 RPC tambahan. Satu khusus untuk merangkum total *likes/views/gmv* per video, dan satu lagi khusus untuk menjumlahkan GMV per hari.

#### [NEW] `db_rpc_video_stats.sql`
- Fungsi `get_campaign_video_stats` untuk mengagregasi performa tiap-tiap video tunggal (*Views*, *Likes*, *GMV*).

#### [MODIFY] `src/app/campaigns/[id]/video/VideoClient.tsx` & `videoActions.ts`
- Memangkas *fetch* berulang dan menanamkan pemanggilan RPC.

#### [NEW] `db_rpc_daily_stats.sql`
- Fungsi `get_campaign_daily_stats` untuk mendapatkan *Total GMV*, *Order*, *Views*, dan *Likes* berdasarkan Tanggal (dikelompokkan per hari).

#### [MODIFY] `src/app/campaigns/[id]/daily/DailyClient.tsx` & `dailyActions.ts`
- Menghapus perulangan panjang `hasMore` dan mengganti ke RPC yang langsung jadi.
- **Dampak:** Grafik performa harian akan muncul seketika tanpa jeda.

---

### TAHAP 3: Optimasi Ekstrem di Portal Brand (Brand Client)

**Apa masalah yang diselesaikan?**
Halaman Portal adalah halaman yang diberikan kepada Eksternal (Brand). Saat ini, sistem menarik seluruh baris *sales* ke Vercel API untuk dirangkum dan ditampilkan. 
**Mengapa ini buruk?**
Klien biasanya tidak sabar. Jika data sudah menyentuh 5.000 *sales*, *fetching* ini membutuhkan waktu lebih dari 10 detik. Hal ini memicu batas waktu maksimal *Serverless* Vercel Gratis, yang mengakibatkan munculnya *error* putih bertuliskan **504 Gateway Timeout** di layar klien Bapak.
**Bagaimana solusinya?**
Seluruh *logic* rekapitulasi data dipindah ke *database* via RPC, Vercel hanya bertugas merender UI-nya saja.

#### [MODIFY] `src/app/portal/actions/portalActions.ts`
- Menghapus metode lama yang memakai `range()`.
- Menggunakan RPC gabungan dari Tahap 1 dan Tahap 2 untuk disajikan ke Dashboard Portal.
- **Dampak:** Menyelamatkan reputasi Bapak di depan klien (*dashboard* cepat dan anti-*error* 504), serta menekan beban Vercel Edge Requests.

---

## Verification Plan

### Automated Tests
- Menjalankan kompilasi TypeScript (`npm run build`) untuk memastikan data yang diterima dari RPC (JSONB) sudah dibaca (*mapping*) dengan benar oleh *Frontend*.

### Manual Verification
1. **Pengecekan Kecepatan (Tab Network):** Setelah tahap pertama selesai, kita akan cek di Google Chrome seberapa kecil data yang kini ditarik sistem dibandingkan sebelumnya.
2. **Pengecekan Akurasi:** Membuka Halaman Performa dan mencocokkan apakah angka *Total GMV*, *Quantity*, *Views*, dan *Likes* tetap 100% akurat dan tidak meleset dibandingkan sistem lama.
3. **Pengecekan Portal:** Memastikan halaman *Portal Brand* bisa dibuka di *Incognito* tanpa menunggu lebih dari 2 detik.
