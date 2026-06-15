# Rencana Migrasi Data TNT — Spreadsheet → Supabase

Dokumen ini untuk dipakai **nanti**, setelah web app jadi (minimal Fase 1–2 selesai & tabel Supabase sudah ada). Migrasi tidak bisa dilakukan sebelum struktur tabel tujuan ada. Pakai bersama `TNT_Full_Spec.md` (skema tabel) dan Prompt 3 di `TNT_Vibe_Coding_Prompts.md`.

## Keputusan yang sudah diambil
- **Cakupan:** SEMUA campaign, termasuk yang sudah selesai/lama. Migrasi penuh sekaligus.
- **Histori penjualan:** TIDAK memindahkan baris mentah RAW_organic dulu. Ambil GMV per creator yang SUDAH jadi (kolom Video & Livestream di tab brand Listing) sebagai angka ringkasan/warisan.
- **Konsekuensi:** campaign lama → GMV "beku" (tidak bisa drill per-video). Campaign baru di app → GMV dihitung penuh dari upload (sampai per-video). Histori = ringkasan; ke depan = detail. (Histori organik mentah bisa diimpor menyusul bila perlu.)

## File sumber (hanya INTERNAL — eksternal TIDAK perlu)
Sheet eksternal per brand tidak dimigrasi: isinya cuma cerminan IMPORTRANGE dari internal. Migrasi internal sudah meng-cover semua.
1. `Database/Listing TNT` — creator + status + GMV per creator (tab per brand)
2. `TNT Project Tracking` — campaign (Maindata), SKU, ringkasan performa
3. `TNT Campaign Budgeting` — pembayaran creator & top-up ads (tab per brand)

## Prinsip urutan: INDUK dulu, ANAK kemudian
Data harus masuk sesuai relasi (foreign key). Bila terbalik, gagal karena FK menunjuk record yang belum ada. Urutan wajib:

```
1. brands          (paling induk)
2. niches          (seed: makeup, skincare, home living, lifestyle)
3. creators        (DEDUP — langkah tersulit, lihat di bawah)
4. campaigns       (dari Maindata)
5. skus            (dari tab SKU)
6. campaign_creators (kaitkan creator↔campaign + price, approval, qty_vt, tier)
7. creator_niches  (niche per creator + peringkat)
8. videos          (dari link video tiap creator)
9. creator_payments (dari Budgeting blok kiri)
10. ads_spends     (dari Budgeting blok kanan)
11. creator_addresses (bila alamat mau ikut; sumber: sheet eksternal Creator Address)
12. (opsional, nanti) sales — histori organik mentah
```

## Langkah per tabel

### 1. brands
Daftar 14 brand (dari nama-nama tab). Insert manual/script sederhana. Catat mapping nama→id untuk langkah berikut.

### 2. niches
Seed 4 niche awal. Nanti staf tambah sendiri lewat app.

### 3. creators — DEDUP (langkah paling kritikal)
Masalah: di spreadsheet, creator yang sama (username sama) muncul di BANYAK tab brand, masing-masing dengan baris sendiri. Di app harus jadi SATU record creator.

Proses:
- Kumpulkan semua baris creator dari semua tab brand di Listing.
- Kelompokkan berdasarkan `username` (normalkan dulu: hapus spasi, lowercase, buang "@").
- Untuk tiap username unik → 1 record di `creators`: ambil nama_asli, link_account, rekening bila ada.
- Data yang berubah (followers, level, gmv_30d) → masukkan sebagai 1 baris `creator_snapshots` dengan tanggal = tanggal migrasi.
- Nomor WA → 1 baris `creator_contacts` status `aktif`, tanggal_mulai = tanggal migrasi.
- Simpan mapping username→creator_id (dipakai langkah 6).
- Bila satu creator punya data beda antar-tab (mis. followers beda): pakai yang paling baru / paling lengkap, atau yang dari tab campaign terbaru.

