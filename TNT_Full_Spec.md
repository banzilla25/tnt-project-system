# TNT Campaign Management — Full Specification

Dokumen ini adalah spesifikasi lengkap untuk membangun web app manajemen campaign TikTok affiliate, menggantikan sistem 6 spreadsheet (Database/Listing, Project Tracking, Campaign Budgeting, + sheet eksternal per brand). Ditulis untuk dipakai sebagai konteks AI coding (Claude Code, Cursor, v0, dll).

## Konteks bisnis singkat

TNT adalah agency yang menjalankan campaign affiliate TikTok untuk ~14 brand. Alur: sourcing creator dari TikTok → approach via WhatsApp (tawar barter dulu, atau rate card) → creator yang setuju masuk listing → manager approve → kirim sampel → creator produksi video (jumlah sesuai nego) → manager approve tiap video → posting → penjualan masuk (organik dari TikTok Partner Center, ads dari tim ads) → GMV dihitung → pembayaran creator (±2 minggu pasca posting) → brand memantau lewat view terbatas.

## Prinsip desain

1. **Tidak ada duplikasi data.** Di spreadsheet, 1 brand = 1 tab yang berulang di 4 file. Di sini, brand = 1 baris; semua data menggantung lewat relasi.
2. **Kolom turunan dihitung, bukan diketik.** Tiap SUMIFS/QUERY/IMPORTRANGE jadi query/computed value otomatis.
3. **Creator = aset perusahaan.** Satu creator dipakai lintas campaign, dengan riwayat data & track record.
4. **Tidak ada hak akses berlapis.** Semua staf internal punya akses penuh (ini tool tim project, bukan finance). Brand punya view terbatas via portal terpisah.
5. **Input manual tetap manual** (chat WA, export Partner Center) — app merapikan & menjaga, bukan mengotomasi sumber.

---

# BAGIAN A — SKEMA DATABASE

Tipe data memakai konvensi umum (PostgreSQL-style). `serial` = auto-increment PK. `bigint` untuk nominal rupiah (hindari masalah pecahan float). `timestamptz` untuk audit.

## Tabel: brands
Master brand/klien.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| nama | text | no | "OMG Skincare", "Wardah", dll |
| status | text | no | enum: `aktif`, `arsip`. Default `aktif` |
| created_at | timestamptz | no | default now() |

## Tabel: campaigns
Menggantikan tab `Maindata`. Satu baris = satu campaign brand.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| brand_id | int FK→brands | no | |
| nama | text | no | nama campaign (biasanya = nama brand) |
| tipe_campaign | text | no | enum: `sales`, `awareness`. Menentukan target & cara hitung achievement |
| persiapan_14hari | text | yes | "05 - 25 Januari" (free text periode persiapan) |
| start_date | date | no | |
| end_date | date | no | |
| target_gmv | bigint | yes | target GMV (rupiah). Diisi untuk tipe `sales`. Untuk `awareness`: NULL (GMV tetap dihitung tapi tidak ditarget) |
| target_video | int | yes | target jumlah video. Diisi untuk `awareness` (selalu), opsional untuk sales |
| target_creator | int | yes | target jumlah creator. Diisi untuk sebagian `awareness` |
| budget_creator_plafon | bigint | no | plafon budget rate card |
| budget_ads_plafon | bigint | no | plafon budget ads |
| vsa_gmv_max | bigint | yes | target/nilai VSA GMV MAX |
| pic | text | yes | nama PIC |
| assist | text | yes | nama assist |
| file_concept_url | text | yes | link dokumen konsep |
| status | text | no | enum: `aktif`, `selesai`. Default `aktif` |
| created_at | timestamptz | no | |

**Computed (tidak disimpan, dihitung saat query):**
- `countdown` = end_date − hari ini (dalam hari)
- **achievement & percentage tergantung tipe_campaign:**
  - tipe `sales`: achievement = total GMV (lihat B1); percentage = achievement / target_gmv
  - tipe `awareness`: achievement = jumlah video tayang (videos dgn link) [+ jumlah creator approved bila target_creator diisi]; percentage = video_tayang / target_video (dan/atau creator_approved / target_creator). GMV TETAP dihitung & ditampilkan sebagai info, tapi BUKAN ukuran pencapaian.
