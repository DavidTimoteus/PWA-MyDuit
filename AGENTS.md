# AGENTS.md — MyDuit PWA Project Memory & Guidelines

Project rewrites the Google Apps Script (GAS) finance WebApp "MyDuit" into a modern, offline-first Progressive Web App (PWA) using **React + Vite + Tailwind CSS v4 + Firebase (Auth & Firestore)**.

---

## 🎯 Primary Goal & Parity Policy
- **Visual & Layout Parity with GAS Original is PARAMOUNT.**
- Every view, card, shadow, modal, spacing, button, and icon must match the GAS design system (Claymorphism, Manrope font, specific color hues, exact layout breakpoints).
- **Rule of Thumb**: When in doubt, read the original GAS source files in `C:\Users\dtimo\Documents\Kuliah\Google Apps Script\MyDuit\` before implementing UI.

---

## 🛠️ Project Stack & Workspace Setup
- **Working Directory**: `C:\Users\dtimo\Documents\Kuliah\Progressive Web App\MyDuit`
- **Framework/Build**: React 19 + Vite 6 + `@vite-pwa/plugin-inject-manifest` (PWA)
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss";`), custom design tokens in `src/styles/index.css`
- **Database / Auth**: Firebase Auth + Firestore Persistence (offline-first)
- **Production Hosting**: `https://myduit001.web.app` (Firebase Hosting — official authorized domain for Google Auth)
- **Icons**: Material Symbols Outlined (`.material-symbols-outlined`)
- **Typography**: `Manrope` (tabular numbers `.font-mono` for currency)
- **Date Picker**: `flatpickr` (wrapped in `ClayDateInput`)
- **Charts**: `chart.js` (statistik trend chart) — rendered imperatively via a `useRef` + `useEffect`
- **PDF Laporan**: `jspdf` + `jspdf-autotable` (generated client-side, print/footer custom — NOT browser print dialog)
- **XLSX backup import**: `xlsx` package
- **Build Verification**: `npm run build` (MUST pass after any code changes)

---

## 🎨 Design System & Claymorphism Rules
1. **Hue System**:
   - Primary (Green): `rgba(38, 90, 67, ...)` / `--clay-h-primary` (Transaksi, Pemasukan)
   - Danger (Red): `rgba(195, 53, 53, ...)` / `--clay-h-danger` (Pengeluaran, Utang, Delete)
   - Neutral (Slate/Gray): `rgba(100, 116, 139, ...)` / `--clay-h-neutral` (Toolbar, Inactive Nav)
   - Blue: `rgba(31, 84, 200, ...)` / `--clay-h-blue` (Budget, Pindah Saldo, Filter Date)
   - Amber: `rgba(208, 134, 9, ...)` / `--clay-h-amber` (Warning, Streak)

2. **Cascade & Inheritance Rule for Clay Classes**:
   - Component classes (`.clay-card`, `.clay-sheet`, `.clay-btn`, `.clay-chip`, `.clay-icon-tile`, `.clay-fab`) MUST NOT declare hardcoded `--clay-h` properties inside their CSS rule!
   - They MUST use fallback `var(--clay-h, var(--clay-h-<default>))` so that key modifier classes (`.clay-key-primary`, `.clay-key-danger`, `.clay-key-blue`, etc.) WIN regardless of CSS file order.

3. **Background Overrides in Tailwind v4**:
   - `.clay-card` uses `background-color: #ffffff` (LONGHAND). Do NOT use `background: #ffffff` shorthand, as shorthand strips `background-image` utilities (`bg-gradient-to-br`).
   - For state tints (e.g. revealed card tint in list), use important utilities `!bg-red-50`, `!bg-emerald-50`, `!bg-blue-50` because unlayered custom CSS beats layered Tailwind v4 utility classes.

