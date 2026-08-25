# MyDuitApp — Ringkasan Proyek & Keputusan Desain

> Dokumen rencana resmi. Semua keputusan final hasil konsultasi 2026-08-26.
> Lokasi pengerjaan: folder ini. Repo: https://github.com/DavidTimoteus/PWA-MyDuit.git
> App lama (GAS): arsip/referensi di `..\..\Google Apps Script\MyDuit` — tidak disentuh lagi.

## Tujuan
Aplikasi catatan keuangan PRIBADI (satu pengguna). Berjalan sebagai PWA yang bisa
di-install di Android & PC, dan HARUS bisa diakses offline.

## Keputusan Final
- **Bentuk**: PWA (bukan APK/EXE) — satu codebase web.
- **Stack frontend**: React + Vite + Tailwind CSS v4 + vite-plugin-pwa (Workbox).
- **Backend data**: Firebase — Auth (Google Sign-In), Firestore (offline persistence),
  Hosting (gratis, HTTPS otomatis).
- **Backend AI**: Cloudflare Workers (proxy ke Gemini/OpenRouter) — gratis tanpa kartu,
  key aman di Worker secrets. Firebase Cloud Functions DIBATALKAN (wajib kartu kredit).
- **Bahasa UI**: Indonesia, format Rupiah (integer).

## Scope Fitur v1 (DISETUJUI)
1. Login Google + profil nama/avatar
2. Transaksi: catat/edit/hapus/salin (tanggal, kategori, akun, catatan)
3. Riwayat + filter (hari/minggu/bulan/tahun/rentang/jenis/kata kunci) + pagination cursor
4. Rekening multi-akun + saldo real-time + riwayat perubahan saldo
5. Pindah saldo antar akun
6. Budget limit per kategori per periode
7. Utang & cicilan: CRUD, bayar cicilan, lunasin
8. Statistik: grafik bulan/tahun (Chart.js), tren 12 bulan, breakdown kategori
9. Offline penuh + tombol Install App (sidebar & mobile) + splash screen
10. Export backup JSON/CSV

**Keluar dari v1 → v1.x**: OCR struk AI, Rekomendasi AI, Laporan PDF.

## Keputusan Teknis Kunci
- Konflik sinkronisasi: Last-Write-Wins (Firestore bawaan) — cukup untuk 1 user.
- Struktur data: subcollection per user → `users/{uid}/{transaksi|akun|kategori|utang|
  pembayaranUtang|budget}/{id}`.
- **Tanggal disimpan sebagai string `'YYYY-MM-DD'`** (granularitas hari, anti-bug timezone
  — pelajaran dari era GAS). `createdAt` tetap `serverTimestamp`; saat render offline pakai
  `{ serverTimestamps: 'estimate' }`.
- **Nominal = integer rupiah** (tanpa desimal).
- Saldo akun = field tersimpan, di-update via `runTransaction` (bukan derive dari semua
  transaksi). Riwayat perubahan saldo = log ringan per mutasi (pengganti MutasiLog GAS).
- Penghapusan record = soft-delete (`deleted: true`) agar tersinkron ke semua device.
- Offline cache: `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`
  (aman multi-tab). Tidak perlu Dexie/RxDB/sync manual.
- Composite index didefinisikan di `firestore.indexes.json` sesuai kebutuhan tiap fitur.
- ID dokumen: pertahankan format lama `PREFIX-yyyyMMdd-HEX4` untuk data hasil migrasi;
  data baru bebas pakai auto-ID Firestore.
- Security Rules dasar:
  ```
  match /users/{uid}/{document=**} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
  ```
- Config Firebase di frontend = publik by design; keamanan dijaga Rules (+ App Check opsional).

## Backend AI — Cloudflare Workers
- Satu endpoint Worker: menerima request dari PWA → panggil Gemini/OpenRouter → JSON balik.
- API key di Worker secrets (`wrangler secret put ...`); CORS dikunci hanya ke domain
  Firebase Hosting; shared-secret token anti-penyusup.
- Foto struk dikirim sebagai body mentah (bukan JSON besar) — hemat batas CPU free tier
  (10 ms/invocation; waktu tunggu jaringan tidak dihitung).
- Port logika `ai-model.gs`: multi-key round-robin, multi-provider, deteksi model,
  pembersih markdown JSON. Fitur AI dipasang di Fase 6 setelah core stabil.

## Konteks Migrasi (dari Google Apps Script)
- Jalur: Sheets → bersihkan format → export CSV → import sekali-jalan via script Node.js
  (firebase-admin) → collection staging → verifikasi (jumlah baris + Σ pemasukan/pengeluaran
  per bulan cocok dengan Sheets) → pindah ke `users/{uid}/...` (email GAS lama → uid Firebase).
- CSV mentah diarsipkan sebagai backup permanen.
- Logika bisnis `.gs` (V8 JS): mayoritas copy-paste; ganti SpreadsheetApp → Firestore SDK,
  ubah callback menjadi async/await.

## Batasan yang Diketahui
- Login Google pertama kali wajib online (sekali saja; sesi tersimpan).
- iOS Safari: risiko cache dibersihkan jika PWA jarang dipakai (Android/PC aman).
- Workers free: 100.000 req/hari (lebih dari cukup untuk personal).

## Roadmap
| Fase | Isi | Status |
|---|---|---|
| 0 | Scaffold Vite+PWA, git, rules/indexes, ikon, setup Firebase project | BERJALAN |
| 1 | Login Google + shell UI (claymorphism hijau) + nav | - |
| 2 | Data layer offline-first: transaksi CRUD + tombol Install App | - |
| 3 | Rekening, Budget, Utang/Cicilan (bayar/lunasin) | - |
| 4 | Statistik Chart.js + filter/pencarian | - |
| 5 | Migrasi data Sheets → Firestore | - |
| 6 | Cloudflare Worker AI (OCR struk + rekomendasi) + integrasi | - |
| 7 | Polish: splash, toast, export backup, deploy produksi | - |

## Kebijakan Kerja
- Commit message bahasa Indonesia, singkat, WAJIB konfirmasi sebelum commit/push.
- Deploy frontend: `firebase deploy --only hosting`. Deploy AI: `wrangler deploy`.
- `.env.local`, `node_modules/`, `dist/` tidak masuk git.
