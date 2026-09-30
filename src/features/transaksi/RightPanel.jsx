import { useMemo } from 'react'
import { isoHariIni, formatNominal, simbolUang } from '../../lib/format.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'
import { enrichTransaksi } from '../../lib/db.js'
import { useTransaksi } from '../transaksi/useTransaksi.js'

const rp = (n) => `${simbolUang()} ${formatNominal(n)}`

// Bulan berjalan: yyyy-mm-01 .. yyyy-mm-akhir
function rangeBulanIni() {
  const now = new Date()
  const awal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const akhir = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const akhirIso = `${akhir.getFullYear()}-${String(akhir.getMonth() + 1).padStart(2, '0')}-${String(akhir.getDate()).padStart(2, '0')}`
  return { start: awal, end: akhirIso }
}

// Panel kanan "Ringkasan" — markup persis GAS #asideGroupTransaksi:
// Total Saldo (gradient hijau) · Pengeluaran Hari Ini · Top Kategori (badge jenis)
// · Aksi Cepat 3 tombol gradient penuh (Pemasukan/Pengeluaran/Pindah Saldo).
export default function RightPanel({ uid }) {
  const { akunList, kategoriList } = useAkunKategori(uid)
  const bulan = useMemo(rangeBulanIni, [])
  const { docs: transBulan } = useTransaksi(uid, { range: bulan, jenis: 'semua' })
  const { docs: transHariIni } = useTransaksi(uid, {
    range: { start: isoHariIni(), end: isoHariIni() },
    jenis: 'pengeluaran',
  })

  const akunById = useMemo(() => Object.fromEntries(akunList.map((a) => [a.id, a])), [akunList])
  const katById = useMemo(() => Object.fromEntries(kategoriList.map((k) => [k.id, k.nama])), [kategoriList])
  const bulanEnriched = useMemo(() => enrichTransaksi(transBulan, akunById, katById), [transBulan, akunById, katById])

  const totalSaldo = useMemo(() => akunList.reduce((s, a) => s + (Number(a.saldo) || 0), 0), [akunList])

  const arusBulan = useMemo(() => {
    let masuk = 0
    let keluar = 0
    for (const t of bulanEnriched) {
      if (t.jenis === 'pemasukan') masuk += t.jumlah || 0
      else if (t.jenis === 'pengeluaran') keluar += t.jumlah || 0
    }
    return masuk - keluar
  }, [bulanEnriched])

  const pengeluaranHariIni = useMemo(
    () => transHariIni.reduce((s, t) => s + (t.jumlah || 0), 0),
    [transHariIni],
  )

  // Top kategori bulan ini — kategori dgn total terbesar di antara KEDUA jenis
  // (badge menunjukkan jenisnya, persis perilaku GAS summaryTopCategory*).
  const topKategori = useMemo(() => {
    const map = {}
    for (const t of bulanEnriched) {
      if (t.jenis !== 'pemasukan' && t.jenis !== 'pengeluaran') continue
      const key = `${t.jenis}||${t.kategoriNama || 'Lainnya'}`
      map[key] = (map[key] || 0) + (t.jumlah || 0)
    }
    const terbaik = Object.entries(map).sort((a, b) => b[1] - a[1])[0]
    if (!terbaik) return null
    const [jenis, nama] = terbaik[0].split('||')
    return { jenis, nama, total: terbaik[1] }
  }, [bulanEnriched])

  function aksi(type) {
    window.dispatchEvent(new CustomEvent('myduit:aksi-cepat', { detail: { type } }))
  }

  return (
    <aside className="hidden lg:flex lg:h-full lg:w-[350px] lg:min-w-[350px] lg:max-w-[350px] lg:shrink-0 lg:grow-0 lg:flex-col lg:overflow-hidden lg:p-4 lg:pl-2">
      <div className="clay clay-key-primary flex h-full flex-col overflow-hidden rounded-[28px] bg-surfaceContainerLowest p-5 w-full min-w-0">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-1 pb-3">
          <h2 className="text-base font-extrabold tracking-tight text-slate-800">Ringkasan</h2>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('myduit:export-pdf'))}
            aria-label="Export PDF"
            title="Export PDF"
            className="pdf-action-btn clay-key-danger"
          >
            <span className="material-symbols-outlined icon-md">picture_as_pdf</span>
          </button>
        </div>
        <div className="mb-3 h-px shrink-0 bg-slate-200/70"></div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {/* Total Saldo */}
            <div className="clay clay-card clay-key-primary flex flex-col gap-0.5 rounded-[18px] bg-gradient-to-br from-primary to-emerald-700 p-4 text-white">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined icon-sm opacity-90" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-90">Total Saldo</p>
              </div>
              <p className="mt-0.5 font-mono text-xl font-extrabold tracking-tight">{rp(totalSaldo)}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium opacity-80">
                <span className="material-symbols-outlined icon-2xs">trending_up</span>
                {arusBulan < 0 ? '−' : '+'}{simbolUang()}{formatNominal(Math.abs(arusBulan))} bulan ini
              </p>
            </div>

            {/* Pengeluaran Hari Ini */}
            <div className="clay clay-card clay-key-danger flex flex-col gap-0.5 rounded-[18px] bg-surfaceContainerLowest p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined icon-sm text-expense" style={{ fontVariationSettings: "'FILL' 1" }}>today</span>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pengeluaran Hari Ini</p>
              </div>
              <p className="mt-0.5 font-mono text-lg font-extrabold tracking-tight text-expense">{rp(pengeluaranHariIni)}</p>
              <p className="text-[10px] font-medium text-textSecondary">{transHariIni.length} transaksi · Hari ini</p>
            </div>

            {/* Top Kategori */}
            <div className="clay clay-card clay-key-primary flex flex-col gap-0.5 rounded-[18px] bg-surfaceContainerLowest p-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined icon-sm text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>category</span>
                <p className="flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top Kategori</p>
                {topKategori && (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      topKategori.jenis === 'pemasukan' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    }`}
                  >
                    {topKategori.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-base font-extrabold tracking-tight text-slate-800">
                {topKategori ? topKategori.nama : '-'}
              </p>
              <p className={`font-mono text-sm font-extrabold tracking-tight ${topKategori?.jenis === 'pengeluaran' ? 'text-expense' : 'text-emerald-600'}`}>
                {rp(topKategori ? topKategori.total : 0)}
              </p>
            </div>
          </div>

          <div className="my-3 h-px shrink-0 bg-slate-200/70"></div>

          {/* Aksi Cepat */}
          <div className="shrink-0">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Aksi Cepat</p>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => aksi('pemasukan')}
                className="clay-btn clay-key-primary btn-lg w-full bg-gradient-to-br from-primary to-emerald-700 text-white"
              >
                <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                Tambah Pemasukan
              </button>
              <button
                onClick={() => aksi('pengeluaran')}
                className="clay-btn clay-key-danger btn-lg w-full bg-gradient-to-br from-red-500 to-red-700 text-white"
              >
                <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'FILL' 1" }}>remove_circle</span>
                Tambah Pengeluaran
              </button>
              <button
                onClick={() => aksi('pindah-saldo')}
                className="clay-btn clay-key-blue btn-lg w-full bg-gradient-to-br from-blue-500 to-blue-700 text-white"
              >
                <span className="material-symbols-outlined icon-sm" style={{ fontVariationSettings: "'FILL' 1" }}>swap_horiz</span>
                Pindah Saldo
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
