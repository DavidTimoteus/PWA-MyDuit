import { useState } from 'react'
import { formatRupiah, parseNominal } from '../../lib/format.js'
import { hapusAkun, tambahAkun, updateAkun } from '../../lib/db.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'

const TIPE_AKUN = ['Rekening Utama', 'Tabungan', 'E-Wallet', 'Lainnya']

function FormRekeningModal({ open, onClose, uid, edit }) {
  const [nama, setNama] = useState('')
  const [tipe, setTipe] = useState(TIPE_AKUN[0])
  const [saldo, setSaldo] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Isi ulang tiap kali modal dibuka
  const kunci = open ? open + (edit?.id ?? '') : 'tutup'
  const [kunciLama, setKunciLama] = useState(kunci)
  if (kunci !== kunciLama) {
    setKunciLama(kunci)
    setNama(edit?.nama ?? '')
    setTipe(edit?.tipe ?? TIPE_AKUN[0])
    setSaldo('')
    setError('')
  }

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    if (!nama.trim()) return setError('Nama rekening wajib diisi.')
    setSaving(true)
    try {
      if (edit) {
        await updateAkun(uid, edit.id, { nama: nama.trim(), tipe })
      } else {
        await tambahAkun(uid, { nama: nama.trim(), tipe, saldoAwal: parseNominal(saldo) })
      }
      onClose()
    } catch (e2) {
      setError(e2?.message ?? 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm md:items-center" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="clay-card w-full max-w-sm rounded-t-[28px] p-5 md:rounded-[28px]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-800">{edit ? 'Edit Rekening' : 'Tambah Rekening'}</h3>
          <button type="button" onClick={onClose} className="clay-chip flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Nama</label>
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="mis. Rekening Utama"
          className="clay-field mb-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold"
        />
        <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Tipe</label>
        <select
          value={tipe}
          onChange={(e) => setTipe(e.target.value)}
          className="mb-3 w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-slate-200/70 focus:ring-2 focus:ring-primary"
        >
          {TIPE_AKUN.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        {!edit && (
          <>
            <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Saldo awal</label>
            <div className="clay-field mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5">
              <span className="text-sm font-bold text-slate-400">Rp</span>
              <input
                value={saldo}
                onChange={(e) => setSaldo(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))}
                inputMode="numeric"
                placeholder="0"
                className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
              />
            </div>
          </>
        )}
        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}
        <button disabled={saving} className="clay-btn-primary w-full py-3 text-sm font-extrabold disabled:opacity-60">
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </form>
    </div>
  )
}

export default function RekeningPanel({ uid }) {
  const { akunList } = useAkunKategori(uid)
  const [modal, setModal] = useState({ open: false, edit: null })
  const [hapusTarget, setHapusTarget] = useState(null)
  const [hapusLoading, setHapusLoading] = useState(false)

  const total = akunList.reduce((s, a) => s + (Number(a.saldo) || 0), 0)

  async function konfirmHapus() {
    setHapusLoading(true)
    try {
      await hapusAkun(uid, hapusTarget.id)
      setHapusTarget(null)
    } finally {
      setHapusLoading(false)
    }
  }

  return (
    <div>
      {/* Hero total saldo */}
      <div className="rounded-3xl bg-gradient-to-br from-primary-dark via-primary to-primary-light p-5 text-white shadow-lg">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Total Semua Saldo</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight">{formatRupiah(total)}</p>
        <p className="mt-0.5 text-xs font-semibold text-white/70">{akunList.length} rekening</p>
      </div>

      {/* List kartu rekening */}
      <div className="mt-4 space-y-2">
        {akunList.length === 0 ? (
          <div className="clay-card-soft flex flex-col items-center px-6 py-12 text-center">
            <span className="material-symbols-outlined mb-2 text-5xl text-primary/30">account_balance_wallet</span>
            <p className="text-sm font-bold text-slate-700">Belum ada rekening</p>
            <p className="mt-1 text-xs text-slate-400">Tekan tombol + untuk menambah.</p>
          </div>
        ) : (
          akunList.map((a) => (
            <div key={a.id} className="clay-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-primary">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{a.nama}</p>
                  <p className="text-[11px] font-semibold text-slate-400">{a.tipe}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => setModal({ open: true, edit: a })} title="Edit" className="clay-chip flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200">
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                  </button>
                  <button onClick={() => setHapusTarget(a)} title="Hapus" className="clay-chip flex h-7 w-7 items-center justify-center rounded-full !bg-red-50 text-red-500 hover:!bg-red-500 hover:text-white">
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                  </button>
                </div>
              </div>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800">{formatRupiah(a.saldo)}</p>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">
                {a.mutasiTerakhir
                  ? `Perubahan terakhir: ${a.mutasiTerakhir.keterangan} (${a.mutasiTerakhir.delta >= 0 ? '+' : '−'}Rp${Math.abs(a.mutasiTerakhir.delta).toLocaleString('id-ID')})`
                  : 'Belum ada riwayat'}
              </p>
            </div>
          ))
        )}
      </div>

      {/* FAB tambah */}
      <button
        onClick={() => setModal({ open: true, edit: null })}
        className="clay-fab fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center text-white md:bottom-8 md:right-8"
        title="Tambah rekening"
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <FormRekeningModal
        open={modal.open}
        edit={modal.edit}
        uid={uid}
        onClose={() => setModal({ open: false, edit: null })}
      />

      {hapusTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-sm" onClick={() => setHapusTarget(null)}>
          <div className="clay-card w-full max-w-xs rounded-[24px] p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined text-4xl text-expense">delete</span>
            <p className="mt-2 text-sm font-bold text-slate-800">Hapus rekening “{hapusTarget.nama}”?</p>
            <p className="mt-1 text-xs text-slate-400">Riwayat transaksi lama tetap tersimpan.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setHapusTarget(null)} className="clay-btn-soft py-2.5 text-xs font-bold text-slate-600">Batal</button>
              <button onClick={konfirmHapus} disabled={hapusLoading} className="clay-btn-danger py-2.5 text-xs font-bold disabled:opacity-60">
                {hapusLoading ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
