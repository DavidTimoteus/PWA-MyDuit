/**
 * ocrStruk.js — Pembacaan struk (OCR) yang berjalan 100% di browser.
 *
 * Mengapa Tesseract.js (bukan API cloud):
 *  - Aplikasi ini offline-first dan data keuangan pribadi; mengirim foto struk
 *    ke server pihak ketiga melanggar janji privasi app.
 *  - Tesseract.js memuat model ke Cache Storage → setelah pemakaian pertama,
 *    OCR tetap bekerja tanpa internet.
 *
 * Yang membuat "bisa membaca struk apa pun":
 *  1. Pra-proses gambar agresif (grayscale + kontras + auto-invert + upscale)
 *     supaya struk termal pudar, foto miring, atau struk gelap tetap terbaca.
 *  2. Dua pass OCR (PSM 6 "blok seragam" lalu PSM 4 "kolom") dan pilih hasil
 *     dengan skor keyakinan terbaik.
 *  3. Parser tahan-banting yang mengenali BANYAK format struk Indonesia:
 *     TOTAL/GRAND TOTAL/JUMLAH/BAYAR/TAGIHAN, tanggal (dd/mm/yyyy, dd-mm-yy,
 *     12 Okt 2026, 2026-10-12), dan pemisah ribuan (1.234.567 / 1,234,567 /
 *     1.234,56 / Rp).
 *  4. Pemilih angka total yang cerdas: buang angka yang jelas bukan total
 *     (nomor telepon, NPWP, tahun, jumlah item) dan prioritaskan angka setelah
 *     kata kunci total.
 *
 * Modul ini murni fungsi (tanpa React) supaya bisa diuji terpisah.
 */

// ===================== PRA-PROSES GAMBAR =====================

/** Muat File/Blob menjadi HTMLImageElement. */
function muatGambar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gambar tidak bisa dibaca.'))
    }
    img.src = url
  })
}

/**
 * Pra-proses: skala abu-abu, auto-kontras (percentile 2–98%), auto-invert bila
 * mayoritas gelap (struk difoto di tempat gelap / mode malam), lalu upscale ke
 * lebar minimal `targetW` (Tesseract akurat pada teks ~30px tinggi).
 * Mengembalikan canvas siap-OCR.
 */
export function praProses(img, targetW = 1600) {
  const skala = Math.max(1, targetW / (img.naturalWidth || img.width || targetW))
  const w = Math.round((img.naturalWidth || img.width) * skala)
  const h = Math.round((img.naturalHeight || img.height) * skala)
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)

  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  const n = w * h

  // 1) grayscale + histogram
  const abu = new Uint8ClampedArray(n)
  const hist = new Uint32Array(256)
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0
    abu[j] = g
    hist[g]++
  }

  // 2) auto-kontras: buang 2% ekstrem, regangkan sisanya ke 0..255
  const batas = n * 0.02
  let lo = 0, hi = 255, acc = 0
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > batas) { lo = v; break } }
  acc = 0
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > batas) { hi = v; break } }
  const rentang = Math.max(1, hi - lo)

  // 3) deteksi gelap-terang: kalau median < 128, gambar cenderung gelap → invert
  let median = 128, acc2 = 0
  for (let v = 0; v < 256; v++) { acc2 += hist[v]; if (acc2 >= n / 2) { median = v; break } }
  const invert = median < 110

  for (let j = 0; j < n; j++) {
    let v = ((abu[j] - lo) / rentang) * 255
    if (invert) v = 255 - v
    v = v < 0 ? 0 : v > 255 ? 255 : v
    const k = j * 4
    px[k] = px[k + 1] = px[k + 2] = v
    px[k + 3] = 255
  }
  ctx.putImageData(data, 0, 0)
  return cv
}

// ===================== OCR =====================

let workerCache = null

/**
 * Jalankan Tesseract pada canvas. `onProgress` menerima 0..1.
 * Worker di-cache supaya OCR kedua tidak mengunduh ulang model.
 */
export async function jalankanOcr(canvas, onProgress) {
  const { createWorker } = await import('tesseract.js')
  if (!workerCache) {
    workerCache = await createWorker(['ind', 'eng'], 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) onProgress(m.progress)
      },
    })
  }
  const worker = await workerCache

  // Dua konfigurasi halaman: 6 = satu blok teks seragam (struk umum),
  // 4 = variabel kolom (struk dengan kolom harga terpisah).
  const hasil = []
  for (const psm of ['6', '4']) {
    try {
      await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' })
      const r = await worker.recognize(canvas)
      hasil.push({ psm, teks: r.data.text || '', conf: r.data.confidence || 0 })
    } catch (e) {
      hasil.push({ psm, teks: '', conf: -1, error: e?.message })
    }
  }
  hasil.sort((a, b) => b.conf - a.conf)
  return hasil[0]
}

// ===================== PARSER STRUK =====================