- `gmv_total` = total GMV (selalu dihitung untuk semua tipe; di awareness hanya info)
- `jumlah_creator_approved` = COUNT(campaign_creators WHERE approval='approved')
- `jumlah_video_tayang` = COUNT(videos WHERE link_video terisi) untuk campaign ini
- `budget_creator_terpakai` = SUM(creator_payments.pelunasan) untuk campaign ini
- `budget_creator_sisa` = budget_creator_plafon − budget_creator_terpakai
- `budget_ads_terpakai` = SUM(ads_spends.nominal WHERE status_bayar='pay_off')
- `budget_ads_sisa` = budget_ads_plafon − budget_ads_terpakai

## Tabel: creators
Master creator (aset, dipakai lintas campaign). Hanya data yang relatif tetap.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| username | text | no | username TikTok, unik. Index unik |
| nama_asli | text | yes | nama asli (untuk pembayaran/kontrak) |
| link_account | text | yes | URL profil TikTok |
| rekening | text | yes | rekening/e-wallet (edit-timpa, tidak diarsip) |
| created_at | timestamptz | no | |

**Computed:**
- snapshot terbaru (followers/level/gmv_30d) → dari `creator_snapshots` ORDER BY tanggal DESC LIMIT 1
- kontak WA aktif → dari `creator_contacts` WHERE status='aktif'
- type (nano/micro/macro/mega) → dihitung dari followers snapshot terbaru (aturan B2)
- track record → agregasi dari `campaign_creators` (aturan B3)

## Tabel: creator_snapshots
Riwayat data yang berubah dari waktu ke waktu. Satu baris per pembaruan (dari Partner Center / profil). Tidak ditimpa — bertambah.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| creator_id | int FK→creators | no | |
| tanggal_update | date | no | kapan data ini diambil |
| followers | int | yes | |
| level | int | yes | level akun TikTok (0–8) |
| gmv_30d | bigint | yes | GMV creator 30 hari (ESTIMASI; sering disembunyikan creator, bisa "1jt+") |
| created_at | timestamptz | no | |

## Tabel: creator_contacts
Nomor WA dengan arsip. Saat ganti nomor: baris lama → status `arsip` + isi tanggal_diganti, baris baru → status `aktif`.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| creator_id | int FK→creators | no | |
| nomor | text | no | nomor WhatsApp |
| status | text | no | enum: `aktif`, `arsip` |
| tanggal_mulai | date | no | sejak kapan nomor ini dipakai |
| tanggal_diganti | date | yes | diisi saat jadi arsip |

Aturan: hanya boleh ada 1 baris `aktif` per creator (enforce di aplikasi).

## Tabel: niches
Daftar kategori/niche. Bisa ditambah staf kapan saja.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| nama | text | no | unik. Seed awal: "makeup", "skincare", "home living", "lifestyle" |

## Tabel: creator_niches
Jembatan many-to-many creator↔niche, dengan peringkat (niche paling menonjol = peringkat 1).

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| creator_id | int FK→creators | no | |
| niche_id | int FK→niches | no | |
| peringkat | int | no | 1 = paling menonjol, 2, 3... |

PK gabungan: (creator_id, niche_id).

## Tabel: creator_notes
Catatan evaluasi bertanggal, bertumpuk (tidak ditimpa). Memori kolektif tim untuk keputusan "pakai lagi atau tidak".

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| creator_id | int FK→creators | no | |
| isi | text | no | catatan |
| penulis | text | no | nama staf yang menulis |
| created_at | timestamptz | no | tanggal catatan |

## Tabel: campaign_creators
TABEL INTI. Satu baris = satu kerjasama (creator × campaign). Menggantikan baris creator di tab brand Listing.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| campaign_id | int FK→campaigns | no | |
| creator_id | int FK→creators | no | |
| tier | text | yes | tier internal creator untuk campaign ini |
| price | bigint | no | rate card. 0 = barter. Bisa di-nego ulang (lihat audit) |
| qty_vt | int | no | jumlah video disepakati (hasil nego; 1, 4, 10+, dst) |
| approval | text | no | enum: `pending`, `approved`, `alternate`, `not_approved`. Default `pending` |
| pic_assist | text | yes | PIC/assist untuk creator ini |
| notes_manager | text | yes | catatan manager (spesifik kerjasama ini) |
| notes_pic | text | yes | catatan PIC |
| sample_progress | text | yes | status proses sampel (free text/enum sesuai kebutuhan) |
| gmv_organic_legacy | bigint | yes | GMV organik WARISAN dari migrasi spreadsheet (campaign lama). NULL untuk campaign baru |
| gmv_ads_legacy | bigint | yes | GMV ads WARISAN dari migrasi. NULL untuk campaign baru |
| created_at | timestamptz | no | |

