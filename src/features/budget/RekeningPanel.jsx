import { useEffect, useMemo, useRef, useState } from 'react'
import { formatRupiah } from '../../lib/format.js'
import { hapusAkun } from '../../lib/db.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'
import { useTransaksi } from '../transaksi/useTransaksi.js'
import FormRekeningModal from './FormRekeningModal.jsx'

// Sub-tab Rekening: hero Total Saldo + pagination card-stack + daftar rekening.
// Paritas dengan GAS ViewBudget.html #budgetRekeningPanel + #rekeningPaginationControls.
const PER_HALAMAN_MOBILE = 1   // mobile: 1 card/halaman (geser vertikal)
const PER_HALAMAN_DESKTOP = 2 // desktop: 2 cards/halaman (pager)

function rangeBulanIni() {
  const d = new Date()
  const awal = new Date(d.getFullYear(), d.getMonth(), 1)
  const akhir = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const f = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return { start: f(awal), end: f(akhir) }
}

function inisialTipe(tipe) {
  if (!tipe) return '?'
  const parts = tipe.split(/[\s/]+/).filter(Boolean)
  return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : tipe.substring(0, 2).toUpperCase()
}

// dd/MM/yyyy HH:mm (persis GAS). Firestore Timestamp punya .toDate(); serverTimestamp offline = null → skip.
function tanggalJam(at) {
  const d = at?.toDate ? at.toDate() : (at ? new Date(at) : null)
  if (!d || isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// { teks, warna } untuk box "Perubahan Terakhir" (mengikuti getLogWarna_ GAS).
function logMutasi(m) {
  const delta = Number(m?.delta) || 0
  const ket = m?.keterangan || 'Perubahan'
  const tanda = delta >= 0 ? '+' : '-'
  const tglJam = tanggalJam(m?.at)
  const teks = `${tglJam ? tglJam + ' — ' : ''}${ket}: ${tanda}${formatRupiah(Math.abs(delta))}`
  let warna = 'text-slate-600'
  if (/pindah/i.test(ket)) warna = 'text-blue-700 font-bold'
  else if (delta < 0) warna = 'text-red-700 font-bold'
  else if (delta > 0) warna = 'text-green-700 font-bold'
  return { teks, warna }
}

export default function RekeningPanel({ uid }) {
  const { akunList } = useAkunKategori(uid)
  const rangeBulan = useMemo(rangeBulanIni, [])

  // Arus kas bulan berjalan (untuk hero)
  const { docs: transBulan } = useTransaksi(uid, { range: rangeBulan, jenis: 'semua' })
  const arusBulan = useMemo(() => {
    let masuk = 0, keluar = 0
    for (const t of transBulan) {
      if (t.jenis === 'pemasukan') masuk += t.jumlah || 0
      else if (t.jenis === 'pengeluaran') keluar += t.jumlah || 0
    }
    return { masuk, keluar }
  }, [transBulan])

  const [modal, setModal] = useState({ open: false, edit: null })

  // Listen event buka tambah rekening dari FAB bottom nav
  useEffect(() => {
    const handler = () => setModal({ open: true, edit: null })
    window.addEventListener('myduit:buka-tambah-rekening', handler)
    return () => window.removeEventListener('myduit:buka-tambah-rekening', handler)
  }, [])
  const [hapusTarget, setHapusTarget] = useState(null)
  const [halaman, setHalaman] = useState(1)
  const [jumlahPerHalaman, setJumlahPerHalaman] = useState(PER_HALAMAN_MOBILE)

  // Responsive: 1 card/halaman di mobile, 2 di desktop
  useEffect(() => {
    function handleResize() {
      setJumlahPerHalaman(window.innerWidth >= 768 ? PER_HALAMAN_DESKTOP : PER_HALAMAN_MOBILE)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Listen event global
  useEffect(() => {
    function onAdd() {
      setModal({ open: true, edit: null })
    }
    window.addEventListener('myduit:rekening-add', onAdd)
    return () => window.removeEventListener('myduit:rekening-add', onAdd)
  }, [])

  const total = akunList.reduce((s, a) => s + (Number(a.saldo) || 0), 0)
  const totalCards = akunList.length
  const totalHalaman = Math.max(1, Math.ceil(akunList.length / jumlahPerHalaman))
  const activeIdx = halaman - 1

  // Gesture Touch / Swipe untuk card-stack mobile (persis GAS handleRekeningTouch)
  const touchStartY = useRef(null)
  const touchStartX = useRef(null)

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return
    const diffY = e.changedTouches[0].clientY - touchStartY.current
    const diffX = e.changedTouches[0].clientX - touchStartX.current
    touchStartY.current = null
    touchStartX.current = null

    // Swipe ke atas / kiri -> kartu berikutnya
    if (diffY < -35 || diffX < -35) {
      setHalaman((h) => (h < totalCards ? h + 1 : 1))
    }
    // Swipe ke bawah / kanan -> kartu sebelumnya
    else if (diffY > 35 || diffX > 35) {
      setHalaman((h) => (h > 1 ? h - 1 : totalCards))
    }
  }

  async function konfirmHapus() {
    if (!hapusTarget) return
    const target = hapusTarget
    setHapusTarget(null)
    try {
      await hapusAkun(uid, target.id)
    } catch (e) {
      console.warn('[rekening-hapus] gagal:', e?.message ?? e)
    }
  }

  return (
    <div>
      {/* Hero Total Semua Saldo — gradient biru persis ViewBudget.html #totalSaldoBudget */}
      <div className="clay clay-key-blue mt-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-5 text-white md:flex md:items-center md:justify-between md:gap-6 min-h-[100px] md:min-h-[170px]">
        <div className="min-w-0">
          <p className="mb-1 text-xs opacity-90 sm:text-sm">Total Semua Saldo</p>
          <p className="font-mono mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">{formatRupiah(total)}</p>
          <div className="flex items-center gap-1.5 text-[11px] opacity-80">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            <span>Terakhir diperbarui: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric' })} {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        {/* Arus kas bulan berjalan — Pemasukan/Pengeluaran */}
        <div className="mt-3 grid shrink-0 grid-cols-2 gap-x-4 gap-y-1 md:mt-0 md:text-right md:grid-cols-1">
          <div>
            <p className="text-[11px] font-medium opacity-80">Pemasukan bulan ini</p>
            <p className="font-mono text-sm font-bold">{formatRupiah(arusBulan.masuk)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium opacity-80">Pengeluaran bulan ini</p>
            <p className="font-mono text-sm font-bold">{formatRupiah(arusBulan.keluar)}</p>
          </div>
        </div>
      </div>

      {/* Pager horizontal (pola persis GAS rekeningPaginationControls) */}
      {totalCards > 1 && (
        <div className="mt-4 mb-2 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setHalaman((h) => (h > 1 ? h - 1 : totalCards))}
            aria-label="Halaman sebelumnya"
            className="clay-pagination-arrow flex h-8 w-9 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <span className="min-w-[84px] text-center text-[11px] font-semibold text-slate-600">Halaman {halaman}/{totalCards}</span>
          <button
            type="button"
            onClick={() => setHalaman((h) => (h < totalCards ? h + 1 : 1))}
            aria-label="Halaman berikutnya"
            className="clay-pagination-arrow flex h-8 w-9 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      )}

      {/* ===== MOBILE ONLY: CARD-STACK SLIDER (Persis ViewBudget.html GAS #rekeningList) ===== */}
      <div
        id="rekeningList"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative mt-2 md:hidden"
        style={{ height: '225px', overflow: 'hidden' }}
      >
        {akunList.length === 0 ? (
          <div className="clay-card-soft flex flex-col items-center px-6 py-12 text-center">
            <span className="material-symbols-outlined mb-2 text-5xl text-primary/30">account_balance_wallet</span>
            <p className="text-sm font-bold text-slate-700">Belum ada rekening</p>
            <p className="mt-1 text-xs text-slate-400">Tekan tombol + untuk menambah.</p>
          </div>
        ) : (
          akunList.map((a, i) => {
            let delta = i - activeIdx
            if (totalCards > 2) {
              if (delta > totalCards / 2) delta -= totalCards
              if (delta < -totalCards / 2) delta += totalCards
            }

            let transform = ''
            let opacity = 0
            let zIndex = 1
            let pointerEvents = 'none'

            if (delta < 0) {
              transform = 'translateY(-115%) scale(0.96)'
              opacity = 0
              zIndex = 10
            } else if (delta === 0) {
              transform = 'translateY(0px) scale(1)'
              opacity = 1
              zIndex = 30
              pointerEvents = 'auto'
            } else if (delta <= 3) {
              transform = `translateY(${delta * 12}px) scale(${1 - delta * 0.035})`
              opacity = 1
              zIndex = 30 - delta
            } else {
              transform = `translateY(${3 * 12}px) scale(${1 - 3 * 0.035})`
              opacity = 0
              zIndex = 1
            }

            const negatif = (Number(a.saldo) || 0) < 0
            const log = a.mutasiTerakhir ? logMutasi(a.mutasiTerakhir) : null

            return (
              <div
                key={a.id}
                className={`rekening-stack-card clay clay-card ${
                  negatif ? 'clay-key-danger' : 'clay-key-blue'
                } absolute inset-x-1.5 top-1.5 rounded-[22px] bg-white p-3.5 select-none transition-all duration-300 ease-out`}
                style={{
                  transform,
                  opacity,
                  zIndex,
                  pointerEvents,
                  boxShadow:
                    delta === 0
                      ? '0 10px 25px -5px rgba(29, 78, 216, 0.16), 0 8px 10px -6px rgba(29, 78, 216, 0.1)'
                      : '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                }}
              >
                {/* Header Kartu — Ikon bank kecil bulat biru + nama + badge tipe + aksi */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center shrink-0 shadow-none">
                      <span className="material-symbols-outlined text-blue-700 text-[14px]">account_balance</span>
                    </div>
                    <span className="font-bold text-base text-slate-800 truncate">{a.nama}</span>
                  </div>
                  {a.tipe && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium shrink-0 whitespace-nowrap ml-auto">
                      {a.tipe}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setModal({ open: true, edit: a }) }}
                    title="Edit rekening"
                    aria-label="Edit rekening"
                    className="clay-chip clay-key-neutral w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[15px]">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setHapusTarget(a) }}
                    title="Hapus rekening"
                    aria-label="Hapus rekening"
                    className="clay-chip clay-key-neutral w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[15px]">delete</span>
                  </button>
                </div>

                {/* Saldo Akhir */}
                <div className="mb-2">
                  <p className="text-xs text-slate-400">Saldo Akhir</p>
                  <p className={`font-mono text-lg font-bold ${negatif ? 'text-expense' : 'text-slate-800'}`}>
                    {formatRupiah(a.saldo)}
                  </p>
                </div>

                {/* Perubahan Terakhir (full width box persis GAS rek-last-change-box) */}
                <div className="bg-slate-50 rounded-lg px-2.5 py-2">
                  <p className="text-xs font-semibold text-slate-400 mb-1">Perubahan Terakhir</p>
                  {log ? (
                    <>
                      <p className={`text-xs ${log.warna} font-mono truncate`}>{log.teks}</p>
                      <p className="text-[10px] text-blue-700/70 mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">touch_app</span>
                        Geser kartu utk ganti rekening
                      </p>
                    </>
                  ) : (
                    <p className="text-[10px] text-slate-400">Belum ada riwayat</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ===== DESKTOP ONLY: GRID LIST ===== */}
      <div className="hidden md:grid md:grid-cols-2 gap-3 mt-4">
        {akunList.map((a) => {
          const negatif = (Number(a.saldo) || 0) < 0
          const log = a.mutasiTerakhir ? logMutasi(a.mutasiTerakhir) : null
          return (
            <div
              key={a.id}
              className={`clay clay-card bg-surfaceContainerLowest p-4 rounded-[22px] transition-all duration-200 ${
                negatif ? 'clay-key-danger' : 'clay-key-blue'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-blue-700 text-[16px]">account_balance</span>
                </div>
                <p className="font-bold text-base text-slate-800 truncate flex-1">{a.nama}</p>
                {a.tipe && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium shrink-0">
                    {a.tipe}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setModal({ open: true, edit: a })}
                  className="clay-chip clay-key-neutral w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHapusTarget(a)}
                  className="clay-chip clay-key-neutral w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                </button>
              </div>
              <div className="mb-2">
                <p className="text-xs text-slate-400">Saldo Akhir</p>
                <p className={`font-mono text-lg font-bold ${negatif ? 'text-expense' : 'text-slate-800'}`}>
                  {formatRupiah(a.saldo)}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg px-2.5 py-2">
                <p className="text-xs font-semibold text-slate-400 mb-0.5">Perubahan Terakhir</p>
                <p className={`text-xs font-mono truncate ${log ? log.warna : 'text-slate-400'}`}>
                  {log ? log.teks : 'Belum ada riwayat'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

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
              <button onClick={() => setHapusTarget(null)} className="clay-btn-soft btn-md text-xs font-bold text-slate-600">Batal</button>
              <button onClick={konfirmHapus} className="clay-btn-danger btn-md text-xs font-bold">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
