// Runner uji render panel budget + modal riwayat rekening (JSX + import.meta.env
// dari firebase.js tidak bisa dibaca Node mentah -> bundel dulu dengan esbuild).
//
// Jalankan: node src/features/budget/render.test.mjs
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const keluar = path.resolve('node_modules/.myduit-test')
const hasil = path.join(keluar, 'budget.render.test.bundle.mjs')

await build({
  entryPoints: [path.resolve('src/features/budget/render.test.jsx')],
  bundle: true,
  // react & firebase di-resolve Node (bundelnya berat/tidak perlu); flatpickr
  // ikut dibundel karena ia mengimpor CSS yang tak bisa dimuat Node.
  external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/server', 'firebase', 'firebase/*'],
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  define: { 'import.meta.env': '{}' },
  loader: { '.css': 'empty' },
  outfile: hasil,
  logLevel: 'warning',
})

await import(pathToFileURL(hasil).href)