**Computed:**
- `jenis_kerjasama` = (price = 0) ? "barter" : "ratecard"
- `campaign_gmv` = SUM(sales.gmv) WHERE creator & campaign cocok, refund dikecualikan (aturan B1).
- **Tampilan GMV final** = jika ada data sales → pakai campaign_gmv (dihitung); jika tidak (campaign lama hasil migrasi) → pakai gmv_organic_legacy + gmv_ads_legacy. Jadi campaign lama tampil angka warisan, campaign baru tampil angka hidup.

Index: (campaign_id), (creator_id).

## Tabel: videos
Menggantikan slot Concept/Link Video 1–4 + VT/Approval. Jumlah dinamis sesuai qty_vt.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| campaign_creator_id | int FK→campaign_creators | no | |
| urutan | int | no | 1, 2, 3... |
| concept | text | yes | konsep video |
| link_video | text | yes | URL video (paste link LENGKAP, mis. tiktok.com/@user/video/123...). Untuk diklik/dilihat |
| content_uid | text | yes | **diekstrak OTOMATIS dari link_video** (angka setelah /video/). Jembatan ke sales.content_uid → GMV per-video |
| vt_approval | text | no | enum: `pending`, `approved`, `reject`. Approval oleh MANAGER. Default `pending` |
| created_at | timestamptz | no | |

**Computed:**
- `video_gmv` = SUM(sales.price) WHERE sales.content_uid = videos.content_uid AND refund=false. Ini GMV per-video (hanya organik; ads tidak punya content_uid).

**Catatan link:** tim paste link lengkap (dari address bar). Jika link pendek (`vt.tiktok.com/...`), buka dulu di browser → copy link lengkap yang muncul → paste. App ekstrak `content_uid` (angka 19-digit setelah `/video/`) otomatis. UID ini = `Content ID` di export Partner Center, sehingga pencocokan GMV per-video otomatis.

## Tabel: skus
Menggantikan tab `SKU`. Master produk per campaign.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| campaign_id | int FK→campaigns | no | |
| link_gmv_max | text | yes | Link GMV MAX/VSA |
| nama_produk | text | no | |
| product_id | text | no | Product ID TikTok Shop (dipakai match dgn sales) |
| satuan_bundle | text | yes | "Satuan" / "Bundle" |
| link_tap | text | yes | Link TAP affiliate |
| commission | numeric | yes | persentase komisi |

Index: (product_id) untuk matching cepat dengan sales.

## Tabel: sales
Menggantikan `RAW_organic`. Hanya penjualan ORGANIK (export Partner Center). GMV ads ada di tabel `ads_performance` terpisah (struktur & mata uang beda). Dasar perhitungan GMV organik & per-video.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| campaign_id | int FK→campaigns | no | campaign mana penjualan ini dihitung |
| creator_username | text | yes | dari export kolom "Creator Username" (match ke creators.username) |
| content_uid | text | yes | dari export kolom "Content ID". Match ke videos.content_uid → GMV per-video |
| sku_id | int FK→skus | yes | match via product_id |
| product_id | text | yes | dari export "Product ID" |
| tanggal | date | no | dari export "Time Created" |
| price | bigint | no | dari export "Price" (harga satuan) |
| quantity | int | yes | dari export "Quantity" |
| gmv | bigint | no | **price × quantity** = nilai penjualan kotor (GMV baris ini) |
| is_refund | bool | no | dari export "Fully returned or refunded" (Yes→true). **Baris refund DIKECUALIKAN dari semua perhitungan GMV** |
| content_type | text | yes | "Video" / "Livestream" |
| order_id | text | yes | dari export "Order ID". Untuk dedup |
| order_status | text | yes | |
| raw_data | jsonb | yes | simpan kolom export lain (sisa dari 45 kolom) untuk audit, opsional |
| created_at | timestamptz | no | |

**GMV definisi final:** `gmv = price × quantity`, sumber kolom Price (= Est. base commission; keduanya nilai penjualan kotor). BUKAN "Est. affiliate partner commission" (itu komisi 2%, jauh lebih kecil). Refund (is_refund=true) selalu dikecualikan.