4. **Sizing Tokens (button audit already done — follow these)**:
   - **Buttons**: `.btn-sm` (36px) · `.btn-md` (40px) · `.btn-lg` (48px). ALL buttons use one of these tokens; do NOT mix `py-2/py-2.5/py-3/py-3.5`.
   - **Fields**: `.field-md` (40px), `.field-lg` (44px — standard for all form inputs)
   - **Icon action buttons**: `h-8 w-8` (32px) is the standard small icon-control size (close X, row edit/delete chips). Do NOT use `h-7 w-7`.
   - **Icons**: Use `.icon-2xs` (12px), `.icon-xs` (14px), `.icon-sm` (16px), `.icon-md` (18px), `.icon-lg` (20px), `.icon-xl` (24px), `.icon-2xl` (28px), `.icon-hero` (40px). Do NOT use arbitrary `text-[Npx]` on icons. `font-optical-sizing: auto` is enabled.

5. **Radius**: nav sidebar buttons use `.clay-btn` radius 18px (NOT `.clay-chip` which forces pill 999px — too oval for full-width nav items). Pill 999px is reserved for small elements (PDF button, Bulanan/Tahunan chip, badges).

---

## 🗄️ Database Architecture & Anti-Redundancy Contract
- **Collections**:
  - `users/{uid}/transaksi`: `{ jumlah, jenis('pemasukan'|'pengeluaran'|'pindah saldo'), kategoriId, akunId, dariId?, keId?, utangId?, tanggal, catatan, deleted, createdAt }`
  - `users/{uid}/akun`: `{ nama, tipe, saldo, deleted, createdAt, updatedAt, mutasiTerakhir }`
  - `users/{uid}/kategori`: `{ nama, jenis, deleted, createdAt }`
  - `users/{uid}/budget`: `{ kategoriId, limitNominal, bulan(0-11), tahun, deleted, createdAt }`
  - `users/{uid}/utang`: `{ namaPihak, deskripsi, total, sisa, status, tipe, cicilanPerBulan, tglJatuhTempo, deleted, createdAt }`
  - `users/{uid}/pembayaranUtang`: `{ utangId, transaksiId?, akunId, jumlah, tanggal, deleted, createdAt }`
  - `users/{uid}/mutasiLog`: `{ akunId, aksi, delta, transaksiId, timestamp, deleted, createdAt }` (arsip + sumber `mutasiTerakhir`)
  - `users/{uid}/meta/seedKategori`: `{ done, at }` (Marker to prevent TOCTOU seeding races)

- **Single Source of Truth Rule**:
  - `transaksi`, `budget`, and `pembayaranUtang` DO NOT store string names (`kategoriNama`, `akunNama`, `utangNama`).
  - Names are dynamically resolved on read using `enrichTransaksi(docs, akunById, katById)`.
  - For free-typed category names in form submission, `ambilAtauBuatKategori(uid, nama, jenis)` MUST be called at boundary so every category has an official ID.
  - Legacy documents containing string names are handled seamlessly via fallback.
  - `migrasiNormalisasi(uid)` runs once on login to clean legacy fields (`deleteField()`), backfill category IDs, and soft-delete duplicate categories created by past seeding races.

---

## 💰 Currency & Locale System
- **Detection** lives in `src/lib/format.js`:
  - Priority: **lokasi manual pengguna** (`localStorage['myduit:negara']`) → **timezone** → locale → default `IDR`.
  - `NEGARA` = katalog negara tunggal (`{ nama, bendera, currency, symbol, locale }`) dipakai deteksi otomatis + pemilih manual.
  - `negaraManual()` / `simpanNegaraManual(code)` (kode kosong = balik ke otomatis) → reset cache `_uang` + dispatch `EVENT_LOKASI` (`myduit:lokasi-update`).
  - `detectCurrency(locale)`, `detectLocale()`, `detectCountryInfo(locale)` → `{ code, manual, nama, bendera, currency, symbol, locale }`.
  - **Why**: Firebase Auth has no explicit country. Browser `navigator.language` may be `en-US` even for Indonesian users — so timezone is the more reliable fallback, tapi pilihan manual selalu menang.
