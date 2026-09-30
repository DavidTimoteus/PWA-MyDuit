import { useEffect, useMemo, useState } from 'react'
import { rangeForFilter } from '../../lib/format.js'
import { enrichTransaksi, hapusPindahSaldo, hapusTransaksi } from '../../lib/db.js'
import FormTransaksiModal from './FormTransaksiModal.jsx'
import ModalPindahSaldo from './ModalPindahSaldo.jsx'
import FilterTransaksiModal from './FilterTransaksiModal.jsx'
import { ChipAkunBaru, TransaksiRow } from './TransaksiRow.jsx'
import { useTransaksi } from './useTransaksi.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'

const PER_HALAMAN = 10

const JENIS_ICONS = [
  { id: 'semua', icon: 'apps', title: 'Semua Transaksi' },
  { id: 'pemasukan', icon: 'trending_up', title: 'Pemasukan' },
  { id: 'pengeluaran', icon: 'trending_down', title: 'Pengeluaran' },
]

function filterLabel(chip, rentang) {
  switch (chip) {
    case 'hari': return 'Hari Ini'
    case '7hari': return '7 Hari Terakhir'
    case '30hari': return '30 Hari Terakhir'
    case 'tahun': return 'Tahun Ini'
    case 'rentang': return rentang.start ? `${rentang.start} s/d ${rentang.end}` : 'Pilih Periode'
    default: return 'Semua Transaksi'
  }
}