Index: (campaign_id), (creator_username), (content_uid), (sku_id), (tanggal), (content_type).
Dedup: unique constraint pada (order_id) untuk cegah dobel-import.

## Tabel: ads_performance
BARU. Menggantikan input VSA/ads manual. Data dari export TikTok Ads (per-iklan, mata uang USD). Beda dari sales: ada Cost (belanja iklan) DAN Gross revenue (GMV). Tidak punya Content ID → hanya bisa per-creator, bukan per-video.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| campaign_id | int FK→campaigns | no | |
| ad_name | text | no | dari export "Ad name" (mis. `nris9_1`, `Ara`) |
| creator_id | int FK→creators | yes | hasil pemetaan ad_name→creator (lihat gerbang import C5) |
| tanggal | date | yes | periode/tanggal data |
| cost_usd | numeric | no | dari export "Cost" (belanja iklan, USD) |
| gross_revenue_usd | numeric | no | dari export "Gross revenue (Shop)" (GMV ads, USD) |
| purchases | int | yes | dari export "Purchases (Shop)" |
| kurs | numeric | no | kurs USD→IDR saat import (input MANUAL oleh staf) |
| created_at | timestamptz | no | |

**Computed:**
- `cost_idr` = cost_usd × kurs → masuk budget ads terpakai (ads_spends, atau dijumlah langsung)
- `gross_revenue_idr` = gross_revenue_usd × kurs → menambah achievement campaign (GMV ads)
- `roas` = gross_revenue_usd / cost_usd (sudah ada di export, bisa dihitung ulang)

**Penting:** `cost` → BUDGET (mengurangi sisa budget ads). `gross_revenue` → ACHIEVEMENT (menambah GMV). Dua arah berlawanan — jangan tertukar. Simpan USD asli + kurs; IDR selalu hasil hitung (kurs beda tiap hari).

Index: (campaign_id), (creator_id).

## Tabel: creator_payments
Menggantikan blok kiri tab Budgeting (pembayaran creator).

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| campaign_creator_id | int FK→campaign_creators | no | |
| rate_card | bigint | no | total yang disepakati |
| pelunasan | bigint | no | yang sudah dibayar (default 0) |
| status_bayar | text | no | enum: `no_payment`, `not_yet`, `half_paid`, `pay_off` |
| tgl_pembayaran | date | yes | |
| created_at | timestamptz | no | |

**Computed:** `sisa_utang` = rate_card − pelunasan.
Arti status: `no_payment`=barter/price 0; `not_yet`=ada utang belum dibayar (normal sampai ±2mg pasca posting); `half_paid`=DP; `pay_off`=lunas.

## Tabel: ads_spends
Menggantikan blok kanan tab Budgeting (top-up ads). Buku kas paralel.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| campaign_id | int FK→campaigns | no | |
| detail | text | yes | "Top up ads" |
| nominal | bigint | no | |
| status_bayar | text | no | enum sama: `no_payment`,`not_yet`,`half_paid`,`pay_off` |
| tanggal | date | yes | |
| created_at | timestamptz | no | |

## Tabel: creator_addresses
Menggantikan tab `Creator Address` (eksternal). Tab kembar/cancel digabung via is_cancel.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| campaign_creator_id | int FK→campaign_creators | no | |
| nama_penerima | text | yes | |
| nama_jalan | text | yes | alamat lengkap |
| provinsi | text | yes | |
| kabupaten_kota | text | yes | |
| kecamatan | text | yes | |
| kelurahan | text | yes | |
| kode_pos | text | yes | |
| proses | text | yes | status pengiriman |
| tanggal_kirim | date | yes | |
| resi | text | yes | nomor resi |
| notes | text | yes | |
| is_cancel | bool | no | default false (menggantikan tab "...cancel") |

Catatan: product & no_whatsapp TIDAK disimpan di sini — diambil otomatis dari campaign (via SKU) dan creator (kontak aktif).

## Tabel: live_schedules
Menggantikan tab `Live`/`live Payday` (eksternal). Report jadwal live agar brand tahu.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| campaign_creator_id | int FK→campaign_creators | no | |
| tanggal_live | date | no | |

## Tabel: audit_logs
Jejak perubahan pada field sensitif (price, approval, status bayar). Diisi otomatis oleh aplikasi, bukan manual.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| id | serial PK | no | |
| tabel | text | no | nama tabel yg diubah |
| record_id | int | no | id baris yg diubah |
| field | text | no | nama kolom |
| nilai_lama | text | yes | |
| nilai_baru | text | yes | |
| diubah_oleh | text | no | nama staf |
| created_at | timestamptz | no | |

