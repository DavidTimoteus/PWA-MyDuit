import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFirebase } from '../../lib/firebase.js'
import { uangAktif } from '../../lib/format.js'

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// Font standar jsPDF (helvetica) hanya mendukung WinAnsi, jadi simbol seperti
// ₫/₱/฿/₹ tidak terender. Untuk simbol di luar WinAnsi pakai kode mata uang.
const SIMBOL_WINANSI = /^[\x20-\x7E£¥€]+$/
function simbolPdf() {
  const { currency, symbol } = uangAktif()
  return SIMBOL_WINANSI.test(symbol) ? symbol : `${currency} `
}

const rp = (n) => `${simbolPdf()}${(Number(n) || 0).toLocaleString(uangAktif().locale)}`
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// Palet selaras aplikasi (RGB untuk jsPDF)
const C = {
  hijauTua: [27, 67, 50],
  hijau: [45, 106, 79],
  hijauMuda: [64, 145, 108],
  hijauTeks: [5, 150, 105],
  merah: [220, 38, 38],
  merahMuda: [254, 226, 226],
  merahTeks: [185, 28, 28],
  biru: [29, 78, 216],
  biruMuda: [219, 234, 254],
  amber: [180, 83, 9],
  amberMuda: [254, 243, 199],
  hijauPucat: [209, 250, 229],
  slate900: [23, 32, 51],
  slate500: [100, 116, 139],
  slate400: [148, 163, 184],
  slate200: [226, 232, 240],
  zebra: [244, 247, 246],
  putih: [255, 255, 255],
}

function selisihHari(tglIso) {
  if (!tglIso) return null
  const target = new Date(`${tglIso}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const kini = new Date()
  kini.setHours(0, 0, 0, 0)
  return Math.round((target - kini) / 86400000)
}

function tglSingkat(tglIso) {
  const d = new Date(`${tglIso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return tglIso ?? '—'
  return `${String(d.getDate()).padStart(2, '0')} ${BULAN[d.getMonth()].slice(0, 3)}`
}

export async function ambilDataLaporan(uid, bulan, tahun) {
  const { db } = getFirebase()
  const start = iso(tahun, bulan, 1)
  const end = iso(tahun, bulan, new Date(tahun, bulan + 1, 0).getDate())
  const user = (nama) => collection(db, 'users', uid, nama)

  const [txSnap, akunSnap, katSnap, utangSnap, budgetSnap] = await Promise.all([
    getDocs(query(user('transaksi'), where('deleted', '==', false), where('tanggal', '>=', start), where('tanggal', '<=', end))),
    getDocs(query(user('akun'), where('deleted', '==', false))),
    getDocs(query(user('kategori'), where('deleted', '==', false))),
    getDocs(query(user('utang'), where('deleted', '==', false))),
    getDocs(query(user('budget'), where('deleted', '==', false), where('bulan', '==', bulan), where('tahun', '==', tahun))),
  ])

  const akun = Object.fromEntries(akunSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))
  const kategori = Object.fromEntries(katSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))
  const transaksi = txSnap.docs
    .map((d) => {
      const t = { id: d.id, ...d.data() }
      const namaAkun = t.jenis === 'pindah saldo'
        ? `${akun[t.dariId]?.nama ?? akun[t.akunId]?.nama ?? '—'} > ${akun[t.keId]?.nama ?? '—'}`
        : akun[t.akunId]?.nama || '—'
      return {
        ...t,
        kategoriNama: t.jenis === 'pindah saldo' ? 'Pindah Saldo' : kategori[t.kategoriId]?.nama || 'Lainnya',
        akunNama: namaAkun,
      }
    })
    .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))
  const budgets = budgetSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const utangSemua = utangSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  let pemasukan = 0, pengeluaran = 0
  const kategoriIn = {}, kategoriOut = {}
  for (const t of transaksi) {
    if (t.jenis === 'pemasukan') {
      pemasukan += t.jumlah || 0
      kategoriIn[t.kategoriNama] = (kategoriIn[t.kategoriNama] || 0) + (t.jumlah || 0)
    } else if (t.jenis === 'pengeluaran') {
      pengeluaran += t.jumlah || 0
      kategoriOut[t.kategoriNama] = (kategoriOut[t.kategoriNama] || 0) + (t.jumlah || 0)
    }
  }
  const topIn = Object.entries(kategoriIn).sort((a, b) => b[1] - a[1])
  const topOut = Object.entries(kategoriOut).sort((a, b) => b[1] - a[1])

  const utangAktif = utangSemua
    .filter((u) => u.status !== 'Lunas' && (Number(u.sisa) || 0) > 0)
    .map((u) => ({ ...u, hari: selisihHari(u.tglJatuhTempo) }))
  const totalUtangAktif = utangAktif.reduce((s, u) => s + (Number(u.sisa) || 0), 0)
  const cicilanPerBulan = utangAktif.reduce((s, u) => s + (Number(u.cicilanPerBulan) || 0), 0)
  const perluPerhatian = utangAktif.filter((u) => u.hari !== null && u.hari <= 14).sort((a, b) => a.hari - b.hari)

  return {
    bulan, tahun, label: `${BULAN[bulan]} ${tahun}`,
    transaksi, akun, kategori, budgets,
    pemasukan, pengeluaran, saldo: pemasukan - pengeluaran,
    totalSaldo: Object.values(akun).reduce((s, a) => s + (Number(a.saldo) || 0), 0),
    totalBudget: budgets.reduce((s, b) => s + (Number(b.limitNominal) || 0), 0),
    topIn, topOut,
    utang: {
      aktif: utangAktif,
      totalAktif: totalUtangAktif,
      cicilanPerBulan,
      perluPerhatian,
      terlambat: perluPerhatian.filter((u) => u.hari < 0),
      mendekati: perluPerhatian.filter((u) => u.hari >= 0),
    },
  }
}

