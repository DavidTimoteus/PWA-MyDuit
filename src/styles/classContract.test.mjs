// Kontrak kelas komponen <-> CSS (regresi bug "teks putih di atas putih").
//
// Bug yang dikunci: `RiwayatMutasiModal` memakai
//   clay-chip ... solid-blue text-white
// tetapi `.clay-chip.solid-blue` TIDAK PERNAH didefinisikan. Chip tetap
// berbackground putih (.clay-chip), teksnya putih -> tulisan filter aktif
// hilang total (kontras 1.0). Tidak ada error di console, tidak gagal
// build, tidak gagal test render — hanya CSS yang bolong.
//
// Aturan yang diuji di sini:
//   1. Setiap kombinasi <komponen>.solid-<varian> yang dipakai di JSX
//      HARUS ada di CSS.
//   2. Setiap token kustom `mutasi-*` yang dipakai di JSX HARUS ada di CSS.
//   3. Tidak ada token kelas cacat (variant menggantung `hover:`,
//      `xxx:-dark`, token yatim `-light`).
//   4. Setiap modifier `is-*` yang dipakai bersama class kustom HARUS
//      muncul di CSS.
//
// Jalankan: node src/styles/classContract.test.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const galat = []
let total = 0

function cek(nama, ok) {
  total++
  // Predikat boleh berupa fungsi (butuh lazy eval agar pesan galat bisa
  // dicetak dari dalamnya) — jangan pernah memeriksa keberadaan fungsi.
  const lolos = typeof ok === 'function' ? ok() : ok
  if (lolos) console.log(`  ok    ${nama}`)
  else {
    galat.push(nama)
    console.log(`  GAGAL ${nama}`)
  }
}

function jalan(dir, pred) {
  const out = []
  for (const nama of readdirSync(dir)) {
    const p = join(dir, nama)
    if (statSync(p).isDirectory()) out.push(...jalan(p, pred))
    else if (pred(p)) out.push(p)
  }
  return out
}

const cssFiles = jalan(srcRoot, (p) => p.endsWith('.css'))
const jsxFiles = jalan(srcRoot, (p) => /\.(jsx|js)$/.test(p) && !/\.test\.(jsx|js|mjs)$/.test(p))
const css = cssFiles.map((p) => readFileSync(p, 'utf8')).join('\n')

// Ambil isi className literal (string bias, template literal — cabang ternary
// ikut digabung supaya token di kedua cabang ikut diperiksa).
function kelasDari(t) {
  const hasil = []
  const pola = [
    /className=\s*"([^"]*)"/g,
    /className=\s*'([^']*)'/g,
    /className=\s*\{`([^`]*)`\}/g,
  ]
  for (const p of pola) {
    for (const m of t.matchAll(p)) {
      let s = m[1]
      if (p.source.startsWith('className=\\s*\\{')) {
        s = s.replace(/\$\{[^{}]*\}/g, (blok) => {
          const bagian = []
          for (const a of blok.matchAll(/'([^']*)'|"([^"]*)"/g)) bagian.push(a[1] ?? a[2] ?? '')
          return bagian.join(' ')
        })
      }
      hasil.push(s)
    }
  }
  return hasil
}

const KOMPONEN = ['clay-btn', 'clay-card', 'clay-chip', 'clay-fab', 'clay-icon-tile']
const tokenByFile = new Map()
let kombinasiSolid = new Set()
let tokenSah = 0

for (const p of jsxFiles) {
  const isi = readFileSync(p, 'utf8')
  const kumpul = []
  for (const cls of kelasDari(isi)) {
    const toks = cls.split(/\s+/).filter(Boolean)
    tokenSah += toks.length
    kumpul.push(...toks)
    for (const k of KOMPONEN) {
      if (!toks.includes(k)) continue
      for (const t of toks) {
        if (t.startsWith('solid-')) kombinasiSolid.add(`${k}.${t}`)
      }
    }
  }
  tokenByFile.set(relative(srcRoot, p), kumpul)
}

// --- 1. kombinasi <komponen>.solid-* ada di CSS -------------------------
kombinasiSolid = new Set([...kombinasiSolid].sort())
cek(`semua kombinasi solid yang dipakai terdefinisi (${kombinasiSolid.size} kombinasi)`, () => {
  const hilang = [...kombinasiSolid].filter((c) => !css.includes(`.${c} {`) && !css.includes(`.${c}{`))
  if (hilang.length) console.log(`         hilang: ${hilang.join(', ')}`)
  return hilang.length === 0
})

// --- 1b. lubang historis: varian solid yang PERNAH dipakai komponen tetapi
//         tak pernah didefinisikan (inilah bug "tulisan filter hilang").
//         Selector berikut wajib tetap ada di CSS selamanya.
const WAJIB_ADA = ['.clay-chip.solid-blue']
for (const sel of WAJIB_ADA) {
  cek(`lubang historis ${sel} tetap terdefinisi`, () => css.includes(`${sel} {`))
}

// --- 2. token `mutasi-*` yang dipakai ada di CSS ------------------------
const tokenMutasi = new Set()
const tokenIs = new Set()
for (const toks of tokenByFile.values()) {
  for (const t of toks) {
    if (t.startsWith('mutasi-')) tokenMutasi.add(t)
    if (t.startsWith('is-')) tokenIs.add(t)
  }
}
cek(`token kustom mutasi-* terdefinisi di CSS (${tokenMutasi.size} token)`, () => {
  const hilang = [...tokenMutasi].filter((t) => !css.includes(`.${t}`))
  if (hilang.length) console.log(`         hilang: ${hilang.join(', ')}`)
  return hilang.length === 0
})

cek(`modifier is-* terdefinisi di CSS (${tokenIs.size} token)`, () => {
  const hilang = [...tokenIs].filter((t) => !css.includes(`.${t}`))
  if (hilang.length) console.log(`         hilang: ${hilang.join(', ')}`)
  return hilang.length === 0
})

// --- 3. token kelas cacat ----------------------------------------------
const ACAK = [
  { nama: 'variant menggantung (mis. "hover:")', uji: (t) => /^[a-z0-9-]+:$/.test(t) },
  { nama: 'variant negatif tak valid (mis. "hover:-dark")', uji: (t) => /^[a-z0-9-]+:-[a-z]+$/.test(t) },
  { nama: 'token yatim "-light"', uji: (t) => t === '-light' || t === '-dark' },
]
for (const r of ACAK) {
  const kena = []
  for (const [f, toks] of tokenByFile) for (const t of toks) if (r.uji(t)) kena.push(`${f}: ${t}`)
  cek(`tanpa ${r.nama} (${tokenSah} token diperiksa)`, () => {
    if (kena.length) console.log(`         ditemukan: ${kena.join(' | ')}`)
    return kena.length === 0
  })
}

console.log(`\n${galat.length ? 'GAGAL' : 'LULUS'}: ${total - galat.length}/${total} cek lolos`)
if (galat.length) throw new Error(`Kontrak kelas CSS gagal: ${galat.join(' | ')}`)