Trigger pencatatan minimal untuk: campaign_creators.price, campaign_creators.approval, videos.vt_approval, creator_payments.status_bayar + pelunasan, ads_spends.status_bayar.

---

# BAGIAN B — ATURAN BISNIS (menggantikan rumus)

### B1. Perhitungan GMV (menggantikan SUMIFS)
GMV = nilai penjualan KOTOR. Selalu kecualikan refund.
- **GMV per video** = SUM(sales.gmv) WHERE content_uid cocok AND is_refund=false. (hanya organik)
- **campaign_gmv per creator (organik)** = SUM(sales.gmv) WHERE campaign_id=X AND creator_username=creator AND is_refund=false. Bisa dipisah content_type Video vs Livestream.
- **GMV ads per creator** = SUM(ads_performance.gross_revenue_idr) WHERE creator cocok.
- **achievement campaign** = GMV organik + GMV ads (IDR). Pisahkan tampilan: Organic (Video), Organic (Livestream), Ads.
- `gmv = price × quantity` (organik). Ads pakai gross_revenue (USD→IDR via kurs). JANGAN pakai kolom komisi.
- `Cost` ads BUKAN GMV — itu budget (lihat B5).

### B2. Klasifikasi Type (otomatis dari followers)
Berdasar followers snapshot terbaru:
- Nano: 1.000–9.999
- Micro: 10.000–99.999
- Macro: 100.000–999.999
- Mega: ≥ 1.000.000

### B3. Track record creator (menggantikan kebutuhan lihat lintas tab)
Untuk profil creator, agregasi semua campaign_creators miliknya:
- daftar: nama campaign, jenis_kerjasama, price, campaign_gmv, approval
- highlight: campaign dengan GMV tertinggi
Tujuan: staf menilai "pernah nembus gede di campaign mana" sebelum pakai lagi.

### B4. Status pembayaran & countdown
- Pembayaran creator umumnya jatuh tempo ±2 minggu setelah video posting (tergantung finance). `not_yet` adalah kondisi normal selama masa ini, bukan error.
- countdown campaign = end_date − today; tampilkan menonjol bila ≤ N hari.

### B5. Sisa budget (menggantikan rekap manual Budgeting)
- creator: plafon − SUM(creator_payments.pelunasan)
- ads: plafon − [SUM(ads_spends.nominal pay_off) + SUM(ads_performance.cost_idr)]
Hitung real-time; tidak ada sel rekap manual. Catatan: cost ads bisa datang dari dua sumber — top-up manual (ads_spends) dan/atau belanja per-iklan dari export (ads_performance.cost). Tentukan saat coding mana yang dipakai agar tidak dobel-hitung.

### B6. ROAS ads per-creator
Per creator dalam campaign: SUM(gross_revenue_usd) / SUM(cost_usd). Tampilkan untuk menilai iklan creator mana paling worth di-boost ulang.

### B7. Tipe campaign (sales vs awareness)
Dua tipe, memengaruhi target & cara hitung achievement:
- **sales** (mis. OMG): target = GMV rupiah. Achievement = total GMV. Fokus dashboard: pencapaian rupiah & %.
- **awareness** (mis. KIMME, bisa ribuan creator): target = jumlah video (selalu) dan/atau jumlah creator (sebagian campaign). Achievement = video tayang & creator approved. GMV TETAP dihitung & ditampilkan sebagai info tambahan, tapi tidak ditarget & bukan ukuran sukses.
- Saat buat campaign, staf pilih tipe → form target menyesuaikan (sales minta target_gmv; awareness minta target_video [+ target_creator opsional]).
- GMV per creator/video dihitung sama untuk kedua tipe (logika B1 tidak berubah) — yang beda hanya apa yang dijadikan ukuran pencapaian.

---

# BAGIAN C — MODUL & PERILAKU UI

### C1. Dashboard (Maindata)
Tabel semua campaign aktif: nama, countdown, target, achievement, %, sisa budget creator, sisa budget ads, PIC. Baris bisa diklik → detail campaign. Indikator visual untuk countdown menipis & % pencapaian.

