import { useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format.js'
import { useTransaksi } from '../transaksi/useTransaksi.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function KategoriCol({ title, items, totalJenis, warna }) {
  const max = Math.max(1, ...items.map((i) => i.total))
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className={`text-xs font-extrabold uppercase tracking-wide ${warna.text}`}>{title}</p>
      <p className="mb-3 text-sm font-bold text-slate-700">{formatRupiah(totalJenis)}</p>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-300">Belum ada transaksi</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => {
            const pct = Math.round((it.total / max) * 100)
            const pctTotal = totalJenis > 0 ? Math.round((it.total / totalJenis) * 100) : 0
            return (
              <div key={it.id}>
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="truncate text-slate-600">{it.nama}</span>
                  <span className="text-slate-400">{pctTotal}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${warna.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function StatistikView({ user }) {
  const uid = user.uid
  const [bulan, setBulan] = useState(new Date().getMonth())
  const [tahun, setTahun] = useState(new Date().getFullYear())

  const range = useMemo(() => {
    const startD = new Date(tahun, bulan - 5, 1)
    const endD = new Date(tahun, bulan + 1, 0)
    return { start: fmt(startD), end: fmt(endD) }
  }, [bulan, tahun])

  const { docs } = useTransaksi(uid, { range })
  const { kategoriList } = useAkunKategori(uid)
  const katNama = useMemo(() => Object.fromEntries(kategoriList.map((k) => [k.id, k.nama])), [kategoriList])

  const prefixBulan = `${tahun}-${String(bulan + 1).padStart(2, '0')}`

  const ringkas = useMemo(() => {
    let in_ = 0
    let out = 0
    const groups = { pemasukan: {}, pengeluaran: {} }
    for (const t of docs) {
      if (!String(t.tanggal || '').startsWith(prefixBulan)) continue
      const j = t.jenis === 'pemasukan' ? 'pemasukan' : 'pengeluaran'
      groups[j][t.kategoriId] = (groups[j][t.kategoriId] || 0) + (t.jumlah || 0)
      if (j === 'pemasukan') in_ += t.jumlah || 0
      else out += t.jumlah || 0
    }
    const toArr = (m) =>
      Object.entries(m)
        .map(([id, total]) => ({ id, nama: katNama[id] || 'Lainnya', total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8)
    return {
      in_,
      out,
      saldo: in_ - out,
      pemasukan: toArr(groups.pemasukan),
      pengeluaran: toArr(groups.pengeluaran),
    }
  }, [docs, katNama, prefixBulan])

  // Arus 6 bulan (net per bulan)
  const arus6 = useMemo(() => {
    const res = []
    let maxAbs = 1
    for (let i = 5; i >= 0; i--) {
      const d = new Date(tahun, bulan - i, 1)
      const pre = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      let inM = 0
      let outM = 0
      for (const t of docs) {
        if (!String(t.tanggal || '').startsWith(pre)) continue
        if (t.jenis === 'pemasukan') inM += t.jumlah || 0
        else outM += t.jumlah || 0
      }
      const net = inM - outM
      maxAbs = Math.max(maxAbs, Math.abs(net))
      res.push({ label: NAMA_BULAN[d.getMonth()].slice(0, 3), net })
    }
    return { bars: res, maxAbs }
  }, [docs, bulan, tahun])

  function geser(dir) {
    let b = bulan + dir
    let th = tahun
    if (b < 0) {
      b = 11
      th--
    } else if (b > 11) {
      b = 0
      th++
    }
    setBulan(b)
    setTahun(th)
  }

  return (
    <section className="mx-auto max-w-3xl px-5 pb-32 md:pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">Statistik</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => geser(-1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/70 hover:bg-slate-50">
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <p className="min-w-[120px] text-center text-xs font-extrabold text-slate-700">
            {NAMA_BULAN[bulan]} {tahun}
          </p>
          <button onClick={() => geser(1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/70 hover:bg-slate-50">
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Kartu ringkasan */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pemasukan</p>
          <p className="mt-0.5 truncate text-sm font-extrabold text-income">{formatRupiah(ringkas.in_)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pengeluaran</p>
          <p className="mt-0.5 truncate text-sm font-extrabold text-expense">{formatRupiah(ringkas.out)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Saldo</p>
          <p className={`mt-0.5 truncate text-sm font-extrabold ${ringkas.saldo >= 0 ? 'text-slate-800' : 'text-expense'}`}>{formatRupiah(ringkas.saldo)}</p>
        </div>
      </div>

      {/* Arus 6 bulan */}
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-400">Arus Kas 6 Bulan</p>
        <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
          {arus6.bars.map((b, i) => {
            const h = Math.round((Math.abs(b.net) / arus6.maxAbs) * 100)
            const isLast = i === arus6.bars.length - 1
            return (
              <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-md ${b.net >= 0 ? 'bg-emerald-400' : 'bg-expense/70'} ${isLast ? 'ring-2 ring-primary' : ''}`}
                    style={{ height: `${Math.max(4, h)}%` }}
                    title={formatRupiah(b.net)}
                  />
                </div>
                <span className="text-[9px] font-bold text-slate-400">{b.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Breakdown kategori */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KategoriCol title="Pemasukan" items={ringkas.pemasukan} totalJenis={ringkas.in_} warna={{ text: 'text-income', bar: 'bg-emerald-400' }} />
        <KategoriCol title="Pengeluaran" items={ringkas.pengeluaran} totalJenis={ringkas.out} warna={{ text: 'text-expense', bar: 'bg-expense' }} />
      </div>
    </section>
  )
}
