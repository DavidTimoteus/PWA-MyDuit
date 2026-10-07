// Uji kontrak event bus MyDuit: SETIAP event `myduit:*` yang di-dispatch
// WAJIB punya minimal satu pendengar.
//
// Kenapa: dua tombol "Aksi Cepat" di panel kanan Budget pernah mati total
// karena `myduit:budget-add-rekening` / `myduit:budget-add-budget` hanya
// di-dispatch — tidak ada satu pun addEventListener. Tidak ada error, tidak
// ada warning di console; tombolnya diam saat diklik. Uji ini mengunci supaya
// kebocoran event bus seperti itu tidak balik lagi.
//
// Jalankan: node src/lib/eventContract.test.mjs
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('src')
const galat = []
let lulus = 0

function cek(nama, ok) {
  if (ok) {
    lulus++
    console.log(`  ok    ${nama}`)
  } else {
    galat.push(nama)
    console.log(`  GAGAL ${nama}`)
  }
}

/** Kunjungi semua file .js/.jsx di src (deterministik, tanpa dependensi). */
function semuaFile(dir, hasil = []) {
  for (const entri of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entri.name)
    if (entri.isDirectory()) semuaFile(p, hasil)
    else if (/\.(js|jsx)$/.test(entri.name)) hasil.push(p)
  }
  return hasil
}

const dispatch = new Map() // nama -> [lokasi]
const listen = new Map()

for (const file of semuaFile(SRC)) {
  const isi = fs.readFileSync(file, 'utf8')
  const rel = path.relative(SRC, file)
  isi.split('\n').forEach((baris, i) => {
    for (const m of baris.matchAll(/new CustomEvent\(\s*'([^']+)'/g)) {
      dispatch.set(m[1], [...(dispatch.get(m[1]) ?? []), `${rel}:${i + 1}`])
    }
    for (const m of baris.matchAll(/addEventListener\(\s*'([^']+)'/g)) {
      listen.set(m[1], [...(listen.get(m[1]) ?? []), `${rel}:${i + 1}`])
    }
  })
}

const namaMyDuit = [...new Set([...dispatch.keys(), ...listen.keys()])].filter((n) => n.startsWith('myduit:')).sort()

cek('minimal satu event myduit:* dipakai di codebase', namaMyDuit.length > 0)

const mati = namaMyDuit.filter((n) => dispatch.has(n) && !listen.has(n))
cek(
  `tidak ada event myduit:* yang di-dispatch tanpa pendengar (diperiksa ${namaMyDuit.length} event)`,
  mati.length === 0,
)
if (mati.length) {
  for (const n of mati) galat.push(`${n} di-dispatch di ${dispatch.get(n).join(', ')} tapi TIDAK PERNAH didengarkan`)
}

// Dua tombol Aksi Cepat Budget — kasus bug yang pernah terjadi, dikunci eksplisit.
for (const n of ['myduit:budget-add-rekening', 'myduit:budget-add-budget']) {
  cek(`${n} punya pendengar`, dispatch.has(n) && listen.has(n) && listen.get(n).length > 0)
}

console.log(`\n${galat.length ? 'GAGAL' : 'LULUS'}: ${lulus}/${lulus + galat.length} cek lolos`)
if (galat.length) {
  console.log(galat.map((g) => `  - ${g}`).join('\n'))
  throw new Error(`Kontrak event bus: ${galat.length} cek gagal`)
}