### C2. Creator Pool (fitur baru — inti "creator sebagai aset")
- Pencarian & filter: niche (multi), level, range followers, type, "pernah dipakai di brand X".
- Tiap hasil tampilkan kartu: username, nama asli, snapshot terbaru + tanggalnya, niche berperingkat, ringkas track record (jumlah campaign, GMV tertinggi).
- Klik → profil lengkap: snapshot history (tren followers/level/gmv_30d), kontak WA aktif + arsip, rekening, semua niche, track record per campaign, timeline creator_notes.
- Aksi: tambah snapshot baru (refresh data), ganti nomor WA (auto-arsip nomor lama), tambah note, edit niche/peringkat, "tarik ke campaign" (buat campaign_creators baru).

### C3. Listing / Seleksi (per campaign)
Menggantikan tab brand Listing. Tabel campaign_creators untuk satu campaign:
- kolom: creator (username+type), tier, price, qty_vt, approval (dropdown), sample_progress, campaign_gmv (computed), notes.
- approval & price dropdown/inline-edit; perubahan masuk audit_log.
- expand baris → daftar videos (concept, link, vt_approval) sebanyak qty_vt.

### C4. Video approval
Daftar video per creator; manager set vt_approval (pending/approved/reject). Gate: idealnya tandai bila link_video diisi tapi vt_approval belum approved.

### C5. Input penjualan (Sales & Ads) — upload langsung, TANPA pivot manual
Menggantikan alur lama (export → pivot → cari nama → ketik satu-satu). Sekarang: upload file mentah → app yang olah.

**Import ORGANIK:**
- Upload file export Partner Center (xlsx/csv, ~45 kolom) apa adanya.
- App baca kolom: Creator Username, Content ID, Product ID, Price, Quantity, Content Type, Time Created, Order ID, Fully returned or refunded.
- Hitung gmv = price×quantity. Set is_refund dari kolom refund. Dedup via order_id.
- Cocokkan content_uid ke videos → GMV per-video otomatis. Cocokkan username ke creators, product_id ke skus.
- Setelah import: GMV per-video, per-creator, achievement, daily performance, % — semua update otomatis.

**Import ADS (dengan GERBANG KONFIRMASI):**
- Upload file export TikTok Ads + **input kurs USD→IDR hari itu** (manual).
- App baca: Ad name, Cost, Gross revenue (Shop), Purchases. Buang baris non-iklan (mis. "Total of N results").
- App tampilkan layar konfirmasi SEBELUM commit, memilah 3 kategori:
  - ✅ ad_name cocok otomatis ke username creator (mis. `nris9_1`→`nris9`) → lanjut
  - ⚠️ ad_name tidak cocok (mis. `Ara`, `vern`) → staf WAJIB petakan ke creator via dropdown. Tombol import disabled sampai semua beres.
  - 🗑️ baris sampah → ditandai buang
- App INGAT pemetaan (simpan ad_name→creator) agar import berikutnya otomatis.
- Setelah commit: gross_revenue→achievement, cost→budget ads, ROAS per-creator dihitung.

**Catatan beda organik vs ads:** organik bisa sampai GMV per-VIDEO (punya Content ID). Ads hanya per-CREATOR (tidak punya Content ID; 1 iklan = 1 creator, bukan 1 video pasti).

### C6. Budgeting
Dua sub-tab per campaign:
- Creator payment: tabel campaign_creators + rate_card, pelunasan, status_bayar, tgl. Rekap: plafon/terpakai/sisa otomatis.
- Ads: daftar top-up (nominal, status, tanggal). Rekap ads otomatis.

### C7. SKU
CRUD produk per campaign.

### C8. Portal Brand (view terbatas — terpisah dari internal)
Brand login → hanya lihat campaign miliknya:
- Update Daily Performance: target vs organic (video) vs organic (live) vs ads.
- Creator Address: alamat + resi + proses (untuk kirim sampel) — hanya creator approved.
- Live schedule.
Filter brand_id otomatis di setiap query; tidak ada cara brand melihat data brand lain (menggantikan IMPORTRANGE terfilter).

---

# BAGIAN D — NON-FUNGSIONAL

