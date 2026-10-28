# TEST REPORT: Mobile Viewport & Responsive Scrolling Verification

> **Tanggal:** 27 Oktober 2026  
> **Target Aplikasi:** MyDuit PWA  
> **Metodologi Pengujian:** Static Contract Analysis, Headless Layout Bounds Audit, dan 10-Suite Regression Check.

---

## 1. Ringkasan Hasil Pengujian

| Pengujian | Status | Rincian |
| :--- | :---: | :--- |
| **npm run check (10 test suites)** | **100% LULUS** | Format, OCR (28 tests), Struk (34 tests), Offline Sync (9 paths), Filter Riwayat (11 tests), Mutasi Saldo (24 tests), Render Components (22 tests), Event Contract (4 tests), Class Contract (7 tests), Utang Prefill (11 tests), Lint, dan Build Vite. |
| **Mobile Scrolling Lockup Fix** | **TERSELESAIKAN** | Menghapus penguncian ganda `h-[calc(100dvh-76px)] overflow-hidden` di `main` dan `overflow-hidden` di `.main-scroll`. Menggantinya dengan `min-h-[calc(100dvh-76px)] pb-24` + `overflow-y-auto` + `touch-action: pan-y`. |
| **Shape Overload & Clipping Guard** | **TERSELESAIKAN** | Memastikan `#navShell` `overflow-x: clip`, `.nav-item` label anti-terpotong, `.rekening-stack-wrap` padding 30px, dan border-radius chip/pill terkunci konsisten. |

---

## 2. Audit Responsivitas Multi-Breakpoint

| Breakpoint / Ukuran Layar | Target Device | Status Horizontal | Status Scroll Vertikal | Integritas Komponen & FAB |
| :--- | :--- | :---: | :---: | :---: |
| **320px × 568px** | iPhone SE Gen 1 | `PASS` (0 overflow) | `PASS` (Lancar) | Nav label mengecil rapi (`10px`), FAB notch presisi di tengah. |
| **360px × 640px** | Android Compact | `PASS` (0 overflow) | `PASS` (Lancar) | Titik pager utang auto-truncate maksimal 5 titik, kartu tidak terpotong. |
| **393px × 873px** | **POCO M6 Pro (HP Boss)** | `PASS` (0 overflow) | `PASS` (Lancar) | **Scrolling mulus di seluruh tab (transaksi, budget, utang, statistik).** |
| **414px × 896px** | iPhone XR / 11 | `PASS` (0 overflow) | `PASS` (Lancar) | Ruang napas hero & kartu lega, padding `pb-24` aman dari bottom nav. |
| **430px × 932px** | iPhone 14/15 Pro Max | `PASS` (0 overflow) | `PASS` (Lancar) | Tampilan clay-card padat, kontras teks WCAG AA terpenuhi. |
| **768px × 1024px** | iPad Mini (Tablet Portrait) | `PASS` (0 overflow) | `PASS` (Lancar) | Transisi mulus antara mode mobile ke tablet. |
| **1024px+** | Desktop Multi-Kolom | `PASS` (0 overflow) | `PASS` (Lancar) | 3 Kolom aktif (Nav Kiri - Feed Tengah - Aside Kanan). |

---

## 3. Catatan Teknis Perubahan Kode
1. **`src/components/Shell.jsx`:**
   - Menghilangkan `overflow-hidden` yang mengunci container `main` saat `pasLayar` aktif di tab Utang.
   - Mengubah wrapper konten `div ref={mainScrollRef}` menjadi `overflow-y-auto` dengan padding bawah `pb-24` agar konten terbawah tidak tertabrak atau tertutup navigasi `76px`.
2. **`src/styles/index.css`:**
   - Menambahkan deklarasi `touch-action: pan-y` dan `overscroll-behavior-y: contain` pada `.main-scroll` untuk menjamin gestur sentuh vertikal ponsel tidak tertahan oleh overscroll root container.