export default function TransaksiView({ user }) {
  const uid = user.uid
  const [chip, setChip] = useState('hari')
  const [jenis, setJenis] = useState('semua')
  const [keyword, setKeyword] = useState('')
  const [rentang, setRentang] = useState({ start: '', end: '' })
  const [filterOpen, setFilterOpen] = useState(false)
  const [modal, setModal] = useState({ open: false, mode: 'add', doc: null })
  const [pindahOpen, setPindahOpen] = useState(false)
  const [hapusTarget, setHapusTarget] = useState(null)
  const [bulkHapusOpen, setBulkHapusOpen] = useState(false)
  const [hapusLoading, setHapusLoading] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [openDeleteId, setOpenDeleteId] = useState(null)
  const [page, setPage] = useState(1)

  const range = useMemo(
    () => rangeForFilter(chip, rentang),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chip, rentang.start, rentang.end],
  )
  const { docs, loading, loadingMore, hasMore, error, muatLagi } = useTransaksi(uid, { jenis, range })
  const { akunList, kategoriList } = useAkunKategori(uid)

  // Resolve nama kategori/akun dari map snapshot (anti redundansi; fallback legacy)
  const akunById = useMemo(() => Object.fromEntries(akunList.map((a) => [a.id, a])), [akunList])
  const katById = useMemo(() => Object.fromEntries(kategoriList.map((k) => [k.id, k.nama])), [kategoriList])
  const docsEnriched = useMemo(() => enrichTransaksi(docs, akunById, katById), [docs, akunById, katById])

  const tampil = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return docsEnriched
    return docs.filter((t) =>
      [t.kategoriNama, t.catatan, t.akunNama, String(t.jumlah)].some((s) =>
        String(s ?? '').toLowerCase().includes(kw),
      ),
    )
  }, [docsEnriched, keyword])

  // Reset ke halaman 1 tiap filter/pencarian berubah
  useEffect(() => setPage(1), [chip, jenis, keyword, rentang.start, rentang.end])

  // Chip Filter di header mobile (Shell) meminta membuka modal filter
  useEffect(() => {
    const buka = () => setFilterOpen(true)
    window.addEventListener('myduit:buka-filter', buka)
    return () => window.removeEventListener('myduit:buka-filter', buka)
  }, [])

  // Label filter aktif dikirim ke header mobile (chip Filter di Shell)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('myduit:filter-label', { detail: { label: filterLabel(chip, rentang) } }))
  }, [chip, rentang])

  // Aksi Cepat dari panel kanan (event bus — panel terpisah dari state view ini)
  useEffect(() => {
    function onAksi(e) {
      const { type } = e.detail || {}
      if (type === 'pemasukan' || type === 'pengeluaran') bukaForm('add', { preset: type })
      else if (type === 'pindah-saldo') setPindahOpen(true)
    }
    window.addEventListener('myduit:aksi-cepat', onAksi)
    return () => window.removeEventListener('myduit:aksi-cepat', onAksi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPages = Math.max(1, Math.ceil(tampil.length / PER_HALAMAN))
  const pageItems = tampil.slice((page - 1) * PER_HALAMAN, page * PER_HALAMAN)

  async function nextPage() {
    if (page < totalPages) return setPage(page + 1)
    if (hasMore && !loadingMore) {
      await muatLagi()
      setPage(page + 1)
    }
  }

  function toggleBulk() {
    setBulkMode((b) => !b)
    setSelected(new Set())
    setOpenDeleteId(null)
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

async function konfirmHapus() {
    if (!hapusTarget) return
    const target = hapusTarget
    // Tutup modal & reset loading state LANGSUNG (sinkron), Firestore commit
    // di background. Tidak pakai microtask/setTimeout agar tidak double-fire
    // saat parent re-render setelah state update.
    setHapusTarget(null)
    setHapusLoading(false)
    try {
      if (target.jenis === 'pindah saldo') await hapusPindahSaldo(uid, target)
      else await hapusTransaksi(uid, target)
    } catch (e2) {
      console.warn('[hapus] gagal:', e2?.message ?? e2)
    }
  }

  async function konfirmHapusMassal() {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const targets = ids.map((id) => docsEnriched.find((x) => x.id === id)).filter(Boolean)
    setSelected(new Set())
    setBulkMode(false)
    setBulkHapusOpen(false)
    setHapusLoading(false)
    try {
      for (const t of targets) {
        if (t.jenis === 'pindah saldo') await hapusPindahSaldo(uid, t)
        else await hapusTransaksi(uid, t)
      }
    } catch (e2) {
      console.warn('[hapus-massal] gagal:', e2?.message ?? e2)
    }
  }

  function bukaForm(mode, doc = null) {
    setOpenDeleteId(null)
    setModal({ open: true, mode, doc })
  }

  const adaAkun = akunList.length > 0

  return (
    <section className="mx-auto max-w-3xl px-5 pb-32 md:pb-10">
      <div className="view-section active min-w-0">

        {/* Toolbar: 2 kartu sejajar — persis GAS (mb-4) */}
        <div className="mb-4 mt-2 flex flex-wrap items-center gap-2 md:mt-4">
          {/* Kartu 1: pencarian + filter jenis + pilih banyak */}
          <div className="clay clay-card clay-key-primary min-w-[280px] flex-auto rounded-[22px] bg-surfaceContainerLowest p-2">
            <div className="flex items-center gap-2">
              <div className="relative min-w-[120px] flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 icon-lg text-textSecondary">search</span>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Cari transaksi..."
                  type="text"
                  className="clay-input w-full border-none bg-surface py-2.5 pl-10 pr-10 text-sm outline-none transition-all placeholder:text-textSecondary focus:bg-white focus:ring-1 focus:ring-primary"
                />
                {keyword && (
                  <button
                    type="button"
                    onClick={() => setKeyword('')}
                    aria-label="Hapus pencarian"
                    className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-all hover:!scale-[1.18] hover:!bg-red-100 hover:!text-red-500"
                    style={{
                      background: '#ffffff',
                      boxShadow: '2px 2px 5px rgba(100,116,139,.25), -2px -2px 5px rgba(255,255,255,.9), inset 1px 1px 2px rgba(255,255,255,.6)',
                    }}
                  >
                    <span className="material-symbols-outlined icon-xs">close</span>
                  </button>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {JENIS_ICONS.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => setJenis(j.id)}
                    aria-label={j.title}
                    title={j.title}
                    className={`chip-btn clay-chip flex h-10 w-10 shrink-0 items-center justify-center transition-colors ${
                      jenis === j.id
                        ? 'clay-key-blue bg-blue-700 text-white'
                        : 'clay-key-neutral bg-surface text-textSecondary hover:bg-gray-100 hover:text-slate-800'
                    }`}
                  >
                    <span className="material-symbols-outlined icon-lg">{j.icon}</span>
                  </button>
                ))}
                <button
                  onClick={toggleBulk}
                  aria-label="Pilih banyak transaksi"
                  title="Pilih banyak transaksi"
                  className={`chip-btn clay-chip flex h-10 w-10 shrink-0 items-center justify-center transition-colors ${
                    bulkMode
                      ? 'clay-key-blue bg-blue-700 text-white'
                      : 'clay-key-neutral bg-surface text-textSecondary hover:bg-gray-100 hover:text-slate-800'
                  }`}
                >
                  <span className="material-symbols-outlined icon-lg">checklist</span>
                </button>
              </div>
            </div>
          </div>

          {/* Kartu 2: filter tanggal (desktop) — shadow clay blue manual, radius 22px */}
          <button
            onClick={() => setFilterOpen(true)}
            aria-label="Filter Tanggal"
            className="hidden h-14 max-w-[170px] shrink-0 items-center gap-1.5 rounded-[22px] pl-2.5 pr-3 text-xs font-medium text-white transition-colors hover:bg-blue-800 md:flex"
            style={{
              background: '#1d4ed8',
              boxShadow:
                '3px 3px 9px rgba(31,84,200,.25), -3px -3px 9px rgba(255,255,255,.6), inset 1px 1px 3px rgba(255,255,255,.5), inset -2px -2px 4px rgba(31,84,200,.12)',
            }}
          >
            <span className="material-symbols-outlined shrink-0 icon-md">tune</span>
            <span className="truncate">{filterLabel(chip, rentang)}</span>
          </button>
        </div>

        {/* Pagination — di ATAS list, teks "Halaman x/y" + panah clay (persis GAS) */}
        {totalPages > 1 && (
          <div className="mb-3 mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              aria-label="Halaman sebelumnya"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="clay-pagination-arrow flex h-9 w-9 items-center justify-center rounded-full bg-surfaceContainerLowest text-slate-600"
            >
              <span className="material-symbols-outlined icon-md">chevron_left</span>
            </button>
            <span className="text-[11px] font-medium text-slate-400">Halaman {page}/{totalPages}</span>
            <button
              type="button"
              aria-label="Halaman berikutnya"
              disabled={page >= totalPages && !hasMore}
              onClick={nextPage}
              className="clay-pagination-arrow flex h-9 w-9 items-center justify-center rounded-full bg-surfaceContainerLowest text-slate-600"
            >
              <span className="material-symbols-outlined icon-md">{loadingMore && page >= totalPages ? 'progress_activity' : 'chevron_right'}</span>
            </button>
          </div>
        )}

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
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-textSecondary">
            <div className="riwayat-dot-spinner" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="riwayat-dot-spinner__dot"></div>
              ))}
            </div>
            <span>Memuat riwayat kas...</span>
          </div>
        ) : pageItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">Data transaksi tidak ditemukan.</div>
        ) : (
          <div className="-mx-4 flex flex-col gap-3 px-4 pb-4 pt-1 hide-scrollbar">
            {pageItems.map((t) => (
              <TransaksiRow
                key={t.id}
                trans={t}
                bulkMode={bulkMode}
                selected={selected}
                onToggleSelect={toggleSelect}
                deleteOpen={!bulkMode && openDeleteId === t.id}
                onToggleDelete={(id) => setOpenDeleteId((prev) => (prev === id ? null : id))}
                onEdit={() => bukaForm('edit', t)}
                onDelete={(tr) => {
                  setOpenDeleteId(null)
                  setHapusTarget(tr)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* BAR AKSI HAPUS MASSAL — persis GAS #bulkActionBar */}
      {bulkMode && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[9999] px-4 md:bottom-16">
          <div className="clay-sheet clay-key-danger pointer-events-auto mx-auto flex w-full max-w-md items-center gap-3 bg-white p-3 shadow-xl">
            <span className="shrink-0 text-sm font-bold text-slate-800">{selected.size} dipilih</span>
            <div className="flex-1"></div>
            <button
              onClick={toggleBulk}
              className="clay-btn-secondary clay-btn btn-sm bg-surface text-textSecondary transition-colors hover:bg-gray-200"
            >
              Batal
            </button>
            <button
              onClick={() => setBulkHapusOpen(true)}
              disabled={selected.size === 0}
              className="clay-btn clay-key-danger btn-sm bg-red-500 text-white transition-colors hover:bg-red-600 disabled:opacity-60"
            >
              <span className="material-symbols-outlined icon-sm">delete</span>
              Hapus
            </button>
          </div>
        </div>
      )}

{/* Modal form tambah/edit/salin */}
      <FormTransaksiModal
        key={`form-${modal.open ? modal.doc?.id ?? 'add' : 'closed'}`}
        uid={uid}
        open={modal.open}
        mode={modal.mode}
        doc={modal.doc}
        akunList={akunList}
        kategoriList={kategoriList}
        onClose={() => setModal({ open: false, mode: 'add', doc: null })}
        onSalin={(d) => setModal({ open: true, mode: 'salin', doc: d })}
      />

      {/* Modal pindah saldo */}
      <ModalPindahSaldo
        key={`pindah-${pindahOpen ? 'open' : 'closed'}`}
        uid={uid}
        open={pindahOpen}
        onClose={() => setPindahOpen(false)}
        akunList={akunList}
      />

      {/* Modal filter tanggal */}
      <FilterTransaksiModal
        open={filterOpen}
        chip={chip}
        rentang={rentang}
        onClose={() => setFilterOpen(false)}
        onApply={({ chip: c, rentang: r }) => {
          setChip(c)
          if (r) setRentang(r)
        }}
      />

      {/* Modal konfirmasi hapus tunggal — persis GAS #deleteModal */}
      {hapusTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setHapusTarget(null)}>
          <div className="clay-sheet clay-key-danger w-full max-w-sm transform p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined mb-2 icon-hero text-red-500">warning</span>
            <h3 className="mb-2 text-lg font-bold text-slate-800">Hapus Transaksi?</h3>
            <p className="mb-5 text-xs text-slate-500">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setHapusTarget(null)}
                className="clay-btn-secondary clay-btn btn-md flex-1 text-textSecondary transition-colors hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={konfirmHapus}
                disabled={hapusLoading}
                className="clay-btn clay-key-danger btn-md flex-1 bg-red-500 text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                {hapusLoading ? 'Menghapus…' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal konfirmasi hapus massal — persis GAS #bulkDeleteModal */}
      {bulkHapusOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setBulkHapusOpen(false)}>
          <div className="clay-sheet clay-key-danger w-full max-w-sm transform p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined mb-2 icon-hero text-red-500">delete</span>
            <h3 className="mb-2 text-lg font-bold text-slate-800">Hapus {selected.size} Transaksi?</h3>
            <p className="mb-5 text-xs text-slate-500">Semua transaksi yang dipilih akan dihapus. Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkHapusOpen(false)}
                className="clay-btn-secondary clay-btn btn-md flex-1 text-textSecondary transition-colors hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={konfirmHapusMassal}
                disabled={hapusLoading}
                className="clay-btn clay-key-danger btn-md flex-1 bg-red-500 text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                {hapusLoading ? 'Menghapus…' : 'Ya, Hapus Semua'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
