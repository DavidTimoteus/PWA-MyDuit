import { useMemo } from 'react'
import { formatRupiah, isoHariIni, tanggalPendek } from '../../lib/format.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'
import { useTransaksi } from '../transaksi/useTransaksi.js'

const WARNA_KATEGORI = [
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
]

function warnaKategori(nama) {
  let h = 0
  for (const c of String(nama)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return WARNA_KATEGORI[h % WARNA_KATEGORI.length]
}

export default function RightPanel({ uid }) {
  const { akunList } = useAkunKategori(uid)
  const { docs: transaksiHariIni } = useTransaksi(uid, { range: { start: isoHariIni(), end: isoHariIni() }, jenis: 'pengeluaran' })

  const totalSaldo = useMemo(() => akunList.reduce((s, a) => s + (Number(a.saldo) || 0), 0), [akunList])

  const pengeluaranHariIni = useMemo(() => transaksiHariIni.reduce((s, t) => s + (t.jumlah || 0), 0), [transaksiHariIni])

  const topKategori = useMemo(() => {
    const map = {}
    for (const t of transaksiHariIni) {
      const k = t.kategoriNama || 'Lainnya'
      map[k] = (map[k] || 0) + (t.jumlah || 0)
    }
    return Object.entries(map)
      .map(([nama, total]) => ({ nama, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
  }, [transaksiHariIni])

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-80 lg:shrink-0 lg:px-2">
      <div className="clay clay-card clay-key-primary bg-white flex flex-col h-full rounded-[28px] p-4 lg:p-5">
        {/* Ringkasan */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ringkasan</h3>

          <div className="clay clay-card clay-key-neutral bg-white rounded-[18px] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total Semua Saldo</p>
            <p className="mt-1 font-mono font-extrabold text-xl text-slate-800">{formatRupiah(totalSaldo)}</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-500">{akunList.length} rekening</p>
          </div>

          <div className="clay clay-card clay-key-danger bg-white rounded-[18px] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Pengeluaran Hari Ini</p>
            <p className="mt-1 font-mono font-extrabold text-xl text-expense">{formatRupiah(pengeluaranHariIni)}</p>
            {pengeluaranHariIni === 0 && <p className="mt-1 text-[10px] font-semibold text-slate-400">Belum ada catatan hari ini</p>}
          </div>

          <div className="clay clay-card clay-key-blue bg-white rounded-[18px] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Kategori Teratas Hari Ini</p>
            {topKategori.length === 0 ? (
              <p className="mt-1 text-sm font-semibold text-slate-400">—</p>
            ) : (
              <div className="mt-2 space-y-2">
                {topKategori.map((k, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${warnaKategori(k.nama)}`}>
                      {k.nama.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{k.nama}</p>
                      <p className="text-[10px] font-semibold text-slate-500">{formatRupiah(k.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-slate-200/70 my-4"></div>

        {/* Aksi Cepat */}
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Aksi Cepat</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="clay clay-btn clay-key-primary flex flex-col items-center gap-1 px-3 py-4 rounded-[18px] bg-gradient-to-br from-primary to-emerald-700 text-white text-[11px] font-semibold transition-all">
            <span className="material-symbols-outlined text-[22px]">add_circle</span>
            Pemasukan
          </button>
          <button className="clay clay-btn clay-key-danger flex flex-col items-center gap-1 px-3 py-4 rounded-[18px] bg-gradient-to-br from-red-500 to-red-700 text-white text-[11px] font-semibold transition-all">
            <span className="material-symbols-outlined text-[22px]">remove_circle</span>
            Pengeluaran
          </button>
          <button className="clay clay-btn clay-key-blue flex flex-col items-center gap-1 px-3 py-4 rounded-[18px] bg-gradient-to-br from-blue-500 to-blue-700 text-white text-[11px] font-semibold transition-all">
            <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
            Pindah Saldo
          </button>
          <button className="clay clay-btn clay-key-neutral flex flex-col items-center gap-1 px-3 py-4 rounded-[18px] bg-white text-slate-700 text-[11px] font-semibold transition-all">
            <span className="material-symbols-outlined text-[22px]">receipt_long</span>
            Scan Struk
          </button>
        </div>
      </div>
    </aside>
  )
}