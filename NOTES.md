# MyDuit — Catatan Proyek

PWA catatan keuangan (React 19 + Vite + Firebase Hosting `myduit001`, live: https://myduit001.web.app/).
Repo: folder ini. Detail operasional singkat supaya sesi berikutnya tidak nebak.

## Perintah wajib

- `npm run check` = format + uji OCR (28) + struk (34) + offline (offlineSync) + **filter transaksi (11)** + **riwayat mutasi rekening (24)** + **render panel budget & modal riwayat (16)** + **kontrak event bus (4)** + **prefill utang (11)** + lint `--max-warnings=0` + build. Hijau = layak deploy.
- Deploy: `./node_modules/.bin/firebase deploy --only hosting --project myduit001`. Verifikasi setelah deploy: hash `assets/index-*.{js,css}` di `https://myduit001.web.app/` HARUS = `dist/index.html`.
- Uji login tidak bisa di localhost: Firebase → Authentication → Authorized domains TIDAK memuat `127.0.0.1` (error "Domain ini belum diizinkan"). Login hanya bisa dari domain live / harness dengan user tiruan.

## Jebakan yang sudah ketahuan (jangan diulang)

1. **`key` + `useState(kunci)`** (UtangModals): pemanggil modal pakai `key`, jadi instance React SELALU baru tiap dibuka — `useState(kunci)` bikin `kunci === kunciLama` saat mount sehingga reset isi form tak pernah jalan (form edit utang/cicilan kosong, modal bayar tanpa nominal/rekening). Perbaikan: `useState(null)`. Pola serupa di `FormBudgetModal`/`FormRekeningModal` AMAN hanya karena pemanggilnya TIDAK pakai `key`.
2. **Daftar transaksi jangan pernah merge lintas query** (bug filter "Hari Ini" vs "Semua"): semua logika daftar kini di `src/features/transaksi/mergeRiwayat.js` (reducer murni) — kunci berubah → dokumen lama dibuang; snapshot langganan basi diabaikan. Taruh perubahan di file itu, jangan inline di hook.
3. `useEffect` yang pakai objek `range` sebagai dep selalu re-fire → deps-nya `range?.start/end` (primitif).
4. Firebase JS di Node butuh `import.meta.env` → bundel uji dengan esbuild `define: {'import.meta.env': '{}'}` + `jsx: 'automatic'` (lihat `src/features/utang/prefill.test.mjs`).
5. `.mjs` tidak ikut lint ESLint (`src/**/*.{js,jsx}`) — file `.jsx` uji tetap harus bersih `--max-warnings=0`.
6. **Event bus tanpa pendengar = tombol diam** (bug 2 tombol Aksi Cepat panel kanan Budget): `myduit:budget-add-rekening` / `myduit:budget-add-budget` di-dispatch oleh `BudgetAsidePanel` tapi tidak didengar siapa pun — tidak ada error, hanya tombol yang tidak bereaksi. Dua keputusan: (a) pendengarnya ditaruh di `BudgetView` (punya `setModal` + bisa ganti sub-tab), (b) `myduit:rekening-add` lama hanya mewakili sub-tab Rekening → handler-nya sekarang ganti sub-tab dulu baru buka modal, dan sub-tab Rekening yang belum pernah tampil punya state tertunda (`myduit:buka-tambah-rekening` -> siapkan lalu buka saat aktif). Dikunci uji `test:events` (`src/lib/eventContract.test.mjs`): SEMUA event `myduit:*` yang di-dispatch wajib punya listener.
7. **Guard `if (sub !== X) return` di dalam useEffect emit ringkasan itu berbahaya**: `BudgetAsidePanel` / sidebar dirender per **TAB**, bukan per sub-tab. Guard lama bikin panel kanan menampilkan angka Rp0 placeholder saat sub-tab Rekening. Emit ringkasan selalu jalan tanpa guard sub-tab.

## Uji render tanpa login

`node src/features/utang/prefill.test.mjs` mem-bundle `prefill.test.jsx` lalu `renderToString` — membuktikan form terisi saat mount. Pola ini dipakai ulang di `src/features/budget/render.test.mjs` (modal riwayat + panel rekening/budget) tanpa jsdom.

## Fitur: detail perubahan rekening (panel kanan tab Budget)

- Logika murni di `src/features/budget/riwayatSaldo.js` (filter akun + delta pemasukan/pengeluaran/transfer 2 arah + saldo berjalan mundur dari saldo saat ini), diuji `riwayatSaldo.test.mjs` (24).
- UI `RiwayatMutasiModal.jsx`: tanggal+jam, jenis, kategori/catatan, nominal +/-, saldo sesudah; filter **Hari Ini / 7 Hari / 30 Hari / Kustom / Semua**.
- Akses: tombol ikon riwayat di header kartu rekening ATAU klik kotak "Perubahan Terakhir" (keduanya memakai `setRiwayatId(a.id)`).
- Data diambil lewat `useTransaksi(uid, { jenis: 'semua', range })` yang sudah punya guard `deleted == false` — JANGAN query transaksi mentah tanpa filter itu.

## Catatan deploy

- `firebase.json` wajib rewrite `/assets/**` → `/404.html` (jangan fallback `index.html` → jaring JS chunk).
- Vendor hash (`vendor-react/vendor-firebase/...`) di-cache selamanya oleh browser; ganti kontennya = nama file berubah.