function labelJatuhTempo(hari) {
  if (hari === null) return 'Tanpa jatuh tempo'
  if (hari < 0) return `Terlambat ${Math.abs(hari)} hari`
  if (hari === 0) return 'Jatuh tempo hari ini'
  return `H-${hari}`
}

// ===== Helper gambar =====
function bulatIsi(doc, x, y, w, h, r, warna) {
  doc.setFillColor(...warna)
  doc.roundedRect(x, y, w, h, r, r, 'F')
}

function bulatGaris(doc, x, y, w, h, r, isi, garis) {
  doc.setFillColor(...isi)
  doc.setDrawColor(...garis)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, r, r, 'FD')
}

function teks(doc, str, x, y, { size = 9, warna = C.slate900, bold = false, align = 'left' } = {}) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...warna)
  doc.text(String(str), x, y, { align })
}

/**
 * Bangun PDF laporan memakai jsPDF + AutoTable.
 * Pendekatan ini menggantikan cetak-HTML lewat iframe: hasil selalu presisi,
 * tanpa header/footer bawaan browser, dan tabel panjang otomatis dipecah rapi
 * dengan header berulang plus nomor halaman sendiri.
 */
export async function buatPdfLaporan(data, pakaiAI, nama = 'Pengguna') {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableMod.default ?? autoTableMod.autoTable

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 14
  const lebar = W - M * 2
  let y = M

  // ================= HEADER =================
  const hHeader = 26
  bulatIsi(doc, M, y, lebar, hHeader, 4, C.hijau)
  // Tile logo celengan (gambar vektor bersih tanpa font ikon)
  const cx = M + 12.5
  const cy = y + 13
  bulatIsi(doc, M + 5, y + 5.5, 15, 15, 3.5, C.hijauTua)
  doc.setFillColor(...C.putih)
  // badan + telinga + moncong (celengan menghadap kiri)
  doc.ellipse(cx, cy, 5, 3.8, 'F')
  doc.ellipse(cx + 2.3, cy - 3.6, 1.1, 0.9, 'F')
  doc.roundedRect(cx - 5.2, cy - 1.4, 2, 2.6, 0.9, 0.9, 'F')
  // kaki
  doc.roundedRect(cx - 2.1, cy + 3.2, 1.7, 2.1, 0.4, 0.4, 'F')
  doc.roundedRect(cx + 2.2, cy + 3.2, 1.7, 2.1, 0.4, 0.4, 'F')
  // slot koin (gelap) + mata
  doc.setFillColor(...C.hijauTua)
  doc.roundedRect(cx - 1.4, cy - 4.6, 2.6, 0.9, 0.4, 0.4, 'F')
  doc.circle(cx + 1.7, cy - 1.2, 0.55, 'F')

  teks(doc, 'MyDuit', M + 24, y + 12, { size: 16, bold: true, warna: C.putih })
  teks(doc, 'Catat - Pantau - Kendalikan', M + 24, y + 17.5, { size: 8, warna: [214, 233, 224] })
  teks(doc, nama, W - M - 5, y + 10, { size: 9, bold: true, warna: C.putih, align: 'right' })
  teks(doc, data.label, W - M - 5, y + 15, { size: 8, warna: [214, 233, 224], align: 'right' })
  teks(doc, `Dibuat ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date())}`, W - M - 5, y + 19.5, { size: 7.5, warna: [190, 216, 204], align: 'right' })
  y += hHeader + 8

  teks(doc, 'Laporan Keuangan Bulanan', M, y, { size: 14, bold: true })
  y += 5
  teks(doc, `Ringkasan aktivitas keuangan dan kewajiban utang untuk ${data.label}.`, M, y, { size: 8.5, warna: C.slate500 })
  y += 7

  // ================= 3 KARTU RINGKASAN =================
  const gap = 4
  const wKartu = (lebar - gap * 2) / 3
  const hKartu = 20
  const kartu = [
    ['PEMASUKAN', rp(data.pemasukan), C.hijauTeks],
    ['PENGELUARAN', rp(data.pengeluaran), C.merah],
    ['SALDO BERSIH', rp(data.saldo), C.biru],
  ]
  kartu.forEach(([label, nilai, warna], i) => {
    const x = M + i * (wKartu + gap)
    bulatGaris(doc, x, y, wKartu, hKartu, 3, C.zebra, C.slate200)
    teks(doc, label, x + 4, y + 7, { size: 7, bold: true, warna: C.slate500 })
    teks(doc, nilai, x + 4, y + 15, { size: 12, bold: true, warna })
  })
  y += hKartu + 9

  // ================= RINGKASAN UTANG =================
  const u = data.utang
  teks(doc, 'Ringkasan Utang', M, y, { size: 11, bold: true })
  teks(doc, `${u.aktif.length} utang aktif`, W - M, y, { size: 8, warna: C.slate500, align: 'right' })
  y += 3
  doc.setDrawColor(...C.slate200)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)
  y += 5

  const hUtang = 22
  const wKiri = lebar * 0.56
  bulatGaris(doc, M, y, wKiri, hUtang, 3, [255, 245, 245], [254, 202, 202])
  teks(doc, 'TOTAL UTANG AKTIF', M + 4, y + 6, { size: 7, bold: true, warna: C.slate500 })
  teks(doc, rp(u.totalAktif), M + 4, y + 13.5, { size: 13, bold: true, warna: C.merah })
  teks(doc, `Cicilan rutin ${rp(u.cicilanPerBulan)} / bulan`, M + 4, y + 18.5, { size: 7.5, warna: C.slate500 })

  const wMini = (lebar - wKiri - gap - gap) / 2
  const xMini = M + wKiri + gap
  bulatIsi(doc, xMini, y, wMini, hUtang, 3, C.merahMuda)
  teks(doc, String(u.terlambat.length), xMini + wMini / 2, y + 11, { size: 14, bold: true, warna: C.merahTeks, align: 'center' })
  teks(doc, 'Terlambat', xMini + wMini / 2, y + 17, { size: 7, bold: true, warna: C.merahTeks, align: 'center' })

  const xMini2 = xMini + wMini + gap
  bulatIsi(doc, xMini2, y, wMini, hUtang, 3, C.amberMuda)
  teks(doc, String(u.mendekati.length), xMini2 + wMini / 2, y + 11, { size: 14, bold: true, warna: C.amber, align: 'center' })
  teks(doc, 'Mendekati H-14', xMini2 + wMini / 2, y + 17, { size: 7, bold: true, warna: C.amber, align: 'center' })
  y += hUtang + 5

  const daftarUtang = u.perluPerhatian.slice(0, 4)
  if (daftarUtang.length) {
    const wItem = (lebar - gap) / 2
    daftarUtang.forEach((x, i) => {
      const kol = i % 2
      const baris = Math.floor(i / 2)
      const px = M + kol * (wItem + gap)
      const py = y + baris * 13
      const telat = x.hari < 0
      bulatGaris(doc, px, py, wItem, 11, 2.5, telat ? [255, 247, 247] : [255, 253, 244], telat ? [254, 202, 202] : [253, 230, 138])
      doc.setFillColor(...(telat ? C.merah : [245, 158, 11]))
      doc.circle(px + 4, py + 5.5, 1.1, 'F')
      teks(doc, String(x.namaPihak ?? '—').slice(0, 22), px + 7, py + 4.8, { size: 8, bold: true })
      teks(doc, labelJatuhTempo(x.hari), px + 7, py + 8.8, { size: 6.8, warna: C.slate500 })
      teks(doc, rp(x.sisa), px + wItem - 3, py + 6.8, { size: 8, bold: true, align: 'right' })
    })
    y += Math.ceil(daftarUtang.length / 2) * 13 + 4
  } else {
    bulatGaris(doc, M, y, lebar, 11, 2.5, [240, 253, 244], [187, 247, 208])
    doc.setFillColor(16, 185, 129)
    doc.circle(M + 4, y + 5.5, 1.1, 'F')
    teks(doc, 'Semua terkendali', M + 7, y + 4.8, { size: 8, bold: true })
    teks(doc, 'Tidak ada kewajiban dalam H-14', M + 7, y + 8.8, { size: 6.8, warna: C.slate500 })
    y += 15
  }

  // ================= ARUS PER KATEGORI =================
  y += 3
  teks(doc, 'Arus per Kategori', M, y, { size: 11, bold: true })
  teks(doc, `${data.topIn.length + data.topOut.length} kategori aktif`, W - M, y, { size: 8, warna: C.slate500, align: 'right' })
  y += 3
  doc.line(M, y, W - M, y)
  y += 5

  const kolomKat = (lebar - gap) / 2
  const dataKat = [
    { judul: 'Pemasukan per Kategori', items: data.topIn.slice(0, 6), warna: C.hijauTeks, kosong: 'Belum ada pemasukan.' },
    { judul: 'Pengeluaran per Kategori', items: data.topOut.slice(0, 6), warna: C.merah, kosong: 'Belum ada pengeluaran.' },
  ]
  const tinggiKat = 14 + Math.max(1, ...dataKat.map((k) => k.items.length || 1)) * 9

  // Pastikan blok kategori tidak terpotong tepi halaman.
  const Hhal = doc.internal.pageSize.getHeight()
  if (y + tinggiKat > Hhal - 22) {
    doc.addPage()
    y = M
  }

  dataKat.forEach((kol, i) => {
    const x = M + i * (kolomKat + gap)
    bulatGaris(doc, x, y, kolomKat, tinggiKat, 3, [251, 253, 252], C.slate200)
    teks(doc, kol.judul, x + 4, y + 7, { size: 8.5, bold: true, warna: kol.warna })
    if (!kol.items.length) {
      teks(doc, kol.kosong, x + 4, y + 16, { size: 8, warna: C.slate400 })
      return
    }
    const maks = Math.max(...kol.items.map(([, n]) => n))
    kol.items.forEach(([namaKat, total], j) => {
      const by = y + 14 + j * 9
      teks(doc, String(namaKat).slice(0, 20), x + 4, by, { size: 7.6 })
      teks(doc, rp(total), x + kolomKat - 4, by, { size: 7.6, warna: C.slate500, align: 'right' })
      const wTrack = kolomKat - 8
      bulatIsi(doc, x + 4, by + 1.6, wTrack, 1.8, 0.9, [231, 238, 235])
      bulatIsi(doc, x + 4, by + 1.6, Math.max(1.8, (total / maks) * wTrack), 1.8, 0.9, kol.warna)
    })
  })
  y += tinggiKat + 10

  // ================= TABEL TRANSAKSI =================
  teks(doc, 'Rincian Transaksi', M, y, { size: 11, bold: true })
  teks(doc, `${data.transaksi.length} transaksi - ${data.label}`, W - M, y, { size: 8, warna: C.slate500, align: 'right' })
  y += 4

  const body = data.transaksi.map((t) => {
    const pindah = t.jenis === 'pindah saldo'
    const tanda = t.jenis === 'pemasukan' ? '+' : t.jenis === 'pengeluaran' ? '-' : ''
    const label = pindah ? 'Pindah Saldo' : t.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'
    return [tglSingkat(t.tanggal), label, t.kategoriNama, t.catatan || '—', t.akunNama, `${tanda}${rp(t.jumlah)}`]
  })

  autoTable(doc, {
    startY: y,
    head: [['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Akun', 'Nominal']],
    body: body.length ? body : [['—', '—', '—', 'Belum ada transaksi pada periode ini.', '—', '—']],
    margin: { left: M, right: M, top: M, bottom: 18 },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 7.4, cellPadding: { top: 2, right: 2, bottom: 2, left: 2 }, textColor: C.slate900, lineColor: [232, 239, 236], lineWidth: 0.1, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: C.hijau, textColor: C.putih, fontStyle: 'bold', fontSize: 7, halign: 'left' },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 21 },
      2: { cellWidth: 28 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 30 },
      5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (hook) => {
      if (hook.section !== 'body') return
      const jenis = String(hook.row.raw?.[1] ?? '')
      if (hook.column.index === 1 || hook.column.index === 5) {
        if (jenis === 'Pemasukan') hook.cell.styles.textColor = C.hijauTeks
        else if (jenis === 'Pengeluaran') hook.cell.styles.textColor = C.merah
        else if (jenis === 'Pindah Saldo') hook.cell.styles.textColor = C.biru
      }
      if (hook.column.index === 1) hook.cell.styles.fontStyle = 'bold'
    },
  })
  y = doc.lastAutoTable.finalY + 10

  // ================= REKOMENDASI AI =================
  if (pakaiAI) {
    const H = doc.internal.pageSize.getHeight()
    const rasio = data.pemasukan > 0 ? Math.round((data.saldo / data.pemasukan) * 100) : 0
    const blok = [
      ['KONDISI', `Rasio tabungan periode ini sekitar ${rasio}%. Analisis AI personal tersedia setelah fitur AI diaktifkan.`],
      ['HEMAT DI SINI', data.topOut[0] ? `Pengeluaran terbesar ada pada ${data.topOut[0][0]}.` : 'Belum cukup data untuk menentukan area penghematan.'],
      ['PRIORITAS ALOKASI', u.totalAktif > 0 ? `Sisa utang aktif ${rp(u.totalAktif)} akan diperhitungkan dalam prioritas dana.` : 'Tidak ada kewajiban utang aktif pada periode ini.'],
    ]

    const wBlok = (lebar - 8 - gap * 2) / 3
    // Hitung tinggi tiap blok dari pecahan teks supaya TIDAK meluber.
    const pecahan = blok.map(([, isi]) => doc.splitTextToSize(isi, wBlok - 6))
    const hBlok = 16 + Math.max(...pecahan.map((p) => p.length)) * 2.9
    const tinggiAI = 16 + hBlok + 5

    if (y + tinggiAI > H - 20) {
      doc.addPage()
      y = M
    }
    bulatGaris(doc, M, y, lebar, tinggiAI, 3.5, [251, 253, 252], [207, 226, 216])
    bulatIsi(doc, M, y, lebar, 14, 3.5, C.hijau)
    doc.setFillColor(255, 255, 255)
    doc.circle(M + 8, y + 7, 3.4, 'F')
    teks(doc, 'AI', M + 8, y + 8.5, { size: 6.6, bold: true, warna: C.hijau, align: 'center' })
    teks(doc, 'Rekomendasi AI', M + 14, y + 6.5, { size: 9.5, bold: true, warna: C.putih })
    teks(doc, 'Analisis keuangan otomatis', M + 14, y + 11, { size: 7, warna: [214, 233, 224] })
    teks(doc, 'SEGERA HADIR', W - M - 4, y + 8.5, { size: 6.6, bold: true, warna: [214, 233, 224], align: 'right' })

    blok.forEach(([judul, isi], i) => {
      const x = M + 4 + i * (wBlok + gap)
      bulatIsi(doc, x, y + 18, wBlok, hBlok, 2.5, C.zebra)
      teks(doc, judul, x + 3, y + 23, { size: 6.4, bold: true, warna: C.hijau })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.8)
      doc.setTextColor(...C.slate500)
      doc.text(pecahan[i], x + 3, y + 27.5)
    })
    teks(doc, 'Konten di atas adalah pratinjau visual, bukan rekomendasi AI final.', M + 4, y + tinggiAI - 2.5, { size: 6.4, warna: C.slate400 })
  }

  // ================= FOOTER TIAP HALAMAN =================
  const total = doc.getNumberOfPages()
  const H = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setDrawColor(...C.slate200)
    doc.setLineWidth(0.3)
    doc.line(M, H - 12, W - M, H - 12)
    teks(doc, 'MyDuit - Laporan pribadi dan rahasia', M, H - 8, { size: 7, warna: C.slate400 })
    teks(doc, `Halaman ${i} dari ${total}`, W - M, H - 8, { size: 7, warna: C.slate400, align: 'right' })
  }

  return doc
}

export async function unduhLaporanPdf(data, pakaiAI, nama) {
  const doc = await buatPdfLaporan(data, pakaiAI, nama)
  doc.save(`Laporan-MyDuit-${data.label.replace(/\s+/g, '-')}.pdf`)
}
