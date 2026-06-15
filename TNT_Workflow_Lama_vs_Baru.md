# Flow Kerja Tim TNT — Spreadsheet (Lama) vs Web App (Baru)

Dokumen ini menjelaskan alur kerja tim campaign end-to-end, dengan contoh satu brand: **OMG Skincare** (tipe sales). Disusun untuk dua tujuan: (1) konteks "kenapa" bagi AI coding, (2) onboarding tim agar paham apa yang berubah. Untuk campaign awareness (mis. KIMME), alurnya identik kecuali ukuran pencapaian (lihat catatan di akhir).

Pendamping `TNT_Full_Spec.md`. Flow ini menjelaskan PROSES; spec menjelaskan STRUKTUR.

---

## BAGIAN 1 — FLOW LAMA (Spreadsheet)

Cara tim bekerja sekarang dengan 6 spreadsheet. Ditulis agar terlihat di mana titik-titik repot & rawan errornya — itulah yang web app selesaikan.

### Tahap per tahap (spreadsheet)

1. **Setup campaign** — PIC buka file `Project Tracking`, tambah baris di tab `Maindata`: nama brand, tanggal, target GMV, budget, PIC. Countdown jalan via rumus.

2. **Sourcing** — tim cari creator di TikTok (scrolling, eksplorasi).

3. **Approach WhatsApp** — chat creator, tawar barter dulu; kalau menolak, nego rate card. Hasil: creator mau/tidak, harga, kesediaan kirim alamat.

4. **Input ke Listing** — creator yang mau dimasukkan ke `Database/Listing`, tab brand OMG: ketik username, link, no WA, followers, level (lihat manual di Partner Center), price, qty video, dll. Kolom `Type` (nano/micro/dst) diketik manual.

5. **Approval** — manager isi kolom `Approval` (dropdown: Approved/Pending/Alternate/Not Approved). Harus dropdown — kalau ada typo/spasi, rumus QUERY ke tab lain mati.

6. **Kirim sampel** — alamat (dari WA) diketik ke sheet eksternal tab `Creator Address`. Isi resi + status. Brand lihat lewat IMPORTRANGE.

7. **Produksi video** — konsep diketik per slot (Concept 1-4), creator bikin video, manager approve via kolom VT/Approve.

8. **Posting** — link video ditempel ke kolom Link Video 1-4 di Listing.

9. **Input penjualan organik (TITIK PALING REPOT):**
   a. Export data organik dari TikTok Partner Center (file ~45 kolom).
   b. **Bikin pivot table** manual untuk kelompokkan penjualan per creator.
   c. **Cari nama creator** satu per satu di hasil pivot.
   d. **Ketik manual** angka GMV tiap creator ke kolom di Listing / Daily Performance.

10. **Input penjualan ads** — export dari TikTok Ads (USD), ketik manual angka VSA per tanggal ke `Daily Performance`.

11. **GMV terhitung** — rumus `SUMIFS` jumlahkan per creator; `Daily Performance` rekap harian; naik ke `Maindata` jadi Achievement & Percentage.

12. **Budgeting** — file `Campaign Budgeting` tab OMG: ketik rate card, status bayar, top-up ads. Rekap sisa via SUMIFS.

13. **Brand monitoring** — sheet eksternal OMG menampilkan performa & alamat via IMPORTRANGE terfilter.

14. **Closing** — rekap final di Maindata saat campaign selesai.

### Masalah flow lama
- **Pivot + ketik manual** (tahap 9) makan waktu & rawan salah ketik.
- **Duplikasi**: data creator sama diketik ulang di tiap tab brand (14 brand × banyak file).
- **Rumus rapuh**: 1 typo/trailing-space mematikan QUERY → data tidak mengalir.
- **Freeze**: file besar (KIMME 2800+ baris) lambat/hang.
- **`__xludf.DUMMY` & #REF**: IMPORTRANGE putus → data hilang dari tampilan.
- **Dua "GMV" rancu**: GMV creator 30hari vs GMV penjualan campaign sama-sama bernama "GMV".
- **Tidak ada track record**: creator dipakai ulang tapi histori performanya tercecer di banyak tab.

---

## BAGIAN 2 — FLOW BARU (Web App)

Cara kerja yang sama, tapi dengan app. Tahap 1-8 tetap kerja manusia (chat, keputusan, kreatif — tak bisa diotomasi). Yang berubah drastis: tahap 9-11 (penjualan & GMV).

### Tahap per tahap (web app)

1. **Setup campaign** — PIC buka menu Campaign → buat baru. Pilih **tipe** (sales/awareness). Sales OMG → isi target GMV, budget, tanggal, PIC. Countdown otomatis.

2. **Sourcing** — sama: cari di TikTok. Bonus: cek dulu di **Creator Pool** — mungkin creator sudah pernah dipakai, tinggal lihat track record-nya.

