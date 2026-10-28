# PRD: MyDuit PWA (Personal Finance Management System)

> **Status:** Production-Ready & Living Document  
> **Target Platform:** Progressive Web App (PWA) Offline-First (Mobile & Desktop)  
> **Arsitektur:** React 19 + Vite 6 + Tailwind v4 + Firebase Firestore (Offline Persistence)

---

## 1. Visi Produk & Sasaran Utama
MyDuit adalah aplikasi pencatatan keuangan pribadi offline-first yang cepat, estetik, dan reliabel. Aplikasi dirancang untuk memberikan pengalaman setara aplikasi native dengan nuansa visual **Claymorphism** modern, navigasi 1-tangan yang ergonomis, serta sinkronisasi data instan tanpa khawatir kehilangan data saat kondisi jaringan buruk.

### Sasaran Kunci:
- **Zero-Latency Feel:** Seluruh input data (transaksi, pemindahan saldo, pelunasan utang) tersimpan seketika di cache lokal (IndexedDB) dan di-reconcile ke cloud secara background.
- **Reliabilitas Multi-Device:** Tampilan adaptif sempurna dari layar mobile sempit (320px–430px) hingga desktop multi-kolom (>=1024px) tanpa clipping, shape overload, atau scroll lockup.
- **Integritas Finansial 100%:** Menggunakan integer currency terkecil (Rupiah murni), balance tracking atomik via Firestore `increment()`, dan pencegahan race conditions.

---

## 2. Target Pengguna & Persona
1. **Pengguna Mobile On-the-Go (Utama):**
   - Mencatat pengeluaran harian langsung di kasir atau perjalanan via ponsel pintar (mis. POCO M6 Pro, iPhone).
   - Membutuhkan floating action button (FAB) di tengah bawah yang mudah dijangkau ibu jari.
2. **Pengguna Desktop / Laptop (Audit & Evaluasi):**
   - Melihat visualisasi statistik bulanan/tahunan, memantau riwayat saldo per rekening, dan mencetak laporan transaksi PDF berformat resmi.

---

## 3. Ruang Lingkup Fitur (Scope)

### A. Fitur Inti (Fase 1 - Active)
1. **Modul Transaksi:**
   - Pencatatan pemasukan, pengeluaran, dan pindah saldo antar-rekening.
   - Pindai struk belanja otomatis via Tesseract OCR terintegrasi.
   - Filter rentang waktu: Hari Ini, 7 Hari Terakhir, 30 Hari Terakhir, Kustom, dan Semua.
   - Ekspor laporan berformat PDF dan spreadsheet XLSX.
2. **Modul Budget & Rekening:**
   - Pengelompokan dompet/rekening (Kas, Bank, E-Wallet).
   - Pengecekan limit pengeluaran per kategori.
   - Detail riwayat perubahan saldo (*mutasi feed*) per rekening dengan pelacakan rantai saldo.
3. **Modul Utang & Piutang:**
   - Tracking utang, piutang, dan cicilan bertahap.
   - Pager kartu utang mobile yang hug-content dengan navigasi swipe/dot.
   - Modal pembayaran utang & cicilan otomatis memotong/menambah saldo rekening.
4. **Modul Statistik:**
   - Breakdown pengeluaran per kategori dengan diagram donat interaktif.
   - Tren arus kas bulanan dan komparasi periode.
5. **PWA & Offline-First Core:**
   - Service worker precaching untuk aset inti.
   - Cloud Firestore dengan `persistentLocalCache` & `multiTabManager`.
   - Deteksi status daring/luring instan dengan badge indikator.

### B. Roadmap Mendatang (Fase 2)
- Modul Investasi & Portofolio Aset.
- Multi-currency conversion dengan kurs real-time.
- Backup terenkripsi lokal end-to-end.

---

## 4. Kontrak Data & Standar Finansial
- **Currency:** Integer standar IDR (tidak menggunakan desimal pecahan untuk mencegah floating-point rounding error).
- **Formatters:** Menggunakan `Intl.NumberFormat('id-ID')`.
- **Soft Delete:** Dokumen transaksi dan akun menggunakan flag `deleted: false` untuk mempertahankan integritas audit trail.
- **Aturan Penulisan:** Wajib menggunakan server-generated ID atau batch Firestore; dilarang menggunakan `Date.now()` atau `Math.random()` pada jalur penulisan database.