- **APi format nominal — WAJIB dipakai, jangan hardcode `Rp` atau `toLocaleString('id-ID')`**:
  - `uangAktif()` → `{ currency, symbol, locale }` (cache modul, invalid saat ganti negara).
  - `formatRupiah(n, { tanda })` → `Rp1.234.567` / `US$1,234,567` — formatter utama seluruh app (nama historis, bukan IDR-only).
  - `formatNominal(n)` → angka bergrup tanpa simbol; `simbolUang()` → `Rp`/`US$` untuk prefix input & label `Nominal (…)`.
  - `formatRibuanInput(str)` → grouping live input mengikuti locale aktif (ganti semua regex `replace(/\B(?=(\d{3})+(?!\d))/g, '.')`).
  - `formatCurrency(n, currency, locale, { compact })` → dipakai chart (`compact` → `1rb`/`2,5jt`). `symbolForCurrency()` = peta simbol.
  - `parseNominal()` strip semua non-digit → aman untuk pemisah locale apa pun (`1,234` & `1.234`).
- **PDF**: `laporan.js` punya `simbolPdf()` — font helvetica jsPDF hanya WinAnsi, jadi simbol non-WinAnsi (`₫ ₱ ฿ ₹ ₩`) di-fallback ke kode mata uang (`VND 1.000`).
- **Ubah lokasi (UI)**: tekan **foto profil** — sidebar kiri desktop (juga baris `bendera negara · simbol`) atau header mobile → `LokasiModal` di `Shell.jsx` (daftar negara + tombol "Deteksi otomatis").
- **Consumption**: `StatistikView` menyetel `window.__MYDUIT_CURRENCY__` / `__MYDUIT_LOCALE__` on mount **dan** saat `EVENT_LOKASI`; `kursVer` state memicu chart re-render.
- **Self-check**: `npm run check:format` (`src/lib/format.check.mjs`, assert-based, tanpa framework).



---

## 📱 Mobile vs Desktop Layout Conventions
1. **Grid & widths (both sidebars equal 350px on lg)**:
   - `md:grid-cols-[260px_1fr]` / `lg:grid-cols-[350px_1fr_350px]`
   - Left & right sidebars are locked to 350px on lg. The left aside has NO `overflow-hidden` (it was clipping the nav clay shadow) — width is enforced via `md/lg:min-w + max-w`.
2. **Desktop Layout (`md:` & `lg:`)**:
   - Left Sidebar (350px): `MyDuit` header, Tab Navigation (`.clay-btn` items, radius 18px), Insight Card per active tab, User Block (avatar + name + email + location indicator + Backup + Logout).
   - Right Aside (350px): per-tab panel — **Transaksi**→`RightPanel`, **Statistik**→`StatistikAsidePanel`, **Budget**→`BudgetAsidePanel`, **Utang**→`UtangAsidePanel`. All share identical `<aside>` width classes + `pdf-action-btn` (white circular PDF button).
   - Main Content (Middle): no page title; per-view toolbar.
   - FAB is hidden on desktop (`md:hidden`) — desktop uses the Aksi Cepat buttons in the right panel.
3. **Mobile Layout (`<md`)**:
   - Header: avatar (white ring) + greeting + name, Filter Chip, Install, Backup, Logout (red circle).
   - Bottom Nav: floating clay bar with CSS radial mask notch (`--notch-r: 40px`), 4 tab icon circles (`.nav-icon-wrap`, no labels), center FAB (56px) + speed-dial (Pemasukan / Pindah Saldo / Pengeluaran). FAB & dial aksi go through the event bus.

---

