import { useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { onSnapshot, query, where, orderBy, collection, getDocs } from 'firebase/firestore'
import { getFirebase } from '../../lib/firebase.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'
import { detectCurrency, detectLocale, formatCurrency, formatNominal, formatRupiah, simbolUang, EVENT_LOKASI } from '../../lib/format.js'

const NAMA_BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const NAMA_BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function rangeBulan(tahun, bulanIdx) {
  const awal = new Date(tahun, bulanIdx, 1)
  const akhir = new Date(tahun, bulanIdx + 1, 0)
  return { start: fmt(awal), end: fmt(akhir) }
}

function rangeTahun(tahun) {
  return { start: `${tahun}-01-01`, end: `${tahun}-12-31` }
}

// Streak = berapa hari BERURUTAN user mencatat transaksi, dari tanggal unik
// (persis hitungStreak_ GAS). Hari ini belum catat -> mulai dari kemarin.
function hitungStreak_(tanggalList) {
  const set = new Set(tanggalList.map((d) => String(d || '').slice(0, 10)).filter(Boolean))
  if (!set.size) return { streak: 0, last: '' }
  let last = ''
  set.forEach((d) => { if (d > last) last = d })
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const cursor = new Date()
  if (!set.has(iso(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!set.has(iso(cursor))) return { streak: 0, last }
  }
  let streak = 0
  while (set.has(iso(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return { streak, last }
}

export default function StatistikView({ user }) {
  const uid = user.uid
  const { akunList, kategoriList } = useAkunKategori(uid)
  const katById = useMemo(() => Object.fromEntries(kategoriList.map((k) => [k.id, k.nama])), [kategoriList])
  const akunById = useMemo(() => Object.fromEntries(akunList.map((a) => [a.id, a])), [akunList])

  const [mode, setMode] = useState('bulanan') // 'bulanan' | 'tahunan'
  const [bulan, setBulan] = useState(new Date().getMonth())
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const [detail, setDetail] = useState(null) // {kategori, items, total, jenis, label}

  // Deteksi currency & locale pengguna: pilihan lokasi manual (foto profil →
  // modal Lokasi) menang atas timezone perangkat. Nilai disimpan di window agar
  // bisa dibaca kapan pun oleh chart; `kursVer` memicu chart re-render saat ganti.
  const [kursVer, setKursVer] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sync = () => {
      window.__MYDUIT_LOCALE__ = detectLocale()
      window.__MYDUIT_CURRENCY__ = detectCurrency(navigator.language || 'id-ID')
      setKursVer((v) => v + 1)
    }
    sync()
    window.addEventListener(EVENT_LOKASI, sync)
    return () => window.removeEventListener(EVENT_LOKASI, sync)
  }, [])

  // Fetch range aktif — onSnapshot supaya offline persistence langsung serve dari cache
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const range = useMemo(() => (mode === 'bulanan' ? rangeBulan(tahun, bulan) : rangeTahun(tahun)), [mode, bulan, tahun])
  useEffect(() => {
    if (!uid) return
    setLoading(true)
    setError('')
    const { db } = getFirebase()
    const q = query(
      collection(db, 'users', uid, 'transaksi'),
      where('deleted', '==', false),
      where('tanggal', '>=', range.start),
      where('tanggal', '<=', range.end),
      orderBy('tanggal', 'desc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (e) => {
        setError(e?.message ?? String(e))
        setDocs([])
        setLoading(false)
      },
    )
    return () => unsub()
  }, [uid, range.start, range.end])

  // Hitung agregat
  const ringkas = useMemo(() => {
    let in_ = 0, out = 0
    const grupIn = {}, grupOut = {}
    const harian = {} // untuk tren bulanan: {yyyy-mm-dd: {in,out,saldo}}
    const bulanan = {} // untuk tren tahunan: {yyyy-mm: {in,out,saldo}}
    for (const t of docs) {
      const j = t.jenis === 'pemasukan' ? 'pemasukan' : t.jenis === 'pengeluaran' ? 'pengeluaran' : null
      if (!j) continue
      const n = t.jumlah || 0
      const kId = t.kategoriId || 'Lainnya'
      if (j === 'pemasukan') {
        in_ += n
        grupIn[kId] = (grupIn[kId] || 0) + n
      } else {
        out += n
        grupOut[kId] = (grupOut[kId] || 0) + n
      }
      const tgl = (t.tanggal || '').slice(0, 10)
      const bulanKey = tgl.slice(0, 7)
      harian[tgl] = harian[tgl] || { in: 0, out: 0 }
      harian[tgl][j === 'pemasukan' ? 'in' : 'out'] += n
      bulanan[bulanKey] = bulanan[bulanKey] || { in: 0, out: 0 }
      bulanan[bulanKey][j === 'pemasukan' ? 'in' : 'out'] += n
    }
    const toArr = (m) =>
      Object.entries(m)
        .map(([id, total]) => ({ id, nama: katById[id] || 'Lainnya', total }))
        .sort((a, b) => b.total - a.total)
    return {
      in_, out, saldo: in_ - out,
      pemasukan: toArr(grupIn),
      pengeluaran: toArr(grupOut),
      harian, bulanan,
    }
  }, [docs, katById])

  // Tren bulanan: per-hari dalam bulan aktif (label "Tren Bulan Ini")
  // Tren tahunan: 12 bulan (label "Tren Tahun Ini")
  // Saldo per titik = pemasukan - pengeluaran pada titik tsb (BUKAN kumulatif).
  const tren = useMemo(() => {
    const fullD = (dd) => `${dd} ${NAMA_BULAN_SINGKAT[bulan]} ${tahun}`
    const fullM = (mi) => `${NAMA_BULAN_SINGKAT[mi]} ${tahun}`
    if (mode === 'bulanan') {
      const labels = []
      const titles = []
      const dataIn = [], dataOut = [], dataSaldo = []
      const last = new Date(tahun, bulan + 1, 0).getDate()
      for (let d = 1; d <= last; d++) {
        const iso = `${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        labels.push(d)
        titles.push(fullD(d))
        const h = ringkas.harian[iso] || { in: 0, out: 0 }
        dataIn.push(h.in)
        dataOut.push(h.out)
        dataSaldo.push(h.in - h.out)
      }
      return { labels, titles, dataIn, dataOut, dataSaldo }
    }
    // tahunan
    const labels = NAMA_BULAN_SINGKAT
    const titles = NAMA_BULAN_SINGKAT.map((_, i) => fullM(i))
    const dataIn = [], dataOut = [], dataSaldo = []
    for (let i = 0; i < 12; i++) {
      const key = `${tahun}-${String(i + 1).padStart(2, '0')}`
      const h = ringkas.bulanan[key] || { in: 0, out: 0 }
      dataIn.push(h.in)
      dataOut.push(h.out)
      dataSaldo.push(h.in - h.out)
    }
    return { labels, titles, dataIn, dataOut, dataSaldo }
  }, [mode, tahun, bulan, ringkas.harian, ringkas.bulanan])

  // Rata-rata harian (bulanan) / bulanan (tahunan) untuk kartu "Rata-rata"
  const totalHari = mode === 'bulanan' ? new Date(tahun, bulan + 1, 0).getDate() : 12
  const rataHarian = mode === 'bulanan' ? Math.round(ringkas.out / totalHari) : Math.round(ringkas.out / 12)

  // Trend % vs periode sebelumnya.
  // PENTING: `docs` HANYA berisi transaksi periode aktif, jadi menyaring periode
  // sebelumnya dari `docs` selalu menghasilkan 0 → persentase selalu "+100%".
  // Karena itu data periode sebelumnya di-fetch terpisah.
  const prevRange = useMemo(() => {
    if (mode === 'bulanan') {
      const prev = bulan === 0 ? { y: tahun - 1, m: 11 } : { y: tahun, m: bulan - 1 }
      return rangeBulan(prev.y, prev.m)
    }
    return rangeTahun(tahun - 1)
  }, [mode, bulan, tahun])

  const [trend, setTrend] = useState({ in_: 0, out: 0, saldo: 0, ada: false })
  useEffect(() => {
    if (!uid) return
    let batal = false
    ;(async () => {
      try {
        const { db } = getFirebase()
        const snap = await getDocs(
          query(
            collection(db, 'users', uid, 'transaksi'),
            where('deleted', '==', false),
            where('tanggal', '>=', prevRange.start),
            where('tanggal', '<=', prevRange.end),
          ),
        )
        if (batal) return
        let in_ = 0, out = 0
        snap.docs.forEach((d) => {
          const t = d.data()
          if (t.jenis === 'pemasukan') in_ += t.jumlah || 0
          else if (t.jenis === 'pengeluaran') out += t.jumlah || 0
        })
        setTrend({ in_, out, saldo: in_ - out, ada: snap.size > 0 })
      } catch (e) {
        console.warn('[trend] gagal:', e?.message ?? e)
        if (!batal) setTrend({ in_: 0, out: 0, saldo: 0, ada: false })
      }
    })()
    return () => { batal = true }
  }, [uid, prevRange.start, prevRange.end])

  // null = tidak ada pembanding (periode sebelumnya kosong) → jangan tampilkan persen palsu.
  function pctBaru(baru, lama) {
    if (!trend.ada) return null
    if (lama === 0) return baru > 0 ? null : 0
    return Math.round(((baru - lama) / lama) * 100)
  }
  const pctIn = pctBaru(ringkas.in_, trend.in_)
  const pctOut = pctBaru(ringkas.out, trend.out)
  const pctSaldo = pctBaru(ringkas.saldo, trend.saldo)
  const labelBanding = mode === 'bulanan' ? 'vs bulan sebelumnya' : 'vs tahun sebelumnya'

  // Period navigator — batas: tidak bisa masa depan (sesuai GAS), retensi 1 tahun ke belakang
  // (tahun ini + 1 tahun sebelum; mis. 2026 → maksimal mundur ke 2025). Halaman detail
  // riwayat Transaksi punya kebijakan retensi lebih panjang; khusus tab Statistik
  // dibatasi hanya 1 tahun karena grafik tahunan untuk rentang lebih panjang sulit
  // dibaca & jarang dibutuhkan.
  const bisaMundur = mode === 'tahunan' ? tahun > new Date().getFullYear() - 1 : true
  const bisaMaju = mode === 'bulanan'
    ? !(tahun === new Date().getFullYear() && bulan >= new Date().getMonth())
    : tahun < new Date().getFullYear()

  function navigate(dir) {
    if (mode === 'bulanan') {
      let b = bulan + dir, th = tahun
      if (b < 0) { b = 11; th-- }
      else if (b > 11) { b = 0; th++ }
      // Cegah masa depan
      if (th > new Date().getFullYear() || (th === new Date().getFullYear() && b > new Date().getMonth())) return
      setBulan(b); setTahun(th)
    } else {
      const th = tahun + dir
      if (th > new Date().getFullYear() || th < new Date().getFullYear() - 1) return
      setTahun(th)
    }
  }

  // Chart.js line chart
  const chartRef = useRef(null)
  const chartInst = useRef(null)
  useEffect(() => {
    if (!chartRef.current) return
    if (chartInst.current) {
      chartInst.current.destroy()
      chartInst.current = null
    }
    const ctx = chartRef.current.getContext('2d')
    const kur = typeof window !== 'undefined' ? window.__MYDUIT_CURRENCY__ || 'IDR' : 'IDR'
    const loc = typeof window !== 'undefined' ? window.__MYDUIT_LOCALE__ || 'id-ID' : 'id-ID'
    chartInst.current = new Chart(ctx, {
      data: {
        labels: tren.labels,
        datasets: [
          { type: 'bar', label: 'Pemasukan', data: tren.dataIn, backgroundColor: 'rgba(16,185,129,.55)', hoverBackgroundColor: 'rgba(16,185,129,.75)', borderRadius: 4, borderSkipped: false, maxBarThickness: 22, order: 2 },
          { type: 'bar', label: 'Pengeluaran', data: tren.dataOut.map((v) => -v), backgroundColor: 'rgba(229,62,62,.55)', hoverBackgroundColor: 'rgba(229,62,62,.75)', borderRadius: 4, borderSkipped: false, maxBarThickness: 22, order: 2 },
          { type: 'line', label: 'Saldo', data: tren.dataSaldo, borderColor: '#1d4ed8', backgroundColor: 'rgba(29,78,216,.12)', tension: 0.35, pointRadius: mode === 'bulanan' ? 2 : 3, pointHoverRadius: 5, pointBackgroundColor: '#1d4ed8', borderWidth: 2, order: 1 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            position: 'nearest',
            callbacks: {
              title: (items) => (items?.[0] ? tren.titles[items[0].dataIndex] ?? items[0].label ?? '' : ''),
              label: (item) => {
                const val = Math.abs(item.parsed.y ?? 0)
                const sign = (item.parsed.y ?? 0) < 0 ? '-' : ''
                return ` ${item.dataset.label}: ${sign}${formatCurrency(val, kur, loc)}`
              },
            },
          },
        },
        scales: {
          x: { stacked: false, grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
          y: {
            grid: { color: 'rgba(148,163,184,.15)' },
            ticks: {
              color: '#94a3b8', font: { size: 10 },
              callback: (v) => formatCurrency(Math.abs(v), kur, loc, { compact: true }),
            },
          },
        },
      },
    })
    return () => {
      chartInst.current?.destroy()
      chartInst.current = null
    }
  }, [tren.labels, tren.titles, tren.dataIn, tren.dataOut, tren.dataSaldo, mode, kursVer])

  function bukaDetailKategori(jenis, kategori) {
    const items = docs
      .filter((t) => t.jenis === (jenis === 'in' ? 'pemasukan' : 'pengeluaran') && (t.kategoriId || 'Lainnya') === kategori.id)
      .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''))
    const labelPeriode = mode === 'bulanan' ? `${NAMA_BULAN_ID[bulan]} ${tahun}` : `Tahun ${tahun}`
    setDetail({
      kategori: kategori.nama,
      items,
      total: kategori.total,
      jenis: jenis === 'in' ? 'pemasukan' : 'pengeluaran',
      labelPeriode,
    })
  }

  // Emit ringkasan ke panel kanan global
  useEffect(() => {
    // Pengeluaran terbesar bulan ini — ambil item pertama (sudah disort desc by total)
    const topExpense = ringkas.pengeluaran[0] || null
    const event = new CustomEvent('myduit:statistik-update', {
      detail: {
        mode,
        bulan, tahun,
        in: ringkas.in_,
        out: ringkas.out,
        saldo: ringkas.saldo,
        rataHarian,
        akunList: akunList.length,
        kategoriAktif: new Set([
          ...ringkas.pemasukan.map((i) => i.id),
          ...ringkas.pengeluaran.map((i) => i.id),
        ]).size,
        jmlTransaksi: docs.length,
        akunById,
        pengeluaranTerbesar: topExpense
          ? { nama: topExpense.nama, total: topExpense.total }
          : null,
      },
    })
    window.dispatchEvent(event)
  }, [mode, bulan, tahun, ringkas.in_, ringkas.out, ringkas.saldo, rataHarian, akunList, akunById, ringkas.pemasukan, ringkas.pengeluaran, docs])

  // Streak Pencatatan -> sidebar kiri. Hitung dari SEMUA tanggal transaksi user
  // (bukan hanya periode aktif) supaya akurat lintas bulan. Fetch sekali per mount.
  useEffect(() => {
    if (!uid) return
    let batal = false
    ;(async () => {
      try {
        const { db } = getFirebase()
        const snap = await getDocs(
          query(collection(db, 'users', uid, 'transaksi'), where('deleted', '==', false)),
        )
        if (batal) return
        const tanggalList = snap.docs.map((d) => d.data().tanggal)
        const { streak, last } = hitungStreak_(tanggalList)
        window.dispatchEvent(new CustomEvent('myduit:sidebar-statistik-update', { detail: { streak, last } }))
      } catch (e) {
        console.warn('[streak] gagal:', e?.message ?? e)
      }
    })()
    return () => { batal = true }
  }, [uid])

  const labelPeriode = mode === 'bulanan' ? `${NAMA_BULAN_ID[bulan]} ${tahun}` : `Tahun ${tahun}`
  const trendTitle = mode === 'bulanan' ? 'Tren Bulan Ini' : 'Tren Tahun Ini'

  return (
    <section className="mx-auto max-w-3xl px-5 pb-32 md:pb-10">
      {/* Header mobile-only (logo + judul + navigator ringkas) — di desktop judul dihilangkan */}
      <header className="flex items-center justify-between pt-4 pb-4 md:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="clay-icon-tile clay-key-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
            <span className="material-symbols-outlined icon-lg" style={{ fontVariationSettings: "'FILL' 1" }}>monitoring</span>
          </div>
          <h2 className="font-display whitespace-nowrap text-2xl font-extrabold leading-tight sm:icon-2xl">Statistik</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Navigasi periode">
          <button
            onClick={() => navigate(-1)}
            disabled={!bisaMundur}
            aria-label="Periode sebelumnya"
            className="clay-pagination-arrow clay-key-neutral flex h-8 w-8 items-center justify-center rounded-full bg-white"
          >
            <span className="material-symbols-outlined icon-sm text-slate-600">chevron_left</span>
          </button>
          <span className="min-w-[68px] text-center text-xs font-bold leading-tight text-slate-800">{labelPeriode}</span>
          <button
            onClick={() => navigate(1)}
            disabled={!bisaMaju}
            aria-label="Periode berikutnya"
            className="clay-pagination-arrow clay-key-neutral flex h-8 w-8 items-center justify-center rounded-full bg-white"
          >
            <span className="material-symbols-outlined icon-sm text-slate-600">chevron_right</span>
          </button>
        </div>
      </header>

      {/* Periode bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 md:pt-5">
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setMode('bulanan')}
            className={`stat-pill-tab clay-chip flex h-9 items-center px-4 text-xs font-semibold transition-colors ${
              mode === 'bulanan'
                ? 'clay-key-primary bg-primary text-white'
                : 'clay-key-neutral bg-surfaceContainerLowest text-textSecondary hover:bg-gray-100'
            }`}
          >
            Bulanan
          </button>
          <button
            onClick={() => setMode('tahunan')}
            className={`stat-pill-tab clay-chip flex h-9 items-center px-4 text-xs font-semibold transition-colors ${
              mode === 'tahunan'
                ? 'clay-key-primary bg-primary text-white'
                : 'clay-key-neutral bg-surfaceContainerLowest text-textSecondary hover:bg-gray-100'
            }`}
          >
            Tahunan
          </button>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={() => navigate(-1)}
            disabled={!bisaMundur}
            aria-label="Periode sebelumnya"
            className="clay-pagination-arrow clay-key-neutral flex h-8 w-8 items-center justify-center rounded-full bg-white"
          >
            <span className="material-symbols-outlined icon-md text-slate-600">chevron_left</span>
          </button>
          <span className="min-w-[120px] text-center text-sm font-bold text-slate-800">{labelPeriode}</span>
          <button
            onClick={() => navigate(1)}
            disabled={!bisaMaju}
            aria-label="Periode berikutnya"
            className="clay-pagination-arrow clay-key-neutral flex h-8 w-8 items-center justify-center rounded-full bg-white"
          >
            <span className="material-symbols-outlined icon-md text-slate-600">chevron_right</span>
          </button>
        </div>
      </div>

      <div className="space-y-5 pb-20 md:pb-4 md:pr-3">
        {/* SUMMARY CARDS (gradient) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            icon="trending_up"
            label="Pemasukan"
            value={ringkas.in_}
            pct={pctIn}
            banding={labelBanding}
            cls="clay-key-primary bg-primary"
          />
          <SummaryCard
            icon="trending_down"
            label="Pengeluaran"
            value={ringkas.out}
            pct={pctOut}
            banding={labelBanding}
            cls="clay-key-danger bg-red-600"
          />
          <SummaryCard
            icon="savings"
            label="Saldo Bersih"
            value={ringkas.saldo}
            pct={pctSaldo}
            banding={labelBanding}
            cls="clay-key-blue bg-blue-600"
          />
        </div>

        {/* TREND CHART */}
        <div className="clay clay-card clay-key-primary rounded-[22px] bg-surfaceContainerLowest p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-800">{trendTitle}</h3>
            <div className="flex items-center gap-3 text-xs">
              <LegendDot color="bg-emerald-500" label="Pemasukan" />
              <LegendDot color="bg-red-500" label="Pengeluaran" />
              <LegendDot color="bg-blue-500" label="Saldo" />
            </div>
          </div>
          <div className="relative h-64 md:h-72">
            <canvas ref={chartRef}></canvas>
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Memuat...</div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                <span className="material-symbols-outlined icon-2xl text-red-400">error</span>
                <p className="text-sm font-semibold text-red-500">Gagal memuat data statistik.</p>
                <p className="max-w-md text-[11px] leading-snug text-slate-500">{error}</p>
              </div>
            ) : ringkas.in_ + ringkas.out === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-slate-400">
                <span className="material-symbols-outlined icon-2xl text-slate-300">query_stats</span>
                <p className="text-sm text-slate-500">Belum ada data transaksi untuk periode ini.</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* BREAKDOWN KATEGORI */}
        <div className="flex flex-wrap items-center justify-between gap-1 px-1">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Breakdown Kategori</h3>
          <span className="hidden text-[10px] text-slate-400 sm:inline">Klik 2x kategori utk detail</span>
        </div>
        <div className="-mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <KategoriCard
            icon="trending_up"
            iconColor="text-emerald-600"
            title="Pemasukan per Kategori"
            items={ringkas.pemasukan}
            total={ringkas.in_}
            jenis="in"
            onDblClick={bukaDetailKategori}
          />
          <KategoriCard
            icon="trending_down"
            iconColor="text-red-600"
            title="Pengeluaran per Kategori"
            items={ringkas.pengeluaran}
            total={ringkas.out}
            jenis="out"
            onDblClick={bukaDetailKategori}
          />
        </div>

        {/* AI RECOMMENDATION */}
        <div
          onDoubleClick={() => alert('Rekomendasi AI akan segera diaktifkan (Fase AI).')}
          className="clay clay-card clay-key-primary cursor-pointer overflow-hidden transition-all hover:-translate-y-0.5"
          title="Ketuk/klik dua kali untuk memuat rekomendasi AI"
        >
          <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)' }}>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <span className="material-symbols-outlined icon-lg text-white">psychology</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white">Rekomendasi AI</h4>
              <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Analisis otomatis dari data keuangan periode ini
              </p>
            </div>
          </div>
          <div className="bg-white px-5 py-4">
            <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
              <span className="material-symbols-outlined icon-md">touch_app</span>
              Ketuk/klik dua kali pada kartu ini untuk memuat rekomendasi AI.
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DETAIL KATEGORI */}
      {detail && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div className="clay-sheet clay-key-primary flex max-h-[85vh] w-full max-w-md flex-col bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-5">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-slate-800">{detail.kategori}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{detail.labelPeriode}</p>
              </div>
              <button onClick={() => setDetail(null)} className="clay-chip clay-key-neutral flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600">
                <span className="material-symbols-outlined icon-lg">close</span>
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto px-5 py-3">
              {detail.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Belum ada transaksi.</p>
              ) : (
                detail.items.map((t) => {
                  const ak = akunById[t.akunId]
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-slate-50">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{t.catatan || t.kategoriNama || detail.kategori}</p>
                        <p className="text-[11px] text-slate-400">{ak?.nama || 'Tunai'} · {t.tanggal}</p>
                      </div>
                      <p className={`shrink-0 font-mono text-sm font-bold ${detail.jenis === 'pemasukan' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {detail.jenis === 'pemasukan' ? '+' : '−'}{simbolUang()}{formatNominal(t.jumlah || 0)}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
            <div className="flex shrink-0 items-center justify-between rounded-b-2xl border-t border-slate-100 bg-slate-50 px-5 py-3">
              <span className="text-xs font-semibold text-slate-500">Total {detail.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</span>
              <span className={`text-sm font-bold ${detail.jenis === 'pemasukan' ? 'text-emerald-600' : 'text-expense'}`}>{formatRupiah(detail.total || 0)}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function SummaryCard({ icon, label, value, pct, cls, banding }) {
  // pct null = tidak ada data pembanding (periode sebelumnya kosong) — jangan
  // menampilkan persen palsu "+100%", ganti teks netral.
  const positif = (pct ?? 0) >= 0
  const iconTrend = pct === null ? 'trending_flat' : positif ? 'trending_up' : 'trending_down'
  return (
    <div className={`clay clay-card ${cls} rounded-[22px] p-4 text-white transition-all hover:-translate-y-0.5`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined icon-md opacity-90" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-90">{label}</p>
      </div>
      <p className="font-mono text-2xl font-extrabold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {simbolUang()} {formatNominal(value || 0)}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium opacity-85">
        <span className="material-symbols-outlined icon-2xs">{iconTrend}</span>
        {pct === null ? 'Belum ada data sebelumnya' : `${pct === 0 ? '0%' : `${positif ? '+' : ''}${pct}%`} ${banding}`}
      </p>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-3 w-3 rounded-full ${color}`}></span>
      {label}
    </span>
  )
}

function KategoriCard({ icon, iconColor, title, items, total, jenis, onDblClick }) {
  const empty = items.length === 0
  const max = Math.max(1, ...items.map((i) => i.total))
  return (
    <div className="clay clay-card clay-key-primary rounded-[22px] bg-surfaceContainerLowest p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`material-symbols-outlined icon-md ${iconColor}`}>{icon}</span>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {empty ? (
        <p className="py-8 text-center text-sm text-slate-500">Belum ada data {jenis === 'in' ? 'pemasukan' : 'pengeluaran'} untuk periode ini.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const pct = Math.round((it.total / max) * 100)
            const pctTotal = total > 0 ? Math.round((it.total / total) * 100) : 0
            const barColor = jenis === 'in' ? 'bg-emerald-500' : 'bg-red-500'
            return (
              <div
                key={it.id}
                onDoubleClick={() => onDblClick(jenis, it)}
                className="cursor-pointer rounded-lg px-2 py-1 transition-colors hover:bg-slate-50"
                title="Klik 2x untuk melihat detail transaksi"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="truncate text-slate-700">{it.nama}</span>
                  <span className="text-slate-500">{pctTotal}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }}></div>
                </div>
                <p className="mt-0.5 text-right font-mono text-[10px] font-bold text-slate-500">{formatRupiah(it.total || 0)}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
