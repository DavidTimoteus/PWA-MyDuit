# MyDuit PWA 💵

> Progressive Web App (PWA) pencatatan keuangan pribadi modern dengan arsitektur **offline-first**, sinkronisasi cloud real-time, dan desain antarmuka **Claymorphism**.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-cyan.svg)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-v12-amber.svg)](https://firebase.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-purple.svg)](https://web.dev/progressive-web-apps/)

---

## 🌟 Fitur Utama

- **Offline-First Architecture**: Tetap dapat mencatat transaksi, mengelola anggaran, dan melihat mutasi rekening tanpa koneksi internet. Data tersimpan di persistent local cache Firestore dan otomatis tersinkronisasi saat kembali online.
- **Claymorphism Aesthetic Design**: Antarmuka lembut, modern, dan ergonomis dengan sistem token desain terpadu, squircle border radius, dan kedalaman bayangan yang nyaman di mata.
- **Multi-Rekening & Transfer**: Manajemen banyak kantong/dompet (tunai, bank, e-wallet) dengan kalkulasi saldo atomik dan riwayat perubahan mutasi lengkap.
- **Pencatatan Transaksi Cepat & OCR Struk**: Input pemasukan/pengeluaran mudah dilengkapi pembacaan struk belanja otomatis berbasis Tesseract OCR.
- **Budgeting & Target Keuangan**: Perencanaan paginasi anggaran bulanan per kategori dengan indikator visual persentase pemakaian.
- **Manajemen Utang & Cicilan**: Pelacakan piutang dan pinjaman berkala dengan perhitungan jatuh tempo angsuran bulanan yang presisi.
- **Statistik & Laporan Keuangan**: Analisis visual arus kas menggunakan Chart.js serta dukungan ekspor laporan ke format PDF dan Excel (.xlsx).
- **Instalasi PWA Penuh**: Dapat diinstal di Android, iOS, Windows, dan macOS dengan Service Worker background sync dan manifest mandiri.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) + Custom Clay Tokens
- **Database & Auth**: [Firebase Firestore](https://firebase.google.com/) (Persistent Local Cache & Multi-Tab Manager) + Firebase Authentication
- **Visualisasi & Ekspor**: [Chart.js](https://www.chartjs.org/), [jsPDF](https://github.com/parallax/jsPDF), [SheetJS](https://sheetjs.com/)
- **PWA Tooling**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) + Workbox

---

## 🚀 Memulai (Quick Start)

### 1. Prasyarat
- Node.js versi 18+ atau 20+
- NPM atau PNPM

### 2. Kloning Repositori
```bash
git clone https://github.com/DavidTimoteus/PWA-MyDuit.git
cd PWA-MyDuit
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Konfigurasi Lingkungan
Buat file `.env` di direktori root dengan konfigurasi proyek Firebase Anda:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 5. Menjalankan Server Pengembangan
```bash
npm run dev
```

### 6. Build Produksi
```bash
npm run build
```

---

## 🧪 Pengujian & Verifikasi Kualitas

Repositori ini dilengkapi dengan serangkaian pengujian terotomatisasi untuk menjamin integritas offline-first dan kontrak komponen:

```bash
# Jalankan seluruh rangkaian pengujian & build check
npm run check

# Uji kontrak event bus
npm run test:events

# Uji integritas token dan kelas CSS
npm run test:classes

# Uji logika mutasi saldo dan riwayat
npm run test:riwayat

# Uji parser OCR struk
npm run test:ocr

# Uji kontrak offline sync Firestore
npm run test:offline
```

---

## 📄 Lisensi

Proyek ini didistribusikan di bawah lisensi **MIT License**. Lihat berkas [LICENSE](LICENSE) untuk informasi lebih lanjut.