3. **Approach WhatsApp** — sama: tawar barter / nego rate card.

4. **Input ke Listing** — creator yang setuju ditambah ke campaign. Kalau creator baru → buat record di pool (username, link, WA, level, followers, niche). Kalau sudah ada → tarik dari pool, refresh datanya. `Type` (nano/micro/dst) **otomatis** dari followers — tidak diketik.

5. **Approval** — manager set status via dropdown. Yang Approved otomatis tampil di view internal & portal brand. Tidak ada rumus yang bisa "mati".

6. **Kirim sampel** — alamat diketik di modul Sampel; username & no WA sudah otomatis terisi dari data creator. Brand lihat di portal (terfilter otomatis, mustahil bocor ke brand lain).

7. **Produksi video** — konsep & VT dinamis sesuai jumlah yang disepakati (bukan terbatas 4 slot). Manager approve tiap VT.

8. **Posting** — tempel link **lengkap**. App ekstrak Content UID otomatis dari link → siap dicocokkan ke penjualan.

9. **Input penjualan organik (SEKARANG MUDAH):**
   - **Upload** file export Partner Center apa adanya. Selesai.
   - App otomatis: hitung GMV (Price×Qty), kecualikan refund, cocokkan UID → GMV per-video, username → per-creator.
   - TIDAK ADA pivot, TIDAK ADA cari nama, TIDAK ADA ketik satu-satu.

10. **Input penjualan ads:**
    - **Upload** file export TikTok Ads + isi kurs USD→IDR hari itu.
    - **Gerbang konfirmasi**: nama iklan dicocokkan ke creator; yang tidak cocok dipetakan manual sekali (lalu diingat).
    - App: Gross revenue → achievement (USD→IDR), Cost → budget ads.

11. **GMV & dashboard otomatis** — begitu upload, semua update sendiri: GMV per video/creator, achievement, %, daily performance, sisa budget, ROAS per creator. Tanpa sentuhan.

12. **Budgeting** — modul Budgeting: status bayar (No Payment/Not Yet/Half Paid/Pay Off), pembayaran ±2 mgg pasca posting. Sisa budget hitung otomatis.

13. **Brand monitoring** — portal brand terpisah, login sendiri, hanya lihat data OMG (performa, alamat, jadwal live). Filter otomatis.

14. **Closing** — rekap final di dashboard. Data tersimpan jadi track record creator untuk campaign berikutnya.

### Yang diselesaikan app
- Pivot + ketik manual → **hilang**, ganti upload.
- Duplikasi creator → **hilang**, satu record dipakai lintas campaign.
- Rumus rapuh & freeze & `__xludf.DUMMY` → **hilang**, database tidak begitu.
- Dua GMV rancu → **dipisah tegas** (gmv_30d estimasi vs campaign_gmv aktual).
- Track record → **otomatis** dari riwayat kerjasama.
- Bonus baru: GMV per-video, ROAS ads per-creator, tren data creator.

---

## RINGKASAN: APA YANG BERUBAH untuk TIM

| Tahap | Lama (spreadsheet) | Baru (app) |
|---|---|---|
| Sourcing | mulai dari nol tiap kali | cek pool dulu, ada track record |
| Type creator | ketik manual | otomatis dari followers |
| Approval | dropdown, rawan rumus mati | dropdown, tanpa rumus |
| Input penjualan | export→pivot→cari→ketik | upload, selesai |
| GMV | SUMIFS manual + rawan | otomatis, sampai per-video |
| Ads (USD) | ketik manual | upload + kurs, auto konversi |
| Budget sisa | SUMIFS, sel rekap manual | otomatis |
| Brand lihat data | IMPORTRANGE (bisa bocor) | portal terfilter (mustahil bocor) |
| Track record creator | tercecer antar tab | otomatis terkumpul |

**Inti:** app tidak mengurangi kerja MENGUMPULKAN data (chat WA, download export — tetap manual). App menghilangkan kerja MENGOLAH & MEMINDAHKAN data (pivot, cari, ketik ulang, jumlahkan, rekap). Itu bagian membosankan & rawan salah yang pindah ke mesin.

---

## CATATAN: CAMPAIGN AWARENESS (mis. KIMME)

Flow identik tahap 1-14, KECUALI:
- Tahap 1: pilih tipe **awareness**, target = jumlah video (selalu) &/atau jumlah creator.
- Tahap 11: achievement dihitung dari jumlah video tayang & creator approved, BUKAN GMV. GMV tetap dihitung & tampil sebagai info tambahan, tapi bukan ukuran sukses.
- Volume besar (ribuan creator) → app pakai pagination/virtual scroll; di spreadsheet inilah yang bikin freeze.
