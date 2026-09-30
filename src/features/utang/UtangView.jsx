import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { formatRupiah, tanggalPendek } from '../../lib/format.js'
import { hapusUtang } from '../../lib/db.js'
import { getFirebase } from '../../lib/firebase.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'
import { BayarUtangModal, FormUtangModal } from './UtangModals.jsx'

const FILTERS = [
  { id: 'semua', label: 'Semua' },
  { id: 'aktif', label: 'Aktif' },
  { id: 'lunas', label: 'Lunas' },
  { id: 'terlambat', label: 'Terlambat' },
]

const PER_HALAMAN = 2

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
  if (!iso) return null
  const target = new Date(`${iso}T00:00:00`)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target - now) / 86400000)
}

function infoJatuhTempo(iso) {
  if (!iso) return { teks: 'Tanpa jatuh tempo', cls: 'text-slate-400', hari: null }
  const d = selisihHari(iso)
  if (d < 0) return { teks: `Terlambat ${-d} hari`, cls: 'text-expense font-bold', hari: d }
  if (d === 0) return { teks: 'Jatuh tempo hari ini!', cls: 'text-expense font-bold', hari: d }
  if (d <= 7) return { teks: `Jatuh tempo ${tanggalPendek(iso)} (H-${d})`, cls: 'text-amber-500 font-bold', hari: d }
  return { teks: `Jatuh tempo ${tanggalPendek(iso)} (${d} hari lagi)`, cls: 'text-slate-400', hari: d }
}

