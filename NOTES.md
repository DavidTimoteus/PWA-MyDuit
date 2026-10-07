# MyDuit — Catatan Proyek

PWA catatan keuangan (React 19 + Vite + Firebase Hosting `myduit001`, live: https://myduit001.web.app/).
Repo: folder ini. Detail operasional singkat supaya sesi berikutnya tidak nebak.

## Perintah wajib

- `npm run check` = format + uji OCR (28) + struk (34) + offline (offlineSync) + **filter transaksi (11)** + **prefill utang (11)** + lint `--max-warnings=0` + build. Hijau = layak deploy.
- Deploy: `./node_modules/.bin/firebase deploy --only hosting --project myduit001`. Verifikasi setelah deploy: hash `assets/index-*.{js,css}` di `https://myduit001.web.app/` HARUS = `dist/index.html`.
- Uji login tidak bisa di localhost: Firebase → Authentication → Authorized domains TIDAK memuat `127.0.0.1` (error "Domain ini belum diizinkan"). Login hanya bisa dari domain live / harness dengan user tiruan.

## Jebakan yang sudah ketahuan (jangan diulang)

1. **`key` + `useState(kunci)`** (UtangModals): pemanggil modal pakai `key`, jadi instance React SELALU baru tiap dibuka — `useState(kunci)` bikin `kunci === kunciLama` saat mount sehingga reset isi form tak pernah jalan (form edit utang/cicilan kosong, modal bayar tanpa nominal/rekening). Perbaikan: `useState(null)`. Pola serupa di `FormBudgetModal`/`FormRekeningModal` AMAN hanya karena pemanggilnya TIDAK pakai `key`.
2. **Daftar transaksi jangan pernah merge lintas query** (bug filter "Hari Ini" vs "Semua"): semua logika daftar kini di `src/features/transaksi/mergeRiwayat.js` (reducer murni) — kunci berubah → dokumen lama dibuang; snapshot langganan basi diabaikan. Taruh perubahan di file itu, jangan inline di hook.
3. `useEffect` yang pakai objek `range` sebagai dep selalu re-fire → deps-nya `range?.start/end` (primitif).
4. Firebase JS di Node butuh `import.meta.env` → bundel uji dengan esbuild `define: {'import.meta.env': '{}'}` + `jsx: 'automatic'` (lihat `src/features/utang/prefill.test.mjs`).
5. `.mjs` tidak ikut lint ESLint (`src/**/*.{js,jsx}`) — file `.jsx` uji tetap harus bersih `--max-warnings=0`.

## Uji render tanpa login

`node src/features/utang/prefill.test.mjs` mem-bundle `prefill.test.jsx` lalu `renderToString` — membuktikan form terisi saat mount. Pola ini bisa dipakai untuk modal lain tanpa jsdom.

## Catatan deploy

- `firebase.json` wajib rewrite `/assets/**` → `/404.html` (jangan fallback `index.html` → jaring JS chunk).
- Vendor hash (`vendor-react/vendor-firebase/...`) di-cache selamanya oleh browser; ganti kontennya = nama file berubah.
