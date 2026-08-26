import { useMemo, useState } from 'react'
import { formatRupiah, rangeForFilter, tanggalLabel } from '../../lib/format.js'
import { hapusTransaksi } from '../../lib/db.js'
import FormTransaksiModal from './FormTransaksiModal.jsx'
import { ChipAkunBaru, TransaksiRow } from './TransaksiRow.jsx'
import { useTransaksi } from './useTransaksi.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'

const CHIPS = [
  { id: 'hari', label: 'Hari Ini' },
  { id: 'minggu', label: 'Minggu' },
  { id: 'bulan', label: 'Bulan' },
  { id: 'tahun', label: 'Tahun' },
  { id: 'rentang', label: 'Rentang' },
  { id: 'semua', label: 'Semua' },
]

const JENIS = [
  { id: 'semua', label: 'Semua' },
  { id: 'pemasukan', label: 'Masuk' },
  { id: 'pengeluaran', label: 'Keluar' },
]

export default function TransaksiView({ user }) {
  const uid = user.uid
  const [chip, setChip] = useState('bulan')
  const [jenis, setJenis] = useState('semua')
  const [keyword, setKeyword] = useState('')
  const [rentang, setRentang] = useState({ start: '', end: '' })
  const [modal, setModal] = useState({ open: false, mode: 'add', doc: null })
  const [hapusTarget, setHapusTarget] = useState(null)
  const [hapusLoading, setHapusLoading] = useState(false)

  const range = useMemo(
    () => rangeForFilter(chip, rentang),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chip, rentang.start, rentang.end],
  )
  const { docs, loading, loadingMore, hasMore, error, muatLagi } = useTransaksi(uid, { jenis, range })
  const { akunList, kategoriList } = useAkunKategori(uid)

  const tampil = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return docs
    return docs.filter((t) =>
      [t.kategoriNama, t.catatan, t.akunNama, String(t.jumlah)].some((s) =>
        String(s ?? '').toLowerCase().includes(kw),
      ),
    )
  }, [docs, keyword])

  const ringkasan = useMemo(() => {
    let masuk = 0
    let keluar = 0
    for (const t of tampil) {
      if (t.jenis === 'pemasukan') masuk += t.jumlah
      else keluar += t.jumlah
    }
    return { masuk, keluar, selisih: masuk - keluar }
  }, [tampil])

  const grup = useMemo(() => {
    const out = []
    let current = null
    for (const t of tampil) {
      if (!current || current.tanggal !== t.tanggal) {
        current = { tanggal: t.tanggal, label: tanggalLabel(t.tanggal), items: [] }
        out.push(current)
      }
      current.items.push(t)
    }
    return out
  }, [tampil])

  async function konfirmHapus() {
    if (!hapusTarget) return
    setHapusLoading(true)
    try {
      await hapusTransaksi(uid, hapusTarget)
      setHapusTarget(null)
    } finally {
      setHapusLoading(false)
    }
  }

  const adaAkun = akunList.length > 0

  return (
    <section className="mx-auto max-w-3xl px-5 pb-32 md:pb-10">
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">Transaksi</h2>

      {/* Ringkasan periode */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="clay-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pemasukan</p>
          <p className="mt-0.5 truncate text-sm font-extrabold text-income">{formatRupiah(ringkasan.masuk)}</p>
        </div>
        <div className="clay-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pengeluaran</p>
          <p className="mt-0.5 truncate text-sm font-extrabold text-expense">{formatRupiah(ringkasan.keluar)}</p>
        </div>
        <div className="clay-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Selisih</p>
          <p className={`mt-0.5 truncate text-sm font-extrabold ${ringkasan.selisih < 0 ? 'text-expense' : 'text-slate-800'}`}>
            {formatRupiah(ringkasan.selisih)}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              onClick={() => setChip(c.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                chip === c.id ? 'clay-btn-primary' : 'clay-btn-soft text-slate-500 hover:text-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="clay-inset flex items-center gap-1.5 px-3 py-1.5">
            <span className="material-symbols-outlined text-[16px] text-slate-400">search</span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari catatan/kategori…"
              className="w-40 bg-transparent text-xs font-semibold outline-none placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
          <div className="clay-inset flex p-0.5">
            {JENIS.map((j) => (
              <button
                key={j.id}
                onClick={() => setJenis(j.id)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                  jenis === j.id ? 'clay-btn-primary' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {j.label}
              </button>
            ))}
          </div>
        </div>
        {chip === 'rentang' && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <input
              type="date"
              value={rentang.start}
              onChange={(e) => setRentang((r) => ({ ...r, start: e.target.value }))}
              className="clay-field rounded-xl px-3 py-1.5"
            />
            <span>s.d.</span>
            <input
              type="date"
              value={rentang.end}
              onChange={(e) => setRentang((r) => ({ ...r, end: e.target.value }))}
              className="clay-field rounded-xl px-3 py-1.5"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
          {error.toLowerCase().includes('index')
            ? 'Query butuh index Firestore — buka link di error console browser (F12) untuk membuatnya. Sekali saja.'
            : error}
        </p>
      )}

      {/* Konten utama */}
      {!adaAkun ? (
        <div className="mt-4">
          <ChipAkunBaru uid={uid} />
        </div>
      ) : loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/70" />
          ))}
        </div>
      ) : grup.length === 0 ? (
          <div className="clay-card-soft mt-4 flex flex-col items-center px-6 py-14 text-center">
          <span className="material-symbols-outlined mb-2 text-5xl text-primary/30">receipt_long</span>
          <p className="text-sm font-bold text-slate-700">Belum ada transaksi di periode ini</p>
          <p className="mt-1 text-xs text-slate-400">Tekan tombol + untuk mencatat yang pertama.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {grup.map((g) => (
            <div key={g.tanggal}>
              <p className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{g.label}</p>
              <div className="space-y-2">
                {g.items.map((t) => (
                  <TransaksiRow
                    key={t.id}
                    trans={t}
                    onEdit={() => setModal({ open: true, mode: 'edit', doc: t })}
                    onSalin={() => setModal({ open: true, mode: 'salin', doc: t })}
                    onHapus={() => setHapusTarget(t)}
                  />
                ))}
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              onClick={muatLagi}
              disabled={loadingMore}
              className="clay-btn-soft w-full py-2.5 text-xs font-extrabold text-primary disabled:opacity-60"
            >
              {loadingMore ? 'Memuat…' : 'Muat 50 lagi'}
            </button>
          )}
        </div>
      )}

      {/* FAB tambah */}
      {adaAkun && (
        <button
          onClick={() => setModal({ open: true, mode: 'add', doc: null })}
          className="clay-fab fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center text-white md:bottom-8 md:right-8"
          title="Catat transaksi"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      )}

      {/* Modal form */}
      <FormTransaksiModal
        uid={uid}
        open={modal.open}
        mode={modal.mode}
        doc={modal.doc}
        akunList={akunList}
        kategoriList={kategoriList}
        onClose={() => setModal({ open: false, mode: 'add', doc: null })}
      />

      {/* Modal konfirmasi hapus */}
      {hapusTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-sm" onClick={() => setHapusTarget(null)}>
          <div className="clay-card w-full max-w-xs rounded-[24px] p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined text-4xl text-expense">delete</span>
            <p className="mt-2 text-sm font-bold text-slate-800">Hapus transaksi ini?</p>
            <p className="mt-1 text-xs text-slate-400">
              {hapusTarget.kategoriNama} · Rp{(hapusTarget.jumlah || 0).toLocaleString('id-ID')} — saldo rekening ikut dikembalikan.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setHapusTarget(null)} className="clay-btn-soft py-2.5 text-xs font-bold text-slate-600">
                Batal
              </button>
              <button
                onClick={konfirmHapus}
                disabled={hapusLoading}
                className="clay-btn-danger py-2.5 text-xs font-bold disabled:opacity-60"
              >
                {hapusLoading ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
