# Prompt untuk Vibe Coding — TNT Campaign App

Cara pakai: copy salah satu prompt di bawah, paste ke AI coding (Claude Code / Cursor / dll), dan **lampirkan file `TNT_Full_Spec.md`**.

═══════════════════════════════════════════════
## PROMPT 1 — PEMBUKA (pakai sekali, saat mulai proyek)
═══════════════════════════════════════════════

Saya melampirkan file `TNT_Full_Spec.md` — spesifikasi lengkap sebuah web app manajemen campaign TikTok affiliate yang akan menggantikan sistem spreadsheet kami. Baca seluruh dokumen ini dengan teliti sebelum menulis kode apa pun. Dokumen ini adalah satu-satunya sumber kebenaran (single source of truth) untuk proyek ini.

Aturan kerja yang WAJIB kamu ikuti:

1. JANGAN MENEBAK. Semua tabel, field, tipe data, enum, dan aturan bisnis sudah tertulis di spec. Kalau ada yang tidak jelas atau tampak bertentangan, BERHENTI dan tanya saya — jangan mengarang asumsi.

2. IKUTI SKEMA PERSIS. Nama tabel, nama kolom, tipe data, dan nilai enum harus sama persis seperti di Bagian A. Jangan menambah field "yang menurutmu berguna" tanpa bertanya. Jangan menghapus field.

3. BANGUN BERTAHAP. Jangan bangun semua modul sekaligus. Ikuti urutan fase di Bagian E. Kita mulai dari Fase 1 saja. Tunggu saya bilang "lanjut fase berikutnya".

4. KOLOM TURUNAN DIHITUNG, BUKAN DISIMPAN. Lihat "Computed" di tiap tabel dan Bagian B. Jangan simpan nilai turunan (GMV, achievement, sisa budget, type, countdown) sebagai kolom biasa — hitung saat query/render.

5. TANPA HAK AKSES BERLAPIS untuk staf internal (lihat Bagian D). Semua staf internal akses penuh. JANGAN tambahkan sistem role/permission internal. Portal brand (Bagian C8) terpisah dan terfilter per brand_id — itu satu-satunya pembatasan.

Sebelum menulis kode, lakukan ini dulu:
- Ringkas pemahamanmu soal proyek ini dalam 5-8 kalimat (entitas inti, alurnya, apa yang menggantikan rumus spreadsheet).
- Usulkan stack teknologi yang cocok, beri 2-3 opsi dengan kelebihan/kekurangan singkat. Tunggu saya pilih.
- Jangan menulis kode sampai saya konfirmasi pemahaman dan pilih stack.

Mulai sekarang: baca spec, lalu beri ringkasan pemahaman + usulan stack.

═══════════════════════════════════════════════
## PROMPT 2 — MULAI SEBUAH FASE (pakai berulang tiap fase)
═══════════════════════════════════════════════

Sekarang bangun **Fase [ISI: 1 / 2 / 3 / 4]** sesuai `TNT_Full_Spec.md` Bagian E.

Untuk fase ini:
- Implementasikan hanya tabel & modul yang relevan dengan fase ini. Lihat Bagian C (modul/UI) dan Bagian A (tabel) yang terkait.
- Patuhi semua aturan bisnis di Bagian B yang menyentuh fase ini.
- Sertakan autosave/draft dan error handling yang jelas (Bagian D) — input user tidak boleh hilang kalau simpan gagal.
- Untuk field sensitif (price, approval, vt_approval, status_bayar, pelunasan), catat perubahan ke audit_logs otomatis (Bagian A: tabel audit_logs).

Sebelum coding, beri saya:
1. Daftar tabel & file/komponen yang akan kamu buat di fase ini.
2. Hal apa pun dari spec yang masih ambigu untuk fase ini (kalau ada).

Tunggu konfirmasi saya, baru tulis kode.

═══════════════════════════════════════════════
## PROMPT 3 — MIGRASI DATA (nanti, setelah app jadi)
═══════════════════════════════════════════════

App sudah jalan. Sekarang saya mau migrasi data lama dari spreadsheet ke database app.

Saya akan melampirkan file CSV hasil export dari Google Sheets (per tab). Tugasmu: tulis script migrasi yang membaca CSV dan memasukkan ke tabel yang sesuai di `TNT_Full_Spec.md`.

Aturan:
- Petakan kolom CSV ke field tabel sesuai spec. Kalau ragu kolom mana ke field mana, tanya — jangan tebak.
- Bersihkan data: trailing space, format tanggal tidak konsisten, nilai kosong.
- Untuk creator yang muncul di banyak tab brand: jadikan SATU record di tabel creators, lalu buat campaign_creators terpisah per campaign (jangan duplikat creator).
- Tangani brand besar (KIMME, PWS, ~2000+ baris) dengan batch/chunk agar tidak timeout.
- Laporkan baris yang gagal diimpor + alasannya, jangan diam-diam dilewati.

Tunggu saya lampirkan CSV-nya dulu.

═══════════════════════════════════════════════
## TIPS PEMAKAIAN
═══════════════════════════════════════════════

- Selalu lampirkan `TNT_Full_Spec.md` di awal sesi baru. AI tidak ingat sesi sebelumnya — spec adalah memorinya.
- Kalau AI mulai "ngarang" field atau struktur yang tidak ada di spec, ingatkan: "ikuti spec, jangan menebak — kalau ragu tanya."
- Selesaikan & uji satu fase sebelum lanjut. Jangan tergoda minta semua sekaligus.
- Kalau ada perubahan kebutuhan, update `TNT_Full_Spec.md` dulu, baru minta AI ikut perubahan itu. Spec dan kode harus selalu sinkron.
- Simpan spec di dalam repo (mis. `/docs/spec.md`) agar selalu jadi rujukan.