const BULAN_ID = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4,
  mei: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, aug: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10,
  nov: 11, november: 11, des: 12, desember: 12, dec: 12,
}

/** Ubah "1.234.567" / "1,234,567" / "1 234 567" / "Rp 45.000" → 1234567 (integer). */
export function parseAngkaID(s) {
  if (s == null) return null
  let t = String(s).replace(/rp\.?|idr/gi, '').trim()
  // Buang karakter selain digit, titik, koma, spasi
  t = t.replace(/[^\d.,\s]/g, '')
  t = t.replace(/\s/g, '')
  if (!t) return null

  const adaTitik = t.includes('.')
  const adaKoma = t.includes(',')

  if (adaTitik && adaKoma) {
    // Format yang lebih umum di ID: titik = ribuan, koma = desimal.
    // Tapi kalau koma di posisi ribuan (mis. 1,234,567) dan titik desimal (1.234,56),
    // tentukan dari kemunculan TERAKHIR.
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) {
      // 1.234,56 → desimal koma
      t = t.replace(/\./g, '').replace(',', '.')
      return Math.round(parseFloat(t))
    }
    // 1,234.56 → desimal titik
    t = t.replace(/,/g, '')
    return Math.round(parseFloat(t))
  }
  if (adaTitik) {
    // Titik sebagai pemisah ribuan (pola umum ID: 1.234.567) ATAU desimal (45.50).
    const bagian = t.split('.')
    const semua3 = bagian.slice(1).every((p) => p.length === 3)
    if (bagian.length > 2 || (bagian.length === 2 && semua3)) return parseInt(bagian.join(''), 10)
    return Math.round(parseFloat(t))
  }
  if (adaKoma) {
    const bagian = t.split(',')
    const semua3 = bagian.slice(1).every((p) => p.length === 3)
    if (bagian.length > 2 || (bagian.length === 2 && semua3)) return parseInt(bagian.join(''), 10)
    return Math.round(parseFloat(t.replace(',', '.')))
  }
  return parseInt(t, 10)
}

/** Normalisasi OCR: perbaiki huruf yang sering salah di struk termal. */
function normalisasiOcr(teks) {
  return String(teks || '')
    .replace(/\r/g, '')
    .replace(/[|]/g, 'l')          // pipe sering = 'l'/'1'
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // 'O'/'o' di antara digit sering harus '0'
    .replace(/(?<=\d)[oO](?=\d)/g, '0')
    .replace(/(?<=\d)[lI](?=\d)/g, '1')
}

/** Ekstrak tanggal dari teks → 'YYYY-MM-DD' atau null. */
export function cariTanggal(teks) {
  const t = normalisasiOcr(teks)

  // 1) ISO: 2026-10-12
  let m = t.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) {
    const [, y, bl, hr] = m
    if (+bl >= 1 && +bl <= 12 && +hr >= 1 && +hr <= 31) return `${y}-${pad(bl)}-${pad(hr)}`
  }

  // 2) dd/mm/yyyy atau dd-mm-yy (pola Indonesia)
  m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)
  if (m) {
    let [, d1, d2, y] = m
    d1 = +d1; d2 = +d2
    if (y.length === 2) y = '20' + y
    // Prioritaskan dd/mm (Indonesia). Kalau d1>12 berarti pasti hari.
    if (d1 <= 31 && d2 <= 12) return `${y}-${pad(d2)}-${pad(d1)}`
    if (d1 <= 12 && d2 <= 31) return `${y}-${pad(d1)}-${pad(d2)}`
  }

  // 3) dd NamaBulan yyyy  (12 Okt 2026 / 12 Oktober 2026)
  m = t.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(20\d{2})\b/)
  if (m) {
    const bl = BULAN_ID[m[2].toLowerCase()]
    if (bl) return `${m[3]}-${pad(bl)}-${pad(m[1])}`
  }

  return null
}

function pad(n) {
  return String(n).padStart(2, '0')
}

// Kata kunci total BERTINGKAT: makin tinggi level, makin yakin itu total akhir.
// Level 3 = paling diutamakan (grand total). Level 1 = cadangan.
const KATA_TOTAL_TIER = [
  { level: 3, kata: ['grand total', 'total bayar', 'total belanja', 'total tagihan', 'total akhir', 'total harga', 'jumlah bayar', 'total'] },
  { level: 2, kata: ['jumlah', 'tagihan', 'harus bayar', 'dibayar', 'amount', 'netto', 'subtotal'] },
  { level: 1, kata: ['bayar', 'tunai', 'cash'] },
]
const KATA_ABAIKAN = [
  'npwp', 'telp', 'telpon', 'telepon', 'hp', 'wa', 'no.', 'no ', 'invoice',
  'struk', 'kasir', 'poin', 'point', 'kembali', 'kembalian',
  'diskon', 'disc', 'ppn', 'pajak', 'tax', 'kode', 'ref', 'member', 'card',
  'debit', 'kredit', 'qris', 'bank', 'id pelanggan', 'meter', 'tarif',
]