function KartuUtang({ t, onBayar, onLunasin, onEdit, onHapus }) {
  const lunas = t.status === 'Lunas' || (t.sisa || 0) <= 0
  const terlambat = !lunas && selisihHari(t.tglJatuhTempo) < 0
  const terbayar = Math.max(0, (t.total || 0) - (t.sisa || 0))
  const persen = t.total > 0 ? Math.round((terbayar / t.total) * 100) : 0
  const jatuh = infoJatuhTempo(t.tglJatuhTempo)
  const clayKey = lunas ? 'clay-key-primary' : terlambat ? 'clay-key-danger' : 'clay-key-neutral'

  return (
    <div className={`clay-card ${clayKey} p-4`}>
      <div className="flex items-center gap-3">
        <div className={`clay-icon-tile ${clayKey} flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${lunas ? 'bg-emerald-50 text-income' : 'bg-red-50 text-expense'}`}>
          <span className="material-symbols-outlined icon-lg">{lunas ? 'task_alt' : 'account_balance_wallet'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-bold text-slate-800">{t.namaPihak}</p>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${t.tipe === 'Cicilan' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-600'}`}>
              {t.tipe}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${lunas ? 'bg-emerald-50 text-income' : terlambat ? 'bg-red-500 text-white' : 'bg-red-50 text-expense'}`}>
              {lunas ? 'Lunas' : terlambat ? 'Terlambat' : 'Aktif'}
            </span>
          </div>
          <p className={`truncate text-[11px] ${jatuh.cls}`}>{jatuh.teks}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onEdit} title="Edit" className="clay-chip flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200">
            <span className="material-symbols-outlined icon-xs">edit</span>
          </button>
          <button onClick={onHapus} title="Hapus" className="clay-chip flex h-8 w-8 items-center justify-center rounded-full !bg-red-50 text-red-500 hover:!bg-red-500 hover:text-white">
            <span className="material-symbols-outlined icon-xs">delete</span>
          </button>
        </div>
      </div>

      {/* Progress terbayar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full bg-gradient-to-r ${lunas ? 'from-emerald-400 to-emerald-600' : 'from-red-400 to-red-600'} transition-all`} style={{ width: `${persen}%` }} />
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
              <button onClick={onLunasin} className="clay-btn-soft btn-sm text-slate-600">Lunasin</button>
              <button onClick={onBayar} className="clay-btn-primary btn-sm">Bayar</button>
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
  const [formModal, setFormModal] = useState({ open: false, edit: null, mode: 'utang' })

  // Listen event dari FAB bottom nav (Tambah Utang)
  useEffect(() => {
    const handler = () => setFormModal({ open: true, edit: null, mode: 'utang' })
    window.addEventListener('myduit:buka-tambah-utang', handler)
    return () => window.removeEventListener('myduit:buka-tambah-utang', handler)
  }, [])
  const [bayarModal, setBayarModal] = useState({ open: false, utang: null, lunasin: false })
  const [hapusTarget, setHapusTarget] = useState(null)
  const [halaman, setHalaman] = useState(1)

  // Event dari panel kanan Aksi Cepat
  useEffect(() => {
    function onAdd(e) {
      setFormModal({ open: true, edit: null, mode: e.detail?.mode ?? 'utang' })
    }
    window.addEventListener('myduit:utang-add', onAdd)
    return () => window.removeEventListener('myduit:utang-add', onAdd)
  }, [])

  const tampil = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    if (filter === 'aktif') return list.filter((t) => t.status !== 'Lunas' && (t.sisa || 0) > 0)
    if (filter === 'lunas') return list.filter((t) => t.status === 'Lunas' || (t.sisa || 0) <= 0)
    if (filter === 'terlambat') return list.filter((t) => t.status !== 'Lunas' && (t.sisa || 0) > 0 && selisihHari(t.tglJatuhTempo) < 0)
    return list
  }, [list, filter])

  const ringkasan = useMemo(() => {
    let totalSisa = 0, totalAwal = 0, cicilanAktif = 0, lunasCount = 0, totalLunasNominal = 0, totalCicilanPerBulan = 0
    const aktif = []
    for (const t of list) {
      const l = t.status === 'Lunas' || (t.sisa || 0) <= 0
      totalAwal += t.total || 0
      if (l) {
        lunasCount++
        totalLunasNominal += t.total || 0
      } else {
        totalSisa += t.sisa || 0
        aktif.push(t)
        if (t.tipe === 'Cicilan') {
          cicilanAktif++
          totalCicilanPerBulan += t.cicilanPerBulan || 0
        }
      }
    }
    const terbayar = Math.max(0, totalAwal - totalSisa)
    const persenLunas = totalAwal > 0 ? Math.round((terbayar / totalAwal) * 100) : 0
    const jatuhTempo = aktif
      .filter((t) => t.tglJatuhTempo)
      .map((t) => ({ id: t.id, nama: t.namaPihak, sisa: t.sisa || 0, hari: selisihHari(t.tglJatuhTempo) }))
      .sort((a, b) => a.hari - b.hari)
    return {
      totalSisa, totalAwal, terbayar, persenLunas,
      cicilanAktif, lunasCount, totalLunasNominal,
      aktifCount: aktif.length,
      totalCicilanPerBulan,
      rataPerBulan: aktif.length ? Math.round(totalCicilanPerBulan / Math.max(1, cicilanAktif)) : 0,
      jatuhTempo,
      aktif,
    }
  }, [list])

  // Emit ke sidebar kanan + sidebar kiri
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('myduit:utang-update', { detail: ringkasan }))

    // Perkiraan Bebas Utang (formula GAS): totalSisa / totalCicilanPerBulan
    let bulanEstimasi = null, perkiraan = '—'
    if (ringkasan.aktifCount === 0) {
      perkiraan = 'Belum ada utang/cicilan aktif.'
    } else if (ringkasan.totalCicilanPerBulan > 0) {
      bulanEstimasi = Math.max(1, Math.ceil(ringkasan.totalSisa / ringkasan.totalCicilanPerBulan))
      const d = new Date()
      d.setMonth(d.getMonth() + bulanEstimasi)
      perkiraan = `≈ ${d.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`
    } else {
      perkiraan = 'Perkiraan butuh cicilan per bulan.'
    }
    const terbesar = ringkasan.aktif.slice().sort((a, b) => (b.sisa || 0) - (a.sisa || 0))[0] || null
    window.dispatchEvent(new CustomEvent('myduit:sidebar-utang-update', {
      detail: {
        bulanEstimasi,
        perkiraan,
        terbesar: terbesar ? { nama: terbesar.namaPihak, sisa: terbesar.sisa || 0, jatuh: terbesar.tglJatuhTempo } : null,
      },
    }))
  }, [ringkasan])

  const totalHalaman = Math.max(1, Math.ceil(tampil.length / PER_HALAMAN))
  const halamanItems = tampil.slice((halaman - 1) * PER_HALAMAN, halaman * PER_HALAMAN)

  useEffect(() => setHalaman(1), [filter])

  async function konfirmHapus() {
    if (!hapusTarget) return
    const target = hapusTarget
    setHapusTarget(null)
    try {
      await hapusUtang(uid, target.id)
    } catch (e) {
      console.warn('[utang-hapus] gagal:', e?.message ?? e)
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-5 pb-32 md:pb-10 md:pt-4">
      {/* Header mobile-only */}
      <header className="flex items-center gap-2 pt-3 pb-4 md:hidden">
        <div className="clay-icon-tile clay-key-danger flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-700 text-white">
          <span className="material-symbols-outlined icon-lg" style={{ fontVariationSettings: "'FILL' 1" }}>handshake</span>
        </div>
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight">Utang & Cicilan</h2>
      </header>

      {/* Mobile hero */}
      <div className="card-3d-danger mb-4 p-5 text-white md:hidden">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs opacity-90 sm:text-sm">Total Sisa Utang Aktif</p>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,.18)' }}>{ringkasan.aktifCount} aktif</span>
        </div>
        <p className="mb-3 text-2xl font-bold sm:text-3xl">{formatRupiah(ringkasan.totalSisa)}</p>
        <div className="flex items-center gap-1.5 text-[11px] opacity-90">
          <span className="material-symbols-outlined icon-xs">event</span>
          <span>{ringkasan.jatuhTempo[0] ? `${ringkasan.jatuhTempo[0].nama} · ${ringkasan.jatuhTempo[0].hari} hari` : 'Tidak ada jatuh tempo dekat'}</span>
        </div>
      </div>

      {/* Desktop summary 3 cards */}
      <div className="mb-4 hidden grid-cols-3 gap-3 md:grid">
        <div className="clay clay-card clay-key-danger rounded-[22px] bg-gradient-to-br from-red-500 to-red-700 p-4 text-white">
          <div className="mb-2 flex items-center gap-2"><span className="material-symbols-outlined icon-md opacity-90" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span><p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Utang</p></div>
          <p className="font-mono text-2xl font-extrabold">{formatRupiah(ringkasan.totalSisa)}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium opacity-80"><span className="material-symbols-outlined icon-xs">trending_up</span>{ringkasan.aktifCount} aktif</p>
        </div>
        <div className="clay clay-card clay-key-primary rounded-[22px] bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white">
          <div className="mb-2 flex items-center gap-2"><span className="material-symbols-outlined icon-md opacity-90" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span><p className="text-xs font-semibold uppercase tracking-wider opacity-90">Lunas</p></div>
          <p className="font-mono text-2xl font-extrabold">{formatRupiah(ringkasan.totalLunasNominal)}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium opacity-80"><span className="material-symbols-outlined icon-xs">check</span>{ringkasan.lunasCount} item lunas</p>
        </div>
        <div className="clay clay-card clay-key-blue rounded-[22px] bg-gradient-to-br from-blue-500 to-blue-700 p-4 text-white">
          <div className="mb-2 flex items-center gap-2"><span className="material-symbols-outlined icon-md opacity-90" style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span><p className="text-xs font-semibold uppercase tracking-wider opacity-90">Cicilan Aktif</p></div>
          <p className="font-mono text-2xl font-extrabold">{ringkasan.cicilanAktif}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium opacity-80"><span className="material-symbols-outlined icon-xs">calendar_month</span>{formatRupiah(ringkasan.totalCicilanPerBulan)}/bln</p>
        </div>
      </div>

      {/* Filter desktop + mobile */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`clay-chip h-9 px-4 text-xs font-semibold transition-colors ${
              filter === f.id
                ? 'clay-key-danger bg-red-600 text-white hover:bg-red-700'
                : 'clay-key-neutral bg-surfaceContainerLowest text-textSecondary hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Pager */}
      {tampil.length > 0 && (
        <div className="mb-3 flex items-center justify-center gap-2">
          <button onClick={() => setHalaman((h) => Math.max(1, h - 1))} disabled={halaman <= 1} className="clay-chip clay-key-neutral flex h-9 w-9 items-center justify-center text-slate-500 disabled:opacity-40">
            <span className="material-symbols-outlined icon-md">expand_less</span>
          </button>
          <span className="min-w-[84px] text-center text-[11px] font-semibold text-slate-600">Halaman {halaman}/{totalHalaman}</span>
          <button onClick={() => setHalaman((h) => Math.min(totalHalaman, h + 1))} disabled={halaman >= totalHalaman} className="clay-chip clay-key-neutral flex h-9 w-9 items-center justify-center text-slate-500 disabled:opacity-40">
            <span className="material-symbols-outlined icon-md">expand_more</span>
          </button>
        </div>
      )}

      {/* List 2 card/halaman desktop; mobile tetap list halaman */}
      <div className="space-y-3">
        {halamanItems.length === 0 ? (
          <div className="clay-card-soft flex flex-col items-center px-6 py-14 text-center">
            <span className="material-symbols-outlined mb-2 text-5xl text-primary/30">payments</span>
            <p className="text-sm font-bold text-slate-700">Belum ada utang/cicilan</p>
            <p className="mt-1 text-xs text-slate-400">Tekan tombol + untuk mencatat yang pertama.</p>
          </div>
        ) : (
          halamanItems.map((t) => (
            <KartuUtang
              key={t.id}
              t={t}
              onBayar={() => setBayarModal({ open: true, utang: t, lunasin: false })}
              onLunasin={() => setBayarModal({ open: true, utang: t, lunasin: true })}
              onEdit={() => setFormModal({ open: true, edit: t, mode: t.tipe === 'Cicilan' ? 'cicilan' : 'utang' })}
              onHapus={() => setHapusTarget(t)}
            />
          ))
        )}
      </div>

      <FormUtangModal
        key={`utang-form-${formModal.open ? formModal.edit?.id ?? formModal.mode : 'closed'}`}
        open={formModal.open}
        edit={formModal.edit}
        mode={formModal.mode}
        uid={uid}
        onClose={() => setFormModal({ open: false, edit: null, mode: 'utang' })}
      />
      <BayarUtangModal
        key={`utang-bayar-${bayarModal.open ? bayarModal.utang?.id ?? 'open' : 'closed'}`}
        open={bayarModal.open}
        utang={bayarModal.utang}
        lunasin={bayarModal.lunasin}
        uid={uid}
        akunList={akunList}
        onClose={() => setBayarModal({ open: false, utang: null, lunasin: false })}
      />

      {hapusTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-sm" onClick={() => setHapusTarget(null)}>
          <div className="clay-card w-full max-w-xs rounded-[24px] p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined text-4xl text-expense">delete</span>
            <p className="mt-2 text-sm font-bold text-slate-800">Hapus “{hapusTarget.namaPihak}”?</p>
            <p className="mt-1 text-xs text-slate-400">Riwayat pembayaran yang sudah tercatat tetap ada.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setHapusTarget(null)} className="clay-btn-soft btn-md text-xs font-bold text-slate-600">Batal</button>
              <button onClick={konfirmHapus} className="clay-btn-danger btn-md text-xs font-bold">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