- **Autosave / draft:** form panjang (profil creator, listing) auto-save draft lokal agar input tidak hilang bila koneksi putus.
- **Error handling jelas:** bila simpan gagal, tampilkan pesan spesifik + jangan buang input user. Tim datang dari spreadsheet yang "selalu ada", jadi kegagalan diam-diam akan merusak kepercayaan.
- **Export ke Excel/PDF:** tiap tabel utama bisa di-export (mengurangi resistensi pindah dari Sheets; rasa aman "data bisa dipegang").
- **Audit otomatis** pada field sensitif (Bagian A: audit_logs).
- **Tanpa hak akses berlapis** di internal (keputusan: semua staf akses penuh; data finance ada di sistem lain). Portal brand tetap terpisah & terfilter.
- **Volume:** brand KIMME & PWS jauh lebih besar (~2000+ baris) — pastikan pagination/virtual scroll pada tabel besar.

---

# BAGIAN D2 — RINGKASAN: INPUT MANUAL vs OTOMATIS
Acuan cepat. Yang manual = sumbernya manusia (chat WA, keputusan, profil). Yang otomatis = turunan/hitungan.

**MANUAL (diketik tim):**
- Sourcing: username, link akun, followers, level, niche
- Hasil nego WA: price/rate card, qty_vt, barter/bayar
- Keputusan manager: approval creator, vt_approval tiap video
- Konsep tiap video; link video (paste link LENGKAP)
- Alamat creator (dari WA) + resi + sample progress
- Catatan evaluasi creator (bertanggal); rekening; nama asli
- Status & tanggal pembayaran (finance)
- Setup campaign: target, budget, tanggal, PIC
- SKU: nama produk, product ID, komisi
- Jadwal live; kurs USD (sekali per import ads)
- Pemetaan ad_name→creator yang tidak cocok otomatis (sekali, lalu diingat)

**UPLOAD (bukan ketik):**
- Penjualan organik: upload file export Partner Center
- Penjualan ads: upload file export TikTok Ads (+ kurs)

**OTOMATIS (dihitung, TIDAK diketik):**
- GMV per video, per creator, achievement, % pencapaian
- Daily performance (rekap harian)
- Sisa budget creator & ads; ROAS per creator
- Type creator (dari followers); content_uid (dari link)
- Pencocokan penjualan↔creator↔video↔SKU

# BAGIAN E — REKOMENDASI BERTAHAP (jangan rilis sekaligus)

1. Fase 1: Creator Pool + Listing/Seleksi (modul paling sering disentuh tim). Jalankan paralel dengan spreadsheet sebentar.
2. Fase 2: Sales import + Dashboard + GMV otomatis.
3. Fase 3: Budgeting.
4. Fase 4: Portal Brand.
5. Tunda integrasi API TikTok — input manual/paste dulu; otomatisasi hanya bila terbukti perlu.

---

# BAGIAN F — PEDOMAN UI/UX

Tujuan: app dipakai tim yang selama ini biasa spreadsheet. Harus terasa lebih ringan, bukan lebih rumit. Prinsip utama: **tampilkan hanya yang sedang dikerjakan; sembunyikan sisanya sampai dibutuhkan (progressive disclosure).**

## F1. Prinsip dasar (berlaku semua layar)
- **Satu layar = satu pekerjaan.** Layar Listing untuk seleksi creator; layar Performa untuk lihat angka. Jangan gabung banyak tujuan dalam satu layar.
- **Angka penting di atas, detail di bawah.** Ringkasan (achievement, %, sisa hari) sebagai kartu di atas; tabel rinci di bawah.
- **Sembunyikan aksi sampai dibutuhkan.** Tombol edit/hapus/detail muncul saat hover/klik baris, bukan selalu tampil. Layar utama tetap bersih.
- **Warna untuk status, bukan hiasan.** Konsisten se-app: hijau=approved/lunas/aman, kuning=pending/menunggu, merah=ditolak/lewat tempo, abu=netral. Orang harus bisa "baca" status sekilas.
- **Bahasa Indonesia, istilah yang tim sudah kenal.** Pakai kata dari spreadsheet lama (Listing, VT, ACC, Approval, GMV) — jangan ganti dengan istilah teknis baru.
- **Jangan ada layar kosong tanpa arah.** Saat data belum ada, tampilkan empty state: ikon + 1 kalimat + tombol aksi (mis. "Belum ada creator. + Tambah creator").

## F2. Struktur navigasi
**App internal — sidebar kiri, 6 menu saja:**
1. Dashboard — ringkasan semua campaign (countdown, achievement, %, sisa budget)
2. Creator Pool — database creator, pencarian, profil
3. Campaign — daftar campaign; klik satu → masuk detail bertab
4. Input Penjualan — upload organik & ads
5. Budgeting — pembayaran creator & ads
6. Pengaturan — niche, brand, dll

