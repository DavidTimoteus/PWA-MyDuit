import { useEffect, useState } from 'react'
import { formatRibuanInput, isoHariIni, parseNominal } from '../../lib/format.js'
import { bayarUtang, simpanUtang } from '../../lib/db.js'

function isoTambahHari(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ===== FORM TAMBAH/EDIT UTANG =====
export function FormUtangModal({ open, onClose, uid, edit }) {
  const [namaPihak, setNamaPihak] = useState('')
  const [tipe, setTipe] = useState('Utang')
  const [total, setTotal] = useState('')
  const [cicilan, setCicilan] = useState('')
  const [tgl, setTgl] = useState(isoTambahHari(30))
  const [deskripsi, setDeskripsi] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const kunci = open ? open + (edit?.id ?? '') : 'tutup'
  const [kunciLama, setKunciLama] = useState(kunci)
  if (kunci !== kunciLama) {
    setKunciLama(kunci)
    setNamaPihak(edit?.namaPihak ?? '')
    setTipe(edit?.tipe ?? 'Utang')
    setTotal(edit?.total ? edit.total.toLocaleString('id-ID') : '')
    setCicilan(edit?.cicilanPerBulan ? edit.cicilanPerBulan.toLocaleString('id-ID') : '')
    setTgl(edit?.tglJatuhTempo ?? isoTambahHari(30))
    setDeskripsi(edit?.deskripsi ?? '')
    setError('')
  }

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    const n = parseNominal(total)
    if (!namaPihak.trim()) return setError('Nama pihak wajib diisi.')
    if (n <= 0) return setError('Total harus lebih dari nol.')
    setSaving(true)
    try {
      await simpanUtang(uid, {
        id: edit?.id,
        namaPihak: namaPihak.trim(),
        deskripsi: deskripsi.trim(),
        total: n,
        tipe,
        cicilanPerBulan: parseNominal(cicilan),
        tglJatuhTempo: tgl,
        sisaLama: edit?.sisa,
        totalLama: edit?.total,
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
          <h3 className="text-base font-extrabold text-slate-800">{edit ? 'Edit Utang' : 'Tambah Utang'}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Nama pihak</label>
            <input
              value={namaPihak}
              onChange={(e) => setNamaPihak(e.target.value)}
              placeholder="mis. Kredit Motor"
              className="w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-slate-200/70 focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Tipe</label>
            <select
              value={tipe}
              onChange={(e) => setTipe(e.target.value)}
              className="w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-slate-200/70 focus:ring-2 focus:ring-primary"
            >
              <option>Utang</option>
              <option>Cicilan</option>
            </select>
          </div>
        </div>

        <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Total</label>
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-slate-200/70 focus-within:ring-2 focus-within:ring-primary">
          <span className="text-sm font-bold text-slate-400">Rp</span>
          <input
            value={total}
            onChange={(e) => setTotal(formatRibuanInput(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
          />
        </div>

        {tipe === 'Cicilan' && (
          <>
            <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Cicilan per bulan</label>
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-slate-200/70 focus-within:ring-2 focus-within:ring-primary">
              <span className="text-sm font-bold text-slate-400">Rp</span>
              <input
                value={cicilan}
                onChange={(e) => setCicilan(formatRibuanInput(e.target.value))}
                inputMode="numeric"
                placeholder="0"
                className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
              />
            </div>
          </>
        )}

        <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Jatuh tempo</label>
        <input
          type="date"
          value={tgl}
          onChange={(e) => setTgl(e.target.value)}
          className="mb-3 w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-slate-200/70 focus:ring-2 focus:ring-primary"
        />

        <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Catatan</label>
        <input
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          placeholder="opsional"
          className="mb-4 w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-slate-200/70 placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-primary"
        />

        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}
        <button disabled={saving} className="w-full rounded-full bg-primary py-3 text-sm font-extrabold text-white shadow hover:bg-primary-dark disabled:opacity-60">
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </form>
    </div>
  )
}

// ===== MODAL BAYAR / LUNASIN =====
export function BayarUtangModal({ open, onClose, uid, utang, akunList, lunasin }) {
  const [jumlah, setJumlah] = useState('')
  const [tanggal, setTanggal] = useState(isoHariIni())
  const [akunId, setAkunId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const kunci = open ? open + (utang?.id ?? '') + (lunasin ? 'l' : '') : 'tutup'
  const [kunciLama, setKunciLama] = useState(kunci)
  if (kunci !== kunciLama) {
    setKunciLama(kunci)
    const defaultNominal = utang ? (lunasin ? utang.sisa : utang.cicilanPerBulan || utang.sisa) : 0
    setJumlah(defaultNominal ? defaultNominal.toLocaleString('id-ID') : '')
    setTanggal(isoHariIni())
    setAkunId(akunList[0]?.id ?? '')
    setError('')
  }

  if (!open || !utang) return null

  const n = parseNominal(jumlah)
  const sisaBaru = Math.max(0, (utang.sisa || 0) - n)
  const akun = akunList.find((a) => a.id === akunId)

  async function submit(e) {
    e.preventDefault()
    if (n <= 0) return setError('Nominal harus lebih dari nol.')
    if (!akun) return setError('Pilih rekening sumber.')
    if (n > (utang.sisa || 0)) return setError('Nominal melebihi sisa utang.')
    setSaving(true)
    try {
      await bayarUtang(uid, { utang, jumlah: n, tanggal, akun })
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
          <h3 className="text-base font-extrabold text-slate-800">{lunasin ? 'Lunasin' : 'Bayar'} — {utang.namaPihak}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
          Sisa saat ini: <strong className="text-slate-700">{formatRibuanInput(String(utang.sisa || 0)) ? `Rp${(utang.sisa || 0).toLocaleString('id-ID')}` : 'Rp0'}</strong>
        </p>

        <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Nominal bayar</label>
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-slate-200/70 focus-within:ring-2 focus-within:ring-primary">
          <span className="text-sm font-bold text-slate-400">Rp</span>
          <input
            value={jumlah}
            onChange={(e) => setJumlah(formatRibuanInput(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            className="w-full bg-transparent text-lg font-extrabold outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-slate-200/70 focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Sumber dana</label>
            <select
              value={akunId}
              onChange={(e) => setAkunId(e.target.value)}
              className="w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-slate-200/70 focus:ring-2 focus:ring-primary"
            >
              {akunList.map((a) => (
                <option key={a.id} value={a.id}>{a.nama}</option>
              ))}
            </select>
          </div>
        </div>

        {n > 0 && (
          <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-primary">
            Sisa setelah bayar: Rp{sisaBaru.toLocaleString('id-ID')}{sisaBaru === 0 ? ' — LUNAS ✓' : ''}
          </p>
        )}
        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          {!lunasin && (
            <button
              type="button"
              onClick={() => setJumlah((utang.sisa || 0).toLocaleString('id-ID'))}
              className="rounded-full bg-slate-100 py-3 text-xs font-extrabold text-slate-600 hover:bg-slate-200"
            >
              Lunasin ({formatRibuanInput(String(utang.sisa || 0)) ? `Rp${(utang.sisa || 0).toLocaleString('id-ID')}` : 'Rp0'})
            </button>
          )}
          <button
            disabled={saving}
            className={`col-span-1 rounded-full py-3 text-sm font-extrabold text-white shadow transition-all hover:brightness-110 disabled:opacity-60 ${lunasin ? 'col-span-2 bg-primary' : 'bg-primary'}`}
          >
            {saving ? 'Menyimpan…' : lunasin ? 'Lunasin Sekarang' : 'Bayar'}
          </button>
        </div>
      </form>
    </div>
  )
}
