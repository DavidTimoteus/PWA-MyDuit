// Uji render fitur "Detail Perubahan Rekening" + panel Budget tanpa login
// (renderToString, pola sama dengan prefill.test.jsx).
//
// Yang dikunci: modal riwayat benar-benar merender (judul, rekening, saldo,
// KETIGA filter wajib Hari Ini / 7 Hari / 30 Hari + Kustom + Semua, hanya satu
// filter aktif), modal tanpa akun tidak merender apa pun, dan panel
// Rekening/Budget tetap render utuh setelah komponen diedit.
//
// Jalankan: node src/features/budget/render.test.mjs
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import RiwayatMutasiModal from './RiwayatMutasiModal.jsx'
import RekeningPanel from './RekeningPanel.jsx'
import BudgetView from './BudgetView.jsx'

const galat = []
let total = 0

function cek(nama, html, patokan) {
  total++
  const ok = typeof patokan === 'function' ? patokan(html) : html.includes(patokan)
  if (ok) console.log(`  ok    ${nama}`)
  else {
    galat.push(nama)
    console.log(`  GAGAL ${nama}`)
  }
}

const akun = { id: 'a1', nama: 'Rekening Utama', tipe: 'Rekening Utama', saldo: 1500000 }

// ===== 1. Modal riwayat mutasi =====
const html = renderToString(
  h(RiwayatMutasiModal, { uid: 'u1', akun, kategoriById: { k1: 'Makanan' }, onClose: () => {} }),
)

cek('modal: judul "Perubahan Rekening"', html, 'Perubahan Rekening')
cek('modal: nama rekening tampil', html, 'Rekening Utama')
cek('modal: saldo saat ini tampil', html, 'saldo saat ini')
cek('modal: filter "Hari Ini"', html, 'Hari Ini')
cek('modal: filter "7 Hari Terakhir"', html, '7 Hari Terakhir')
cek('modal: filter "30 Hari Terakhir"', html, '30 Hari Terakhir')
cek('modal: filter "Kustom"', html, 'Kustom')
cek('modal: filter "Semua"', html, '>Semua</button>')
cek(
  'modal: tepat SATU filter aktif (default 7 hari)',
  html,
  (s) => (s.match(/aria-pressed="true"/g) ?? []).length === 1,
)
cek('modal: state loading terlihat', html, 'Memuat riwayat...')

// Redesign clay: struktur baru harus ikut ter-render, dan pill filter
// aktif tidak lagi membawa `text-white` di atas latar putih — kontrasnya
// dikunci lewat class .mutasi-tab.is-aktif (dicek classContract.test.mjs).
cek('modal: header punya ikon identitas rekening', html, 'mutasi-identitas')
cek('modal: hero saldo + badge tipe rekening', html, 'mutasi-hero')
cek('modal: label saldo pakai class hero', html, 'mutasi-hero__label')
cek('modal: eyebrow filter + ringkasan ter-render', html, 'mutasi-eyebrow')
cek(
  'modal: tepat SATU pill .mutasi-tab.is-aktif (filter aktif tidak putih-hilang)',
  html,
  (s) => (s.match(/mutasi-tab is-aktif/g) || []).length === 1,
)
cek('modal: pill filter tidak lagi memakai text-white', html, (s) => !/mutasi-tab[^>]*text-white/.test(s))
cek(
  'modal: tanpa akun -> tidak merender apa pun',
  renderToString(h(RiwayatMutasiModal, { uid: 'u1', akun: null, onClose: () => {} })),
  (s) => s === '',
)

// ===== 2. Panel Rekening (tempat tombol detail dipasang) =====
const htmlPanel = renderToString(h(RekeningPanel, { uid: 'u1' }))
cek('panel rekening: hero "Total Semua Saldo"', htmlPanel, 'Total Semua Saldo')
cek('panel rekening: empty state saat akun kosong', htmlPanel, 'Belum ada rekening')
// Modal riwayat hanya mount bila ada akun terpilih -> tertutup saat awal.
cek('panel rekening: modal riwayat tertutup di awal', htmlPanel, (s) => !s.includes('Perubahan Rekening'))

// ===== 3. BudgetView (induk sub-tab Rekening | Budget) =====
const htmlView = renderToString(h(BudgetView, { user: { uid: 'u1' } }))
cek('budget view: sub-tab Rekening dirender', htmlView, 'Total Semua Saldo')
cek('budget view: sub-tab Budget tersedia', htmlView, 'Budget')

console.log(`\n${galat.length ? 'GAGAL' : 'LULUS'}: ${total - galat.length}/${total} cek lolos`)
if (galat.length) throw new Error(`Render fitur riwayat rekening gagal: ${galat.join(' | ')}`)
