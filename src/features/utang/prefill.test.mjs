// Runner uji prefill form utang/bayar: bundel entry .jsx (JSX + import.meta.env
// dari firebase.js tidak bisa dibaca Node mentah) lalu jalankan hasilnya.
//
// Jalankan: node src/features/utang/prefill.test.mjs
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const keluar = path.resolve('node_modules/.myduit-test')
const hasil = path.join(keluar, 'prefill.test.bundle.mjs')

await build({
  entryPoints: [path.resolve('src/features/utang/prefill.test.jsx')],
  bundle: true,
  // react & firebase di-resolve Node (bundelnya berat/tidak perlu); flatpickr
  // ikut dibundel karena ia mengimpor CSS yang tak bisa dimuat Node.
  external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/server', 'firebase', 'firebase/*'],
  format: 'esm',
  platform: 'node',
  jsx: 'automatic', // sama dengan Vite: runtime JSX React 19, bukan React.createElement
  define: { 'import.meta.env': '{}' }, // firebase.js membaca import.meta.env di module scope
  loader: { '.css': 'empty' },
  outfile: hasil,
  logLevel: 'warning',
})

await import(pathToFileURL(hasil).href)
