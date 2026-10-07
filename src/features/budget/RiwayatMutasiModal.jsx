import { useMemo, useState } from 'react'
import { formatRupiah, rangeForFilter, tanggalLabel } from '../../lib/format.js'
import { useTransaksi } from '../transaksi/useTransaksi.js'
import { ClayDateInput } from '../../components/clay-ui.jsx'
import { bangunMutasi, ringkasMutasi } from './riwayatSaldo.js'

// Filter rentang: Hari Ini / 7 Hari / 30 Hari (wajib) + Kustom + Semua.
const OPSI_FILTER = [
  { id: 'hari', label: 'Hari Ini' },
  { id: '7hari', label: '7 Hari Terakhir' },
  { id: '30hari', label: '30 Hari Terakhir' },
  { id: 'rentang', label: 'Kustom' },
  { id: 'semua', label: 'Semua' },
]

// Jam dari createdAt (serverTimestamp). Offline = null -> '' (tanpa jam).
function jamDari(at) {
  const d = at?.toDate ? at.toDate() : at ? new Date(at) : null
  if (!d || isNaN(d)) return ''
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// Modal detail "Perubahan Terakhir" per rekening: daftar mutasi + filter
// rentang waktu. Data dari useTransaksi (langganan live, jaringan query yang
// sama dengan tab Transaksi — tanpa index baru); penyaringan per-akun +
// perhitungan saldo sesudah ada di riwayatSaldo.js (murni, teruji Node).
export default function RiwayatMutasiModal({ uid, akun, kategoriById = {}, onClose }) {
  const [chip, setChip] = useState('7hari')
  const [rentang, setRentang] = useState({ start: '', end: '' })

  const range = useMemo(
    () => rangeForFilter(chip, rentang),
    // Sengaja memakai rentang.start/end (string), BUKAN objek `rentang` —
    // objek baru tiap render akan mengeksekusi ulang tanpa perubahan berarti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chip, rentang.start, rentang.end],
  )
  const { docs, loading, loadingMore, hasMore, error, muatLagi } = useTransaksi(uid, {
    jenis: 'semua',
    range,
  })

  const baris = useMemo(
    () =>
      bangunMutasi(docs, {
        akunId: akun?.id,
        saldoSekarang: akun?.saldo,
        kategoriById,
      }),
    [docs, akun?.id, akun?.saldo, kategoriById],
  )
  const ringkas = useMemo(() => ringkasMutasi(baris), [baris])

  if (!akun) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Riwayat perubahan ${akun.nama}`}
    >
      <div
        className="clay-sheet clay-key-primary flex max-h-[90vh] w-full flex-col overflow-hidden sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: judul + rekening + saldo saat ini + tombol tutup */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-800">
              <span className="material-symbols-outlined text-blue-700">history</span>
              Perubahan Rekening
            </h3>
            <p className="truncate text-xs font-semibold text-slate-500">{akun.nama}</p>
            <p className="mt-1 font-mono text-sm font-extrabold text-slate-900 tabular-nums">
              {formatRupiah(akun.saldo)}
              <span className="ml-1.5 text-[10px] font-semibold text-slate-500">saldo saat ini</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="clay-chip clay-key-neutral flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <span className="material-symbols-outlined icon-md">close</span>
          </button>
        </div>

        {/* Filter rentang waktu */}
        <div className="shrink-0 border-b border-gray-100 px-5 py-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Rentang waktu
          </p>
          <div className="flex flex-wrap gap-1.5">
            {OPSI_FILTER.map((o) => {
              const aktif = chip === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setChip(o.id)}
                  aria-pressed={aktif}
                  className={`clay-chip rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    aktif ? 'clay-key-blue solid-blue text-white' : 'clay-key-neutral text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
          {chip === 'rentang' && (
            <div className="mt-2">
              <ClayDateInput range accent value={rentang} onChange={setRentang} placeholder="Pilih periode" />
              {(!rentang.start || !rentang.end) && (
                <p className="mt-1 text-[11px] font-medium text-amber-600">
                  Lengkapi tanggal awal & akhir — selama itu seluruh riwayat ditampilkan.
                </p>
              )}
            </div>
          )}

          {/* Ringkasan hasil filter */}
          <p className="mt-2 text-[11px] font-medium text-slate-500">
            {loading
              ? 'Memuat riwayat...'
              : `${ringkas.jumlah} mutasi · masuk ${formatRupiah(ringkas.masuk)} · keluar ${formatRupiah(ringkas.keluar)}`}
          </p>
        </div>

        {/* Daftar mutasi */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              Gagal memuat riwayat: {error}
            </p>
          ) : loading && baris.length === 0 ? (
            <div className="riwayat-dot-spinner flex items-center justify-center gap-1.5 py-8" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="riwayat-dot-spinner__dot" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          ) : baris.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span className="material-symbols-outlined mb-2 text-4xl text-blue-400/50">history</span>
              <p className="text-sm font-bold text-slate-700">Belum ada perubahan</p>
              <p className="mt-1 text-xs text-slate-500">Tidak ada mutasi rekening pada rentang ini.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {baris.map((b) => {
                const jam = jamDari(b.createdAt)
                const naik = b.delta > 0
                const datar = b.delta === 0
                return (
                  <li key={b.id} className="clay-card clay-key-neutral rounded-[18px] bg-white p-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${b.kelas}`}
                        aria-hidden="true"
                      >
                        <span className="material-symbols-outlined icon-sm">{b.ikon}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-slate-800">
                            {b.kategoriNama}
                            <span className="ml-1.5 text-[10px] font-semibold text-slate-400">{b.label}</span>
                          </p>
                          <p
                            className={`shrink-0 font-mono text-xs font-extrabold tabular-nums ${
                              datar ? 'text-slate-500' : naik ? 'text-green-700' : 'text-red-600'
                            }`}
                          >
                            {formatRupiah(b.delta, { tanda: true })}
                          </p>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {tanggalLabel(b.tanggal)}
                          {jam ? ` · ${jam}` : ''}
                        </p>
                        {b.catatan && <p className="mt-0.5 truncate text-[11px] italic text-slate-400">{b.catatan}</p>}
                        <p className="mt-1 font-mono text-[10px] font-semibold text-slate-400 tabular-nums">
                          Saldo sesudah: {formatRupiah(b.saldoSesudah)}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {hasMore && !error && (
            <button
              type="button"
              onClick={muatLagi}
              disabled={loadingMore}
              className="clay-btn clay-key-neutral btn-md mt-3 w-full text-xs font-bold text-slate-600 disabled:opacity-60"
            >
              {loadingMore ? 'Memuat...' : 'Muat lagi'}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-3">
          <button
            onClick={onClose}
            className="clay-btn clay-key-neutral btn-md w-full text-xs font-bold text-slate-600"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