**Di dalam satu Campaign (tab horizontal, bukan menu baru):**
Listing & Seleksi · Video & VT · Performa · Sampel & Alamat · SKU
→ Ini kunci anti-ramai: 11 tabel tidak pernah tampil sekaligus. Staf pilih campaign dulu, baru lihat tab kerjanya.

**Portal brand — terpisah total, login sendiri, maksimal 3 menu:** Performa harian · Alamat creator · Jadwal live. Tidak ada menu internal yang bocor ke sini.

## F3. Pola per layar
- **Dashboard:** grid kartu campaign. Tiap kartu: nama brand, **badge tipe (Sales/Awareness)**, countdown (warna memerah bila ≤ N hari), bar % pencapaian, sisa budget. Klik → detail campaign.
  - Kartu campaign **sales**: tampilkan GMV vs target_gmv + %.
  - Kartu campaign **awareness**: tampilkan video tayang vs target_video (dan creator approved vs target_creator bila ada) + %; GMV ditampilkan kecil sebagai info, bukan ukuran utama.
- **Creator Pool:** bar pencarian + filter (niche, level, range followers, type, "pernah di brand X") di atas; hasil sebagai daftar/kartu. Klik creator → profil: snapshot terbaru + tren, kontak WA aktif (+ riwayat saat diklik), niche, track record per campaign, timeline catatan. Aksi (refresh data, tambah note, tarik ke campaign) sebagai tombol di profil, tidak berserakan.
- **Listing:** kartu ringkas (achievement/target/jumlah approved) di atas; pencarian+filter status; tabel creator (username+type, tier, price, status dropdown, GMV). Klik baris → expand detail video/VT. Status & price inline-edit (perubahan → audit otomatis).
- **Video & VT:** per creator, daftar VT sebanyak qty_vt. Tiap VT: konsep, link, status approval manager (dropdown), GMV per-video (computed). Tandai bila link sudah diisi tapi VT belum di-approve.
- **Input Penjualan:** area upload jelas (drag/pilih file). Organik: upload → ringkasan hasil ("142 baris masuk, 3 refund dikecualikan"). Ads: upload + isian kurs → **layar konfirmasi** (cocok/perlu dipetakan/buang) sebelum commit. Jangan commit diam-diam; selalu tampilkan ringkasan sebelum & sesudah.
- **Budgeting:** dua sub-tab (Creator / Ads). Rekap plafon-terpakai-sisa sebagai kartu di atas; daftar rinci di bawah. Status bayar berwarna.

## F4. Aturan khusus (karena tim dari spreadsheet)
- **Inline edit ala spreadsheet:** sebisa mungkin edit langsung di sel tabel (klik → ketik → simpan otomatis), bukan selalu buka form modal. Ini mengurangi rasa asing.
- **Dropdown wajib** untuk field berstatus (approval, status bayar, tier, niche). Ini menggantikan validasi spreadsheet — tidak ada lagi typo/trailing-space yang dulu mematikan QUERY.
- **Konfirmasi sebelum aksi merusak** (hapus, ubah massal): dialog singkat "yakin?".
- **Autosave + indikator tersimpan** ("Tersimpan ✓") supaya tim percaya datanya aman tanpa tombol Save (seperti Google Sheets).
- **Tombol Export ke Excel** di tiap tabel utama — beri rasa aman "data tetap bisa dipegang".
- **Loading & error jelas:** saat memuat tampilkan skeleton/spinner; saat gagal tampilkan pesan spesifik + input tidak hilang.

## F5. Catatan implementasi visual
- Desktop-first (tim kerja di laptop); tapi portal brand & lihat-cepat sebaiknya responsif di HP.
- Tabel besar (KIMME/PWS ~2000 baris): pagination atau virtual scroll, jangan render semua sekaligus.
- Konsisten: satu komponen tabel, satu komponen kartu, satu set warna status dipakai ulang di semua layar.
- Mulai dari Fase 1 (Listing + Creator Pool), uji ke tim, iterasi dari masukan nyata — jangan rancang semua layar sekaligus.

# CATATAN TERBUKA (perlu keputusan saat coding)
- Enum nilai `sample_progress` & `proses` (saat ini free text di spreadsheet — bisa dibiarkan free text dulu, distandarkan jadi dropdown setelah lihat pola pemakaian).
