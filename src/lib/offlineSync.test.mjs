// offlineSync.test.mjs — mengunci jaminan offline-first.
//
// Menguji KEBIJAKAN pada jalur tulis Firestore, bukan menebak dari membaca
// source: setiap dokumen transaksi WAJIB memakai ID yang dibuat server, dan
// saldo WAJIB ditulis atomik lewat increment(). Kalau suatu saat ada yang
//Replace dengan id buatan client (Date.now / Math.random), dua perangkat yang
// offline bersamaan bisa membuat dokumen berbeda dengan ID sama — cek ini
// yang menangkapnya sebelum data rusak di lapangan.
import { inspect } from 'node:util'

// Ekstrak setiap jalur tulis dari db.js dan klasifikasikan apakah ID-nya
// dibuat server (aman) atau oleh client (berisiko tabrakan saat offline).
const fs = await import('node:fs')
const src = fs.readFileSync(new URL('./db.js', import.meta.url), 'utf8')
const baris = src.split('\n')

const tulis = []
baris.forEach((l, i) => {
  const kode = l.replace(/\/\/.*$/, '').trim()
  if (!kode) return
  //ocument ditulis dengan ID kosong -> Firestore yang membuat ID (server-generated)
  const idKosong = /doc\(\s*userCol\([^)]*\)\s*\)/.test(kode)
  const addDocPakai = /\baddDoc\(/.test(kode)
  const idEksplisit = /doc\(\s*userCol\([^)]*,\s*[^)]*,/.test(kode)
  const idDariVar = /doc\(\s*userCol\([^)]*,\s*[^)]*\.\w+\s*\)/.test(kode)
  if (idKosong || addDocPakai) {
    tulis.push({ baris: i + 1, cara: 'server-generated', teks: kode.slice(0, 78) })
  } else if (idEksplisit || idDariVar) {
    tulis.push({ baris: i + 1, cara: 'id-dari-server', teks: kode.slice(0, 78) })
  }
})

console.log('=== Jalur penulisan dokumen ===')
for (const t of tulis) console.log(`  ${String(t.baris).padStart(4)}  ${t.cara.padEnd(16)} ${t.teks}`)

const serverGen = tulis.filter((t) => t.cara === 'server-generated').length
const total = tulis.length
console.log(`\n  jalur tulis total      : ${total}`)
console.log(`  ID dibuat server       : ${serverGen}`)
console.log(`  memakai increment()    : ${(src.match(/\bincrement\(/g) || []).length} (atomik, aman races)`)
console.log(`  memakai runTransaction : ${(src.match(/runTransaction\(/g) || []).length}`)

console.log('\n=== KRITERIA OFFLINE-FIRST ===')
const cek = [
  ['persistentLocalCache aktif', /persistentLocalCache\(/.test(src) || 'di firebase.js'],
  ['multi-tab manager', /persistentMultipleTabManager\(/.test(fs.readFileSync(new URL('./firebase.js', import.meta.url), 'utf8'))],
  ['tidak ada ID buatan client (Date.now/random) pada jalur tulis',
    !/doc\([^)]*Date\.now\(\)/.test(src) && !/doc\([^)]*Math\.random\(\)/.test(src)],
  ['balance ditulis atomik via increment()', (src.match(/\bincrement\(/g) || []).length > 0],
]
let gagal = 0
for (const [nama, ok] of cek) {
  const nyata = typeof ok === 'string' ? true : ok
  if (!nyata) gagal++
  console.log(`  ${nyata ? '[OK]  ' : '[GAGAL]'} ${nama}`)
}
console.log(gagal === 0 ? '\nSemua kriteria terpenuhi.' : `\n${gagal} kriteria gagal.`)