/** Cocokkan kata kunci sebagai kata utuh supaya "subtotal" ≠ "total". */
function adaKata(teks, frasa) {
  const esc = frasa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`, 'i').test(teks)
}

function levelTotal(lb) {
  let lvl = 0
  for (const t of KATA_TOTAL_TIER) {
    if (t.kata.some((k) => adaKata(lb, k))) lvl = Math.max(lvl, t.level)
  }
  return lvl
}

/**
 * Cari nominal total. Strategi bertingkat:
 *  1. Baris dengan kata kunci total (grand total > total > jumlah > bayar).
 *  2. Ambil angka SETELAH kata kunci bila ada (hindari "Tunai 50.000 Kembali 5.000"
 *     salah ambil), kalau tidak ada pakai angka terbesar di baris.
 *  3. Buang baris ber-kata-terlarang (npwp, telp, kembali, ppn, diskon, ...).
 *  4. Cadangan: angka terbesar di seluruh struk yang masuk akal.
 */
export function cariTotal(teks) {
  const baris = normalisasiOcr(teks).split('\n')
  const kandidat = []

  for (const b of baris) {
    const lb = b.toLowerCase()
    const lvl = levelTotal(lb)
    const terlarang = KATA_ABAIKAN.some((k) => adaKata(lb, k))
    // Baris terlarang hanya boleh lolos bila juga memuat kata total level >= 2
    if (terlarang && lvl < 2) continue

    const angka = [...b.matchAll(/(\d[\d.,]{2,})/g)].map((m) => parseAngkaID(m[1])).filter((n) => n != null && n > 0)
    if (!angka.length) continue

    // Ambil angka setelah kata kunci total (paling kanan = biasanya nominal).
    let nilai = Math.max(...angka)
    if (lvl >= 2) {
      const posKata = Math.max(
        ...KATA_TOTAL_TIER.flatMap((t) => t.kata).map((k) => lb.indexOf(k)),
      )
      const setelah = [...b.matchAll(/(\d[\d.,]{2,})/g)]
        .map((m) => ({ n: parseAngkaID(m[1]), i: m.index }))
        .filter((x) => x.n != null && x.n > 0 && x.i > posKata)
      if (setelah.length) nilai = setelah[setelah.length - 1].n
    }
    kandidat.push({ nilai, lvl, sumber: b.trim() })
  }

  if (!kandidat.length) return { total: null, sumber: null }

  // Prioritas: level tertinggi; seri → nilai terbesar.
  kandidat.sort((a, b) => b.lvl - a.lvl || b.nilai - a.nilai)

  // Buang nilai tak masuk akal sebagai total (nomor panjang > 9 digit / >= 1 miliar)
  const wajar = kandidat.filter((k) => k.nilai < 1e9 && String(k.nilai).length <= 9)
  const pilih = wajar[0] ?? kandidat[0]
  return { total: pilih.nilai, sumber: pilih.sumber }
}

/** Heuristik jenis: struk minim kata pemasukan → default pengeluaran. */
export function cariJenis(teks) {
  const t = String(teks || '').toLowerCase()
  if (/(refund|pengembalian|pemasukan|cashback masuk|top ?up diterima|gaji|bonus|transfer masuk|diterima dari)/.test(t)) return 'pemasukan'
  return 'pengeluaran'
}

/** Ambil nama merchant dari baris awal yang paling mungkin (huruf, bukan angka). */
export function cariMerchant(teks) {
  const baris = normalisasiOcr(teks)
    .split('\n')
    .map((b) => b.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  for (const b of baris.slice(0, 6)) {
    const huruf = b.replace(/[^A-Za-z]/g, '')
    const digit = b.replace(/[^0-9]/g, '')
    if (huruf.length >= 4 && digit.length <= 2 && !/total|struk|invoice|nota|kasir|tanggal/i.test(b)) {
      return b.slice(0, 40)
    }
  }
  return ''
}

/**
 * Fungsi utama: terima File gambar → kembalikan hasil terstruktur.
 * @returns {Promise<{teks, total, tanggal, jenis, merchant, confidence}>}
 */
export async function bacaStruk(file, onProgress) {
  const img = await muatGambar(file)
  const canvas = praProses(img)
  const hasil = await jalankanOcr(canvas, onProgress)
  const teks = hasil.teks || ''

  const { total, sumber } = cariTotal(teks)
  return {
    teks,
    total,
    totalSumber: sumber,
    tanggal: cariTanggal(teks),
    jenis: cariJenis(teks),
    merchant: cariMerchant(teks),
    confidence: hasil.conf,
    psm: hasil.psm,
  }
}

/** Lepas worker Tesseract (panggil saat komponen dilepas, hemat memori). */
export async function matikanOcr() {
  if (workerCache) {
    try {
      const w = await workerCache
      await w.terminate()
    } catch {
      /* abaikan */
    }
    workerCache = null
  }
}
