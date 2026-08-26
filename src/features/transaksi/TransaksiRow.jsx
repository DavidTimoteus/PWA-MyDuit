import { useState } from 'react'
import { parseNominal, tanggalPendek } from '../../lib/format.js'
import { tambahAkun } from '../../lib/db.js'

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

export function warnaKategori(nama) {
  let h = 0
  for (const c of String(nama)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return WARNA_KATEGORI[h % WARNA_KATEGORI.length]
}

// Form mini "buat rekening pertama" — modul rekening lengkap di Fase 3.
export function ChipAkunBaru({ uid }) {
  const [nama, setNama] = useState('')
  const [saldo, setSaldo] = useState('')
  const [saving, setSaving] = useState(false)
  const [selesai, setSelesai] = useState(false)

  async function buat(e) {
    e.preventDefault()
    if (!nama.trim()) return
    setSaving(true)
    try {
      await tambahAkun(uid, { nama: nama.trim(), saldoAwal: parseNominal(saldo) })
      setSelesai(true)
    } finally {
      setSaving(false)
    }
  }

  if (selesai) {
    return (
      <div className="clay-card p-6 text-center">
        <span className="material-symbols-outlined text-4xl text-income">check_circle</span>
        <p className="mt-2 text-sm font-bold text-slate-700">Rekening dibuat! Lanjut catat transaksi.</p>
      </div>
    )
  }

  return (
    <div className="clay-card p-6">
      <h3 className="text-base font-extrabold text-slate-800">Buat rekening pertama</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Rekening adalah sumber dana transaksi (mis. Rekening Utama, E-Wallet, Tabungan).
      </p>
      <form onSubmit={buat} className="mt-4 space-y-2">
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="Nama rekening"
          className="clay-field w-full rounded-xl px-3 py-2.5 text-sm font-semibold"
        />
        <div className="clay-field flex items-center gap-2 rounded-xl px-3 py-2.5">
          <span className="text-sm font-bold text-slate-400">Rp</span>
          <input
            value={saldo}
            onChange={(e) => setSaldo(e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))}
            inputMode="numeric"
            placeholder="Saldo awal (opsional)"
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
        <button
          disabled={saving || !nama.trim()}
          className="clay-btn-primary w-full py-2.5 text-sm font-extrabold disabled:opacity-60"
        >
          {saving ? 'Membuat…' : 'Buat Rekening'}
        </button>
      </form>
    </div>
  )
}

// Satu baris riwayat — chip aksi selalu tampil (pelajaran dari app GAS).
export function TransaksiRow({ trans, onEdit, onSalin, onHapus }) {
  const masuk = trans.jenis === 'pemasukan'
  return (
    <div className="clay-card flex items-center gap-3 p-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${warnaKategori(trans.kategoriNama)}`}>
        {(trans.kategoriNama || '?').charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-800">{trans.kategoriNama || '(tanpa kategori)'}</p>
        <p className="truncate text-[11px] font-semibold text-slate-400">
          {trans.catatan ? `${trans.catatan} · ` : ''}{trans.akunNama}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-extrabold ${masuk ? 'text-income' : 'text-expense'}`}>
          {masuk ? '+' : '−'} Rp{(trans.jumlah || 0).toLocaleString('id-ID')}
        </p>
        <p className="text-[10px] font-semibold text-slate-400">{tanggalPendek(trans.tanggal)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onEdit} title="Edit" className="clay-chip flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200">
          <span className="material-symbols-outlined text-[14px]">edit</span>
        </button>
        <button onClick={onSalin} title="Salin" className="clay-chip flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200">
          <span className="material-symbols-outlined text-[14px]">content_copy</span>
        </button>
        <button onClick={onHapus} title="Hapus" className="clay-chip flex h-7 w-7 items-center justify-center rounded-full !bg-red-50 text-red-500 hover:!bg-red-500 hover:text-white">
          <span className="material-symbols-outlined text-[14px]">delete</span>
        </button>
      </div>
    </div>
  )
}
