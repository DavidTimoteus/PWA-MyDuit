import { useEffect, useRef, useState } from 'react'
import { formatRibuanInput, isoHariIni, parseNominal, simbolUang } from '../../lib/format.js'
import { ambilAtauBuatKategori, simpanTransaksi, updateTransaksi } from '../../lib/db.js'
import { ClayCombobox, ClayDateInput, ClaySelect } from '../../components/clay-ui.jsx'

// Modal Catat / Edit / Salin transaksi — markup persis GAS #viewTambah.
// JENIS TIDAK dipilih user: di-set sistem dari titik masuk (Aksi Cepat /
// speed-dial mengirim preset pemasukan|pengeluaran; default pengeluaran).
// Grup Scan Struk tampil (mode add) — fungsinya (OCR) menyusul.
export default function FormTransaksiModal({ uid, open, onClose, onSalin, akunList, kategoriList, mode, doc: sumber }) {
  const [jenis, setJenis] = useState('pengeluaran')
  const [jumlah, setJumlah] = useState('')
  const [kategoriNama, setKategoriNama] = useState('')
  const [akunId, setAkunId] = useState('')
  const [tanggal, setTanggal] = useState(isoHariIni())
  const [catatan, setCatatan] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileUploadRef = useRef(null)
  const fileCameraRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setError('')
    setSaving(false)
    if ((mode === 'edit' || mode === 'salin') && sumber) {
      setJenis(sumber.jenis ?? 'pengeluaran')
      setJumlah(formatRibuanInput(String(sumber.jumlah ?? '')))
      setKategoriNama(sumber.kategoriNama ?? '')
      setAkunId(sumber.akunId ?? akunList[0]?.id ?? '')
      setTanggal(mode === 'salin' ? isoHariIni() : (sumber.tanggal ?? isoHariIni()))
      setCatatan(sumber.catatan ?? '')
    } else {
      // Jenis di-set sistem: preset dari pemicu (Aksi Cepat / speed-dial), default pengeluaran
      setJenis(sumber?.preset === 'pemasukan' ? 'pemasukan' : 'pengeluaran')
      setJumlah('')
      setKategoriNama('')
      setAkunId(akunList[0]?.id ?? '')
      setTanggal(isoHariIni())
      setCatatan('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, sumber?.id])

  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    const n = parseNominal(jumlah)
    if (n <= 0) return setError('Nominal harus lebih dari nol.')
    if (!akunId) return setError('Pilih rekening sumber dulu.')
    if (!kategoriNama.trim()) return setError('Isi kategori dulu.')

    const akun = akunList.find((a) => a.id === akunId)

    // Snapshot data SEBELUM tutup modal — state komponen boleh berubah setelahnya.
    const jenisSnap = jenis
    const tanggalSnap = tanggal
    const catatanSnap = catatan.trim()
    const akunIdSnap = akunId
    const namaKatSnap = kategoriNama.trim()
    const modeSnap = mode
    const sumberSnap = sumber

    // OPTIMISTIC: tutup modal SEKARANG, commit ke Firestore di background.
    // Promise tulis Firestore baru resolve setelah server ack — kalau ditunggu,
    // modal menggantung "Menyimpan…" saat jaringan lambat/offline (padahal data
    // sudah masuk cache lokal & UI list langsung ter-update via onSnapshot).
    setError('')
    setSaving(false)
    onClose()

    ;(async () => {
      try {
        // Boundary: kategori bebas-ketik WAJIB jadi dokumen kategori resmi.
        const kat =
          kategoriList.find((k) => k.nama.toLowerCase() === namaKatSnap.toLowerCase() && k.jenis === jenisSnap) ??
          kategoriList.find((k) => k.nama.toLowerCase() === namaKatSnap.toLowerCase())
        let kategoriId = kat?.id ?? ''
        if (!kategoriId) kategoriId = await ambilAtauBuatKategori(uid, namaKatSnap, jenisSnap)
        const data = {
          jumlah: n,
          jenis: jenisSnap,
          kategoriId,
          kategoriNama: namaKatSnap,
          akunId: akunIdSnap,
          akunNama: akun?.nama ?? '',
          tanggal: tanggalSnap,
          catatan: catatanSnap,
        }
        if (modeSnap === 'edit' && sumberSnap) await updateTransaksi(uid, sumberSnap, data)
        else await simpanTransaksi(uid, data)
      } catch (e2) {
        console.warn('[transaksi-simpan] gagal:', e2?.message ?? e2)
        window.dispatchEvent(new CustomEvent('myduit:toast', { detail: { type: 'error', msg: 'Gagal menyimpan transaksi.' } }))
      }
    })()
  }

  const judul = mode === 'edit' ? 'Edit Transaksi' : mode === 'salin' ? 'Salin Transaksi' : 'Catat Transaksi'

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="clay-sheet clay-key-primary flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 pb-2 pt-4">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-800 sm:text-base">
            <span className="material-symbols-outlined icon-lg shrink-0 text-primary">receipt_long</span>
            <span className="truncate">{judul}</span>
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {mode === 'edit' && (
              <button
                type="button"
                onClick={() => onSalin?.(sumber)}
                title="Salin transaksi"
                className="clay-chip clay-key-primary inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary-light text-primary transition-colors hover:bg-emerald-100"
              >
                <span className="material-symbols-outlined icon-sm">content_copy</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="clay-chip clay-key-neutral flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <span className="material-symbols-outlined icon-lg">close</span>
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="min-h-0 space-y-2 overflow-y-auto px-4 py-2">
          {/* Scan Struk / Foto — HANYA mode tambah (GAS menyembunyikannya saat edit).
              Fungsi OCR menyusul; tombol & pemilih file sudah terpasang. */}
          {mode === 'add' && (
            <div className="flex flex-col gap-1">
              <label className="block text-[11px] font-semibold text-textSecondary">Scan Struk / Foto Transaksi</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileUploadRef.current?.click()}
                  className="clay-btn-secondary clay-btn btn-sm flex-1 bg-surface text-textSecondary transition-colors hover:bg-gray-100"
                >
                  <span className="material-symbols-outlined icon-md">upload_file</span>
                  Upload Struk
                </button>
                <button
                  type="button"
                  onClick={() => fileCameraRef.current?.click()}
                  className="clay-btn-secondary clay-btn btn-sm flex-1 bg-surface text-textSecondary transition-colors hover:bg-gray-100"
                >
                  <span className="material-symbols-outlined icon-md">photo_camera</span>
                  Foto Struk
                </button>
              </div>
              <input type="file" accept="image/*" ref={fileUploadRef} style={{ display: 'none' }} onChange={() => {}} />
              <input type="file" accept="image/*" capture="environment" ref={fileCameraRef} style={{ display: 'none' }} onChange={() => {}} />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="block text-[11px] font-semibold text-textSecondary">Tanggal</label>
            <ClayDateInput value={tanggal} onChange={setTanggal} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="block text-[11px] font-semibold text-textSecondary">Sumber / Akun</label>
            <ClaySelect
              value={akunId}
              onChange={setAkunId}
              placeholder="Pilih Sumber/Akun"
              options={akunList.map((a) => ({ value: a.id, label: a.nama }))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="block text-[11px] font-semibold text-textSecondary">Kategori</label>
            <ClayCombobox
              value={kategoriNama}
              onChange={setKategoriNama}
              placeholder="Pilih atau ketik kategori..."
              required
              // Filter kategori berdasarkan JENIS transaksi (pengeluaran → hanya
              // kategori jenis pengeluaran; pemasukan → hanya pemasukan). Untuk
              // mode edit/salin, jika kategori sumber tidak masuk filter (mis.
              // data legacy jenis berbeda), tetap sertakan agar tidak hilang opsi.
              options={(() => {
                const sesuaiJenis = kategoriList.filter((k) => k.jenis === jenis)
                if ((mode === 'edit' || mode === 'salin') && sumber?.kategoriId) {
                  const ada = sesuaiJenis.some((k) => k.id === sumber.kategoriId)
                  if (!ada) {
                    const sumberKat = kategoriList.find((k) => k.id === sumber.kategoriId)
                    if (sumberKat) return [{ value: sumberKat.id, label: sumberKat.nama + ' (lama)' }, ...sesuaiJenis]
                  }
                }
                return sesuaiJenis
              })().map((k) => ({ value: k.id, label: k.nama }))}
            />
          </div>

          {akunList.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-2.5 py-2 text-[11px] text-red-600">
              <span className="material-symbols-outlined icon-xs mt-px shrink-0">error</span>
              <span>Belum ada rekening. Tambahkan rekening dulu sebagai sumber akun.</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="block text-[11px] font-semibold text-textSecondary">Keterangan</label>
            <input
              type="text"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Keterangan opsional"
              className="clay-input field-lg w-full bg-surface text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="block text-[11px] font-semibold text-textSecondary">Nominal ({simbolUang()})</label>
            <input
              type="text"
              value={jumlah}
              onChange={(e) => setJumlah(formatRibuanInput(e.target.value))}
              inputMode="numeric"
              placeholder="0"
              required
              className="clay-input field-lg w-full bg-surface text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary font-mono"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="clay-btn clay-key-primary btn-lg w-full bg-primary text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
          >
            <span className="material-symbols-outlined icon-md">save</span>
            {saving ? 'Menyimpan…' : mode === 'edit' ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </button>
        </form>
      </div>
    </div>
  )
}
