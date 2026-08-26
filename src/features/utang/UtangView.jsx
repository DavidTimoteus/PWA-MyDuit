import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { formatRupiah, isoHariIni, tanggalPendek } from '../../lib/format.js'
import { hapusUtang } from '../../lib/db.js'
import { getFirebase } from '../../lib/firebase.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'
import { BayarUtangModal, FormUtangModal } from './UtangModals.jsx'

const FILTERS = [
  { id: 'semua', label: 'Semua' },
  { id: 'aktif', label: 'Belum Lunas' },
  { id: 'lunas', label: 'Lunas' },
]

function useUtangList(uid) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!uid) return
    const { db } = getFirebase()
    const q = query(
      collection(db, 'users', uid, 'utang'),
      where('deleted', '==', false),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, (snap) => setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [uid])
  return list
}

function selisihHari(iso) {
  const target = new Date(`${iso}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target - now) / 86400000)
}

function infoJatuhTempo(iso) {
  if (!iso) return { teks: 'Tanpa jatuh tempo', cls: 'text-slate-400' }
  const d = selisihHari(iso)
  if (d < 0) return { teks: `Terlambat ${-d} hari`, cls: 'text-expense font-bold' }
  if (d === 0) return { teks: 'Jatuh tempo hari ini!', cls: 'text-expense font-bold' }
  if (d <= 7) return { teks: `Jatuh tempo ${tanggalPendek(iso)} (H-${d})`, cls: 'text-amber-500 font-bold' }
  return { teks: `Jatuh tempo ${tanggalPendek(iso)} (${d} hari lagi)`, cls: 'text-slate-400' }
}

function KartuUtang({ t, onBayar, onLunasin, onEdit, onHapus }) {
  const lunas = t.status === 'Lunas' || (t.sisa || 0) <= 0
  const terbayar = Math.max(0, (t.total || 0) - (t.sisa || 0))
  const persen = t.total > 0 ? Math.round((terbayar / t.total) * 100) : 0
  const jatuh = infoJatuhTempo(t.tglJatuhTempo)

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${lunas ? 'bg-emerald-50 text-income' : 'bg-red-50 text-expense'}`}>
          <span className="material-symbols-outlined text-[20px]">{lunas ? 'task_alt' : 'account_balance_wallet'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-bold text-slate-800">{t.namaPihak}</p>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${t.tipe === 'Cicilan' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-600'}`}>
              {t.tipe}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${lunas ? 'bg-emerald-50 text-income' : 'bg-red-50 text-expense'}`}>
              {lunas ? 'Lunas' : 'Belum Lunas'}
            </span>
          </div>
          <p className={`truncate text-[11px] ${jatuh.cls}`}>{jatuh.teks}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onEdit} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[14px]">edit</span>
          </button>
          <button onClick={onHapus} title="Hapus" className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white">
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </div>
      </div>

      {/* Progress terbayar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-primary-dark to-primary-light transition-all" style={{ width: `${persen}%` }} />
        </div>
        <span className="text-[11px] font-extrabold text-slate-500">{persen}%</span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sisa</p>
          <p className={`text-lg font-extrabold tracking-tight ${lunas ? 'text-income' : 'text-slate-800'}`}>{formatRupiah(t.sisa || 0)}</p>
          <p className="text-[10px] font-semibold text-slate-400">dari {formatRupiah(t.total || 0)}</p>
        </div>
        <div className="flex items-center gap-2">
          {t.tipe === 'Cicilan' && t.cicilanPerBulan > 0 && !lunas && (
            <p className="text-[11px] font-bold text-slate-500">{formatRupiah(t.cicilanPerBulan)}/bln</p>
          )}
          {!lunas && (
            <>
              <button onClick={onLunasin} className="rounded-full bg-slate-100 px-3.5 py-2 text-xs font-extrabold text-slate-600 hover:bg-slate-200">
                Lunasin
              </button>
              <button onClick={onBayar} className="rounded-full bg-primary px-4 py-2 text-xs font-extrabold text-white shadow hover:bg-primary-dark">
                Bayar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function UtangView({ user }) {
  const uid = user.uid
  const list = useUtangList(uid)
  const { akunList } = useAkunKategori(uid)
  const [filter, setFilter] = useState('semua')
  const [formModal, setFormModal] = useState({ open: false, edit: null })
  const [bayarModal, setBayarModal] = useState({ open: false, utang: null, lunasin: false })
  const [hapusTarget, setHapusTarget] = useState(null)
  const [hapusLoading, setHapusLoading] = useState(false)

  const tampil = useMemo(() => {
    if (filter === 'aktif') return list.filter((t) => t.status !== 'Lunas' && (t.sisa || 0) > 0)
    if (filter === 'lunas') return list.filter((t) => t.status === 'Lunas' || (t.sisa || 0) <= 0)
    return list
  }, [list, filter])

  const ringkasan = useMemo(() => {
    let totalSisa = 0
    let cicilanAktif = 0
    let lunasCount = 0
    for (const t of list) {
      const l = t.status === 'Lunas' || (t.sisa || 0) <= 0
      if (l) lunasCount++
      else {
        totalSisa += t.sisa || 0
        if (t.tipe === 'Cicilan') cicilanAktif++
      }
    }
    return { totalSisa, cicilanAktif, lunasCount }
  }, [list])

  async function konfirmHapus() {
    setHapusLoading(true)
    try {
      await hapusUtang(uid, hapusTarget.id)
      setHapusTarget(null)
    } finally {
      setHapusLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-5 pb-32 md:pb-10">
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">Utang & Cicilan</h2>

      {/* Ringkasan */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Sisa</p>
          <p className="mt-0.5 truncate text-sm font-extrabold text-expense">{formatRupiah(ringkasan.totalSisa)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Cicilan Aktif</p>
          <p className="mt-0.5 text-sm font-extrabold text-slate-800">{ringkasan.cicilanAktif}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Lunas</p>
          <p className="mt-0.5 text-sm font-extrabold text-income">{ringkasan.lunasCount}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
              filter === f.id ? 'bg-primary text-white shadow' : 'bg-white text-slate-500 ring-1 ring-slate-200/70 hover:text-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-4 space-y-2">
        {tampil.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
            <span className="material-symbols-outlined mb-2 text-5xl text-primary/30">payments</span>
            <p className="text-sm font-bold text-slate-700">Belum ada utang/cicilan</p>
            <p className="mt-1 text-xs text-slate-400">Tekan tombol + untuk mencatat yang pertama.</p>
          </div>
        ) : (
          tampil.map((t) => (
            <KartuUtang
              key={t.id}
              t={t}
              onBayar={() => setBayarModal({ open: true, utang: t, lunasin: false })}
              onLunasin={() => setBayarModal({ open: true, utang: t, lunasin: true })}
              onEdit={() => setFormModal({ open: true, edit: t })}
              onHapus={() => setHapusTarget(t)}
            />
          ))
        )}
      </div>

      {/* FAB tambah */}
      <button
        onClick={() => setFormModal({ open: true, edit: null })}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-dark via-primary to-primary-light text-white shadow-xl transition-transform active:scale-95 md:bottom-8 md:right-8"
        title="Tambah utang"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <FormUtangModal
        open={formModal.open}
        edit={formModal.edit}
        uid={uid}
        onClose={() => setFormModal({ open: false, edit: null })}
      />
      <BayarUtangModal
        open={bayarModal.open}
        utang={bayarModal.utang}
        lunasin={bayarModal.lunasin}
        uid={uid}
        akunList={akunList}
        onClose={() => setBayarModal({ open: false, utang: null, lunasin: false })}
      />

      {hapusTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-sm" onClick={() => setHapusTarget(null)}>
          <div className="w-full max-w-xs rounded-[24px] bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined text-4xl text-expense">delete</span>
            <p className="mt-2 text-sm font-bold text-slate-800">Hapus “{hapusTarget.namaPihak}”?</p>
            <p className="mt-1 text-xs text-slate-400">Riwayat pembayaran yang sudah tercatat tetap ada.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setHapusTarget(null)} className="rounded-full bg-slate-100 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200">Batal</button>
              <button onClick={konfirmHapus} disabled={hapusLoading} className="rounded-full bg-expense py-2.5 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-60">
                {hapusLoading ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
