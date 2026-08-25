import { useEffect, useState } from 'react'
import { formatRibuanInput, isoHariIni, parseNominal } from '../../lib/format.js'
import { simpanTransaksi, updateTransaksi } from '../../lib/db.js'

// Modal Catat / Edit / Salin transaksi.
// mode: 'add' (form kosong) | 'edit' (isi dari doc, submit = update)
//       | 'salin' (isi dari doc, submit = transaksi baru)
export default function FormTransaksiModal({ uid, open, onClose, akunList, kategoriList, mode, doc: sumber }) {
  const [jenis, setJenis] = useState('pengeluaran')
  const [jumlah, setJumlah] = useState('')
  const [kategoriId, setKategoriId] = useState('')
  const [akunId, setAkunId] = useState('')
  const [tanggal, setTanggal] = useState(isoHariIni())
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setSaving(false)
    if ((mode === 'edit' || mode === 'salin') && sumber) {
      setJenis(sumber.jenis ?? 'pengeluaran')
      setJumlah(sumber.jumlah ? sumber.jumlah.toLocaleString('id-ID') : '')
      setKategoriId(sumber.kategoriId ?? '')
      setAkunId(sumber.akunId ?? akunList[0]?.id ?? '')
      setTanggal(sumber.tanggal ?? isoHariIni())
      setCatatan(sumber.catatan ?? '')
    } else {
      setJenis('pengeluaran')
      setJumlah('')
      setKategoriId('')
      setAkunId(akunList[0]?.id ?? '')
      setTanggal(isoHariIni())
      setCatatan('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, sumber?.id])

  if (!open) return null

  const kategoriOpsi = kategoriList.filter((k) => k.jenis === jenis)
  const kategoriTerpilihAda = kategoriOpsi.some((k) => k.id === kategoriId)

  async function submit(e) {
    e.preventDefault()
    const n = parseNominal(jumlah)
    if (n <= 0) return setError('Nominal harus lebih dari nol.')
    if (!kategoriId) return setError('Pilih kategori dulu.')
    if (!akunId) return setError('Pilih rekening sumber dulu.')

    setSaving(true)
    setError('')
    try {
      const akun = akunList.find((a) => a.id === akunId)
      const kat = kategoriList.find((k) => k.id === kategoriId)
      const data = {
        jumlah: n,
        jenis,
        kategoriId,
        kategoriNama: kat?.nama ?? '',
        akunId,
        akunNama: akun?.nama ?? '',
        tanggal,
        catatan: catatan.trim(),
      }
      if (mode === 'edit' && sumber) {
        await updateTransaksi(uid, sumber, data)
      } else {
        await simpanTransaksi(uid, data)
      }
      onClose()
    } catch (e2) {
      setError(e2?.message ?? 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  const judul = mode === 'edit' ? 'Edit Transaksi' : mode === 'salin' ? 'Salin Transaksi' : 'Catat Transaksi'

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm md:items-center" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl md:rounded-[28px]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-800">{judul}</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Toggle jenis */}
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1">
          {['pengeluaran', 'pemasukan'].map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => {
                setJenis(j)
                setKategoriId('')
              }}
              className={`rounded-full py-2 text-xs font-bold capitalize transition-all ${
                jenis === j
                  ? j === 'pengeluaran'
                    ? 'bg-expense text-white shadow'
                    : 'bg-income text-white shadow'
                  : 'text-slate-500'
              }`}
            >
              {j}
            </button>
          ))}
        </div>

        {/* Nominal */}
        <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Nominal</label>
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 ring-1 ring-slate-200/70 focus-within:ring-2 focus-within:ring-primary">
          <span className="text-lg font-extrabold text-slate-400">Rp</span>
          <input
            value={jumlah}
            onChange={(e) => setJumlah(formatRibuanInput(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            autoFocus
            className="w-full bg-transparent text-2xl font-extrabold tracking-tight text-slate-800 outline-none placeholder:text-slate-300"
          />
        </div>

        {/* Kategori + Akun */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Kategori</label>
            <select
              value={kategoriTerpilihAda ? kategoriId : ''}
              onChange={(e) => setKategoriId(e.target.value)}
              className="w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none ring-1 ring-slate-200/70 focus:ring-2 focus:ring-primary"
            >
              <option value="" disabled>Pilih…</option>
              {!kategoriTerpilihAda && kategoriId && <option value={kategoriId}>{'(kategori lama)'}</option>}
              {kategoriOpsi.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Rekening</label>
            <select
              value={akunId}
              onChange={(e) => setAkunId(e.target.value)}
              className="w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none ring-1 ring-slate-200/70 focus:ring-2 focus:ring-primary"
            >
              {akunList.length === 0 && <option value="">Belum ada rekening</option>}
              {akunList.map((a) => (
                <option key={a.id} value={a.id}>{a.nama}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tanggal + Catatan */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none ring-1 ring-slate-200/70 focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Catatan</label>
            <input
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="opsional"
              className="w-full rounded-xl bg-surface px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none ring-1 ring-slate-200/70 placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-primary py-3 text-sm font-extrabold text-white shadow transition-all hover:bg-primary-dark active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? 'Menyimpan…' : mode === 'edit' ? 'Simpan Perubahan' : 'Simpan'}
        </button>
      </form>
    </div>
  )
}