### 4. campaigns
Dari `Maindata`: brand_id (via mapping langkah 1), tanggal, budget plafon, PIC, assist, status (aktif/selesai berdasar end_date). Catat mapping nama campaign→id.
- **Tentukan tipe_campaign tiap campaign:** `sales` (target GMV, mis. OMG) atau `awareness` (target volume video/creator, mis. KIMME dengan ribuan baris). Bila ragu: campaign dengan target rupiah besar & creator sedikit = sales; campaign dengan creator sangat banyak & fokus jumlah video = awareness.
- **Isi target sesuai tipe:** sales → target_gmv (dari kolom Target di Maindata). awareness → target_video (dan target_creator bila ada). Target yang tidak relevan biarkan NULL.
- Catatan: di spreadsheet lama semua campaign pakai kolom "Target" yang sama (berisi GMV). Untuk campaign awareness, nilai itu mungkin bukan target sebenarnya — perlu cek manual / tanya tim saat migrasi mana yang awareness & berapa target volumenya.

### 5. skus
Dari tab `SKU`: campaign_id (mapping langkah 4), nama produk, product_id, komisi, link.

### 6. campaign_creators (inti)
Untuk tiap baris creator di tiap tab brand Listing → 1 record:
- campaign_id (mapping langkah 4) + creator_id (mapping langkah 3)
- price, qty_vt, tier, approval (normalkan ke enum: Approved/Pending/Alternate/Not Approved), pic_assist, notes, sample_progress
- **GMV warisan:** isi `gmv_organic_legacy` & `gmv_ads_legacy` dari kolom Video & Livestream/ads di Listing (lihat kolom baru di spec).

### 7. creator_niches
Bila niche sudah ada di data lama, petakan + peringkat. Bila belum, lewati (staf isi di app).

### 8. videos
Dari kolom Link Video 1–4 (+ Concept) tiap creator → 1 record per video yang ada linknya. Ekstrak content_uid dari link bila link lengkap; bila link pendek, kosongkan dulu (di-resolve nanti).

### 9–10. creator_payments & ads_spends
Dari file Budgeting per tab brand:
- Kiri → creator_payments: rate_card, pelunasan, status_bayar (normalkan: No Payment/Not Yet/Half Paid/Pay Off), tgl. Kaitkan ke campaign_creator yang cocok (campaign+creator).
- Kanan → ads_spends: nominal top-up, status, tanggal.

### 11. creator_addresses (opsional)
Bila alamat lama mau ikut: sumbernya sheet eksternal `Creator Address`. Kaitkan ke campaign_creator. Gabung tab kembar/cancel via is_cancel.

## Cara teknis
1. Export tiap tab Sheets → CSV (File → Download → CSV, per tab). Atau xlsx lalu baca per-sheet.
2. Tulis script (Python pandas / Node) yang: baca CSV → bersihkan → insert ke Supabase via API/SQL sesuai urutan di atas.
3. Pembersihan wajib: trim trailing space, normalkan format tanggal, normalkan enum (status/approval), buang baris kosong & baris non-data (mis. baris "Total", header ganda).
4. Brand besar (KIMME, PWS, ~2000+ baris): proses per-batch agar tidak timeout.
5. **Laporkan baris yang gagal + alasannya** — jangan diam-diam dilewati. Simpan log.

## Checklist sebelum & sesudah
Sebelum:
- [ ] App & tabel Supabase sudah ada (Fase 1–2 selesai)
- [ ] Backup spreadsheet asli (jangan diutak-atik selama migrasi)
- [ ] Export semua tab internal ke CSV

Sesudah (validasi):
- [ ] Jumlah creator unik di app = jumlah username unik di spreadsheet
- [ ] Jumlah campaign cocok
- [ ] Tiap campaign tipe-nya benar (sales/awareness) & target sesuai (KIMME dkk = awareness/video)
- [ ] Spot-check 5–10 creator: GMV warisan, price, status sesuai aslinya
- [ ] Total budget per campaign cocok dengan rekap Budgeting lama
- [ ] Tidak ada creator dobel (cek dedup berhasil)

## Catatan penting
- Migrasi sebaiknya dijalankan SEKALI ke database produksi, setelah dites dulu di database percobaan.
- Jalankan paralel dengan spreadsheet sebentar setelah migrasi — bandingkan, baru tinggalkan spreadsheet setelah yakin.
- Histori organik mentah (RAW_organic dari awal–akhir) bisa diimpor menyusul sebagai batch terpisah ke tabel `sales` bila nanti perlu drill per-video untuk campaign lama.