## 🔌 Cross-Component Communication (Event Bus)
Components are decoupled via `window` CustomEvents (no prop drilling across Shell ↔ view):
- `myduit:aksi-cepat` `{type}` — RightPanel/speed-dial → TransaksiView opens form preset / pindah saldo.
- `myduit:buka-filter` — mobile header Filter chip → TransaksiView opens filter modal.
- `myduit:filter-label` `{label}` — TransaksiView → Shell mobile filter chip label.
- `myduit:export-pdf` — any PDF button → Shell opens `ExportPdfModal`.
- `myduit:statistik-update` — StatistikView → `StatistikAsidePanel`.
- `myduit:sidebar-statistik-update` `{streak, last}` — StatistikView → sidebar Streak card.
- `myduit:budget-update` — BudgetView → `BudgetAsidePanel`; `myduit:sidebar-insight-budget` → sidebar Insight Budget.
- `myduit:utang-update` — UtangView → `UtangAsidePanel`; `myduit:sidebar-utang-update` → sidebar Perkiraan Bebas Utang.
- `myduit:utang-add` `{mode}` — UtangAsidePanel → UtangView.
- `myduit:budget-add-rekening` / `myduit:budget-add-budget` — BudgetAsidePanel → BudgetView.
- `myduit:rekening-add` — RekeningPanel (add rekening modal).
- `myduit:toast` `{type, msg}` — generic toast (unless handled by local state).

---

## ⚡ Optimistic UI Pattern (IMPORTANT — modal close)
**Every submit (simpan/update/bayar/pindah/hapus) MUST close the modal IMMEDIATELY, then commit to Firestore in the background.**

- `writeBatch(...).commit()` / `addDoc` promises only resolve after **server ack** — with offline persistence the data is already in IndexedDB (list updates via `onSnapshot` instantly), but `await` would hang and the modal stays stuck on "Menyimpan…".
- **Pattern**: snapshot all form values → `setSaving(false)` + `onClose()` synchronously → run writes inside an IIFE `(async () => { try { await ... } catch(e) { console.warn; dispatch myduit:toast } })()`.
- Do NOT wrap modal-close in `queueMicrotask`/`setTimeout` (caused modal re-open). Do NOT use a `Date.now()` `key` on modals (caused remount with stale `open`); use a stable key like `modal.open ? doc?.id : 'closed'`.
- Same pattern applies in: `FormTransaksiModal`, `ModalPindahSaldo`, `FormBudgetModal`, `FormRekeningModal`, `UtangModals` (FormUtang + BayarUtang), and delete handlers.

---

## 📊 Statistik View (chart)
- Trend chart built with `chart.js` (imported `Chart from 'chart.js/auto'`), rendered in `useEffect` on `chartRef`.
- **Saldo line = per-`period` net (pemasukan − pengeluaran), NOT cumulative.** Bar `Pengeluaran` is plotted as negative (`dataOut.map(v => -v)`, stacked=false).
- **Labels**: `tren.labels` for x-axis (day number or month), `tren.titles` parallel array for tooltip full date (`15 Agu 2026` / `Agu 2026`). Tooltip uses `callbacks.title` from `titles`.
- **Points**: saldo line shows points (`pointRadius` 2 monthly / 3 yearly, `pointHoverRadius` 5).
- **Y-axis**: `formatCurrency(Math.abs(v), cur, loc, { compact: true })` → `Rp 1rb`.
- **Trend % cards** (`Pemasukan/Pengeluaran/Saldo`): previous-period data is fetched SEPARATELY (not from the active `docs`); `pctBaru` returns `null` when no comparison data → card shows "Belum ada data sebelumnya". Label suffix: "vs bulan sebelumnya" / "vs tahun sebelumnya".
- Streak: `hitungStreak_()` counts consecutive days from ALL transaction dates (not just active period), dispatched to sidebar.

---

## 📄 PDF Laporan (jsPDF)
- `src/features/laporan/laporan.js`:
  - `ambilDataLaporan(uid, bulan, tahun)` → aggregates transactions/accounts/kategori/utang/budget for the month/year.
  - `buatPdfLaporan(data, pakaiAI, nama)` → returns a `jsPDF` doc. `unduhLaporanPdf(...)` → `doc.save('Laporan-MyDuit-<periode>.pdf')`.
  - Header drawn as vector (no font-icons); footer with page number drawn per page (`Halaman X dari N`).
  - **These REPLACED the old HTML `cetakLaporan`/`buatHtmlLaporan` iframe approach** — that relied on the browser print dialog (added URL/date header, ugly page margins, no control). jsPDF avoids all of that. Outdated functions must be removed if still referenced.
