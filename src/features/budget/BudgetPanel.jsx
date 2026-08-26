import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, where, query } from 'firebase/firestore'
import { formatRupiah, parseNominal } from '../../lib/format.js'
import { hapusBudget, simpanBudget } from '../../lib/db.js'
import { getFirebase } from '../../lib/firebase.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'
import { useTransaksi } from '../transaksi/useTransaksi.js'

function bulanIni() {
  const d = new Date()
  return { bulan: d.getMonth(), tahun: d.getFullYear() }
}

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// Langganan budget bulan berjalan (equality saja — tak butuh composite index).
function useBudgetBulan(uid, bulan, tahun) {
  const [list, setList] = useState([])
  useEffect(() => {
    if (!uid) return
    const { db } = getFirebase()
    const q = query(
      collection(db, 'users', uid, 'budget'),
      where('deleted', '==', false),
      where('bulan', '==', bulan),
      where('tahun', '==', tahun),
    )
    return onSnapshot(q, (snap) => setList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [uid, bulan, tahun])
  return list
}

function FormBudgetModal({ open, onClose, uid, kategoriList, existing, edit }) {
  const [kategoriId, setKategoriId] = useState('')
  const [limit, setLimit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const kunci = open ? open + (edit?.id ?? '') : 'tutup'
  const [kunciLama, setKunciLama] = useState(kunci)
  if (kunci !== kunciLama) {
    setKunciLama(kunci)
    setKategoriId(edit?.kategoriId ?? '')
    setLimit(edit?.limitNominal ? edit.limitNominal.toLocaleString('id-ID') : '')
    setError('')
  }

  if (!open) return null
  const { bulan, tahun } = bulanIni()
  const opsi = kategoriList.filter((k) => k.jenis === 'pengeluaran')
  const dipakaiKategori = new Set(existing.filter((b) => b.id !== edit?.id).map((b) => b.kategoriId))

  async function submit(e) {
    e.preventDefault()
    const kat = opsi.find((k) => k.id === kategoriId)
    const n = parseNominal(limit)
    if (!kat) return setError('Pilih kategori dulu.')
    if (n <= 0) return setError('Limit harus lebih dari nol.')
    setSaving(true)
    try {
      await simpanBudget(uid, {
        id: edit?.id,
        kategoriId: kat.id,
        kategoriNama: kat.nama,
        limitNominal: n,
        bulan,
        tahun,
      })
      onClose()
    } catch (e2) {
      setError(e2?.message ?? 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm md:items-center" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-sm rounded-t-[28px] bg-white p-5 shadow-2xl md:rounded-[28px]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-800">{edit ? 'Edit Budget' : 'Tambah Budget'}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-primary">
          Periode: {NAMA_BULAN[bulan]} {tahun}
        </p>
        <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Kategori pengeluaran</label>
        <select
          value={kategoriId}
          onChange={(e) => setKategoriId(e.target.value)}
          className="mb-3 w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-slate-200/70 focus:ring-2 focus:ring-primary"
        >
          <option value="" disabled>Pilih…</option>
          {opsi.map((k) => (
            <option key={k.id} value={k.id} disabled={dipakaiKategori.has(k.id)}>
              {k.nama}{dipakaiKategori.has(k.id) ? ' (sudah ada)' : ''}
            </option>
          ))}
        </select>
        <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Limit per bulan</label>
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-slate-200/70 focus-within:ring-2 focus-within:ring-primary">
          <span className="text-sm font-bold text-slate-400">Rp</span>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))}
            inputMode="numeric"
            placeholder="0"
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
          />
        </div>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}
        <button disabled={saving} className="w-full rounded-full bg-primary py-3 text-sm font-extrabold text-white shadow hover:bg-primary-dark disabled:opacity-60">
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </form>
    </div>
  )
}

export default function BudgetPanel({ uid }) {
  const { kategoriList } = useAkunKategori(uid)
  const { bulan, tahun } = bulanIni()
  const budgets = useBudgetBulan(uid, bulan, tahun)
  const rangeBulan = useMemo(() => {
    const awal = new Date(tahun, bulan, 1)
    const akhir = new Date(tahun, bulan + 1, 0)
    const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { start: f(awal), end: f(akhir) }
  }, [bulan, tahun])
  const { docs: transBulan } = useTransaksi(uid, { jenis: 'pengeluaran', range: rangeBulan })

  const [modal, setModal] = useState({ open: false, edit: null })
  const [hapusTarget, setHapusTarget] = useState(null)
  const [hapusLoading, setHapusLoading] = useState(false)

  const terpakaiPerKategori = useMemo(() => {
    const m = {}
    for (const t of transBulan) {
      if (t.kategoriId) m[t.kategoriId] = (m[t.kategoriId] || 0) + (t.jumlah || 0)
    }
    return m
  }, [transBulan])

  async function konfirmHapus() {
    setHapusLoading(true)
    try {
      await hapusBudget(uid, hapusTarget.id)
      setHapusTarget(null)
    } finally {
      setHapusLoading(false)
    }
  }

  return (
    <div>
      <div className="rounded-3xl bg-gradient-to-br from-primary-dark via-primary to-primary-light p-5 text-white shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Budget {NAMA_BULAN[bulan]} {tahun}</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight">{budgets.length} kategori</p>
        <p className="mt-0.5 text-xs font-semibold text-white/70">Limit pengeluaran bulan berjalan</p>
      </div>

      <div className="mt-4 space-y-2">
        {budgets.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
            <span className="material-symbols-outlined mb-2 text-5xl text-primary/30">savings</span>
            <p className="text-sm font-bold text-slate-700">Belum ada budget bulan ini</p>
            <p className="mt-1 text-xs text-slate-400">Tekan tombol + untuk membatasi pengeluaran per kategori.</p>
          </div>
        ) : (
          budgets.map((b) => {
            const terpakai = terpakaiPerKategori[b.kategoriId] || 0
            const persen = b.limitNominal > 0 ? Math.min(100, Math.round((terpakai / b.limitNominal) * 100)) : 0
            const lewat = terpakai > b.limitNominal
            const sisa = b.limitNominal - terpakai
            return (
              <div key={b.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${lewat ? 'bg-red-50 text-expense' : 'bg-emerald-50 text-primary'}`}>
                    {(b.kategoriNama || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{b.kategoriNama}</p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      Terpakai {formatRupiah(terpakai)} · Sisa {formatRupiah(sisa)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => setModal({ open: true, edit: b })} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                    </button>
                    <button onClick={() => setHapusTarget(b)} title="Hapus" className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white">
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${lewat ? 'bg-expense' : persen >= 80 ? 'bg-amber-400' : 'bg-primary'}`}
                      style={{ width: `${persen}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-extrabold ${lewat ? 'text-expense' : 'text-slate-500'}`}>
                    {lewat ? 'Melebihi!' : `${persen}%`}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <button
        onClick={() => setModal({ open: true, edit: null })}
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-dark via-primary to-primary-light text-white shadow-xl transition-transform active:scale-95 md:bottom-8 md:right-8"
        title="Tambah budget"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <FormBudgetModal
        open={modal.open}
        edit={modal.edit}
        uid={uid}
        kategoriList={kategoriList}
        existing={budgets}
        onClose={() => setModal({ open: false, edit: null })}
      />

      {hapusTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-sm" onClick={() => setHapusTarget(null)}>
          <div className="w-full max-w-xs rounded-[24px] bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined text-4xl text-expense">delete</span>
            <p className="mt-2 text-sm font-bold text-slate-800">Hapus budget “{hapusTarget.kategoriNama}”?</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setHapusTarget(null)} className="rounded-full bg-slate-100 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200">Batal</button>
              <button onClick={konfirmHapus} disabled={hapusLoading} className="rounded-full bg-expense py-2.5 text-xs font-bold text-white shadow hover:brightness-110 disabled:opacity-60">
                {hapusLoading ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