- `ExportPdfModal`: chooses `bulan`/`tahun` + toggle "Sertakan Rekomendasi AI". Rekomendasi AI is a **visual placeholder** (Kondisi / Hemat di sini / Prioritas alokasi + "SEGERA HADIR") until real AI is built.

---

## 💾 Firestore Config (named database)
- `.env.local` / `.env.example`: `VITE_FIREBASE_DATABASE_ID` is REQUIRED if the Firestore DB is NOT named `(default)`. Here it's `myduit001`.
- `src/lib/firebase.js`: `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }, DATABASE_ID)` — pass the database ID as the 3rd arg.
- `firebase.json` uses ARRAY form for named DB:
  ```json
  "firestore": [{ "database": "myduit001", "rules": "firestore.rules", "indexes": "firestore.indexes.json" }]
  ```
  (Object form only works for `(default)`).
- npm scripts: `fb:login`, `fb:rules`, `fb:indexes`, `fb:firestore`. `firebase-tools` is a devDependency.

---

## 🚨 Git & Commit Policies
- **Commit Messages**: Short, clear, written in **Indonesian** (e.g. `feat (transaksi): sesuaikan tampilan mobile dan normalisasi db`).
- **Confirmation**: ALWAYS summarize work and request user confirmation before running `git commit` or `git push`.

---

## 🔍 Key Source Files Overview
- `src/styles/index.css`: design tokens, claymorphism classes, `.pdf-action-btn`, `.sidebar-nav` (removed — nav now uses `.clay-btn`), Material Symbols base, button/field/icon tokens.
- `src/components/Shell.jsx`: app frame (3-col grid, sidebars 350px, insight cards, user block + location indicator, mobile header + bottom nav with notch & center FAB, ExportPdfModal + BackupModal).
- `src/components/clay-ui.jsx`: `ClaySelect`, `ClayCombobox`, `ClayDateInput` (flatpickr wrapper).
- `src/components/Splash.jsx`: splash screen (z-99999, fade after ~1.4s).
- `src/lib/format.js`: `formatRupiah`, `parseNominal`, `rangeForFilter`, `isoHariIni`, currency detection + `formatCurrency`, `tanggalLabel`/`tanggalPendek`.
- `src/lib/db.js`: Firestore CRUD, `enrichTransaksi`, `migrasiNormalisasi`, `seedKategoriJikaKosong`, `pindahSaldo`/`hapusPindahSaldo`, `ambilAtauBuatKategori`.
- `src/lib/firebase.js`: init app/auth/firestore (with `DATABASE_ID` param).
- `src/lib/useAkunKategori.js`: live akun+kategori snapshot hook (+ seed + dedupe).

### Features (per tab)
- `src/features/transaksi/`: `TransaksiView`, `TransaksiRow`, `FormTransaksiModal`, `ModalPindahSaldo`, `FilterTransaksiModal`, `RightPanel`, `useTransaksi`.
- `src/features/statistik/`: `StatistikView` (chart), `StatistikAsidePanel`.
- `src/features/budget/`: `BudgetView` (sub-tab Rekening|Budget), `BudgetPanel`, `RekeningPanel`, `FormBudgetModal`, `FormRekeningModal`, `BudgetAsidePanel`, `useBudgetBulan`.
- `src/features/utang/`: `UtangView`, `UtangModals` (FormUtang + BayarUtang), `UtangAsidePanel`.
- `src/features/laporan/`: `laporan.js` (jsPDF generator), `ExportPdfModal`.
- `src/features/backup/`: `backup.js` (exportData/restoreData via writeBatch), `BackupModal`, `importGas.js` (GAS XLSX → PWA schema converter).
- `src/App.jsx`: auth gate + migration trigger + Splash.
