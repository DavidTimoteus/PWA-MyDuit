import { useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format.js'
import { enrichTransaksi } from '../../lib/db.js'
import { useAkunKategori } from '../../lib/useAkunKategori.js'
import { useTransaksi } from '../transaksi/useTransaksi.js'
import { useBudgetBulan } from './useBudgetBulan.js'
import BudgetPanel from './BudgetPanel.jsx'
import FormBudgetModal from './FormBudgetModal.jsx'
import RekeningPanel from './RekeningPanel.jsx'

const NAMA_BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function rangeBulan(tahun, bulanIdx) {
  const awal = new Date(tahun, bulanIdx, 1)
  const akhir = new Date(tahun, bulanIdx + 1, 0)
  const f = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: f(awal), end: f(akhir) }
}

function labelPeriode(bulan, tahun) {
  return `${NAMA_BULAN_ID[bulan]} ${tahun}`
}

// Tab Budget = sub-tab Rekening | Budget (pola ViewBudget.html GAS).
// Layout mengikuti ViewBudget.html + DesktopPrototype-Budget.html:
// - Header mobile (md:hidden): logo savings biru + judul "Rekening" (placeholder sesuai GAS)
// - Sub-tab toggle pill (Rekening | Budget) — aktif = inset shadow
// - Hero "Total Saldo" (gradient biru) atau "Total Budget" (gradient biru)
// - Daftar (Rekening list atau Budget list)
export default function BudgetView({ user }) {
  const uid = user.uid
  const [sub, setSub] = useState('rekening')

  // State periode untuk sub-tab Budget
  const [bulan, setBulan] = useState(new Date().getMonth())
  const [tahun, setTahun] = useState(new Date().getFullYear())
  const today = useMemo(() => new Date(), [])

  // Data bersama
  const range = useMemo(() => rangeBulan(tahun, bulan), [bulan, tahun])
  const budgets = useBudgetBulan(uid, bulan, tahun)
  const { docs: transBulan } = useTransaksi(uid, { jenis: 'pengeluaran', range })
  const { akunList, kategoriList } = useAkunKategori(uid)
  const akunById = useMemo(() => Object.fromEntries(akunList.map((a) => [a.id, a])), [akunList])
  const katById = useMemo(() => Object.fromEntries(kategoriList.map((k) => [k.id, k.nama])), [kategoriList])
  const transEnriched = useMemo(() => enrichTransaksi(transBulan, akunById, katById), [transBulan, akunById, katById])

  // Modal Budget
  const [modal, setModal] = useState({ open: false, edit: null })
  const [hapusTarget, setHapusTarget] = useState(null)

  // Listen event dari FAB bottom nav (buka Tambah Rekening / Tambah Budget)
  useEffect(() => {
    const handler = () => {
      if (sub === 'budget') {
        setModal({ open: true, edit: null })
      } else {
        window.dispatchEvent(new CustomEvent('myduit:buka-tambah-rekening'))
      }
    }
    window.addEventListener('myduit:buka-tambah-budget-rekening', handler)
    return () => window.removeEventListener('myduit:buka-tambah-budget-rekening', handler)
  }, [sub])

  // Hitung agregat budget (mirip dengan yang lama, untuk kirim ke panel kanan)
  const ringkasan = useMemo(() => {
    const terpakaiPerKategori = {}
    for (const t of transEnriched) {
      if (t.kategoriId) terpakaiPerKategori[t.kategoriId] = (terpakaiPerKategori[t.kategoriId] || 0) + (t.jumlah || 0)
    }
    const list = budgets.map((b) => {
      const terpakai = terpakaiPerKategori[b.kategoriId] || 0
      const limit = b.limitNominal || 0
      const persen = limit > 0 ? Math.min(999, Math.round((terpakai / limit) * 100)) : 0
      const hampirHabis = persen >= 80
      const kategoriNama = b.kategoriNama ?? katById[b.kategoriId] ?? '?'
      return { ...b, kategoriNama, terpakai, persen, hampirHabis }
    })
    const totalLimit = budgets.reduce((s, b) => s + (b.limitNominal || 0), 0)
    const totalTerpakai = Object.values(terpakaiPerKategori).reduce((s, n) => s + n, 0)
    const sisa = totalLimit - totalTerpakai
    const persen = totalLimit > 0 ? Math.min(999, Math.round((totalTerpakai / totalLimit) * 100)) : 0
    const tglSekarang = today.getDate()
    const akhirBulan = new Date(tahun, bulan + 1, 0).getDate()
    const hariTersisa = Math.max(1, akhirBulan - tglSekarang + 1)
    const burnPerHari = totalTerpakai > 0 ? Math.round(totalTerpakai / Math.max(1, tglSekarang)) : 0
    const hampirHabis = list.filter((b) => b.hampirHabis).map((b) => ({
      kategoriId: b.kategoriId,
      nama: b.kategoriNama,
      terpakai: b.terpakai,
      limit: b.limitNominal,
      persen: b.persen,
    }))
    return { totalLimit, totalTerpakai, sisa, persen, lewat: totalTerpakai > totalLimit, hariTersisa, burnPerHari, hampirHabis, list }
  }, [budgets, transEnriched, katById, tahun, bulan, today])

  // Emit ringkasan ke panel kanan Budget
  useEffect(() => {
    if (sub !== 'budget') return
    const event = new CustomEvent('myduit:budget-update', {
      detail: {
        totalLimit: ringkasan.totalLimit,
        terpakai: ringkasan.totalTerpakai,
        sisa: ringkasan.sisa,
        persen: ringkasan.persen,
        lewat: ringkasan.lewat,
        hariTersisa: ringkasan.hariTersisa,
        burnPerHari: ringkasan.burnPerHari,
        hampirHabis: ringkasan.hampirHabis,
        akunList: akunList.length,
      },
    })
    window.dispatchEvent(event)
  }, [sub, ringkasan, akunList])

  // Emit ringkasan ke sidebar kiri (Insight Budget)
  useEffect(() => {
    if (sub !== 'budget') return
    const event = new CustomEvent('myduit:sidebar-insight-budget', {
      detail: {
        kategoriTerdikit: ringkasan.hampirHabis[0] || null,
        totalLimit: ringkasan.totalLimit,
        totalTerpakai: ringkasan.totalTerpakai,
        persen: ringkasan.persen,
      },
    })
    window.dispatchEvent(event)
  }, [sub, ringkasan])

  // Navigate periode (bulan/tahun), pola sama dengan tab Statistik — retensi 1 tahun
  function navigatePeriode(dir) {
    let b = bulan + dir
    let th = tahun
    if (b < 0) { b = 11; th-- }
    else if (b > 11) { b = 0; th++ }
    // Cegah masa depan & hanya boleh mundur 1 tahun
    if (th > today.getFullYear() || (th === today.getFullYear() && b > today.getMonth())) return
    if (th < today.getFullYear() - 1) return
    setBulan(b)
    setTahun(th)
  }

  const bisaMundur = !(bulan === 0 && tahun === today.getFullYear() - 1)
  const bisaMaju = !(tahun === today.getFullYear() && bulan >= today.getMonth())

  // Sub-tab Rekening: hero Total Saldo + daftar rekening
  // Sub-tab Budget: navigator + hero Total Budget + daftar budget
  return (
    <section className="mx-auto max-w-3xl px-5 pb-32 md:pb-10">
      {/* Header mobile (md:hidden) — logo savings biru + judul "Rekening" (persis GAS ViewBudget.html) */}
      <header className="flex items-center gap-2 pt-3 pb-4 md:hidden">
        <div className="clay-icon-tile clay-key-blue flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md">
          <span className="material-symbols-outlined icon-md" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
        </div>
        <h2 className="font-display font-extrabold text-2xl sm:text-[28px] leading-tight tracking-tight text-blue-950">
          {sub === 'budget' ? 'Budget' : 'Rekening'}
        </h2>
      </header>

      {/* Sub-tab toggle pill (Rekening | Budget) — pola persis GAS budgetSubTab */}
      <div className="mb-4 flex items-center gap-1 rounded-xl bg-slate-100 p-1 md:mt-5">
        <button
          onClick={() => setSub('rekening')}
          aria-pressed={sub === 'rekening'}
          className={`budget-subtab-btn flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
            sub === 'rekening'
              ? 'bg-white text-blue-700'
              : 'text-textSecondary hover:text-textPrimary'
          }`}
          style={
            sub === 'rekening'
              ? { boxShadow: 'inset 3px 3px 7px rgba(0,0,0,.18), inset -3px -3px 7px rgba(255,255,255,.9)' }
              : undefined
          }
        >
          <span className="material-symbols-outlined icon-md" style={{ fontVariationSettings: sub === 'rekening' ? "'FILL' 1" : "'FILL' 0" }}>account_balance</span>
          Rekening
        </button>
        <button
          onClick={() => setSub('budget')}
          aria-pressed={sub === 'budget'}
          className={`budget-subtab-btn flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
            sub === 'budget'
              ? 'bg-white text-blue-700'
              : 'text-textSecondary hover:text-textPrimary'
          }`}
          style={
            sub === 'budget'
              ? { boxShadow: 'inset 3px 3px 7px rgba(0,0,0,.18), inset -3px -3px 7px rgba(255,255,255,.9)' }
              : undefined
          }
        >
          <span className="material-symbols-outlined icon-md" style={{ fontVariationSettings: sub === 'budget' ? "'FILL' 1" : "'FILL' 0" }}>savings</span>
          Budget
        </button>
      </div>

      {sub === 'rekening' ? (
        <RekeningPanel uid={uid} />
      ) : (
        <>
          {/* Period Navigator (bulan/tahun) */}
          <div className="mb-3 flex shrink-0 items-center justify-center gap-3">
            <button
              onClick={() => navigatePeriode(-1)}
              disabled={!bisaMundur}
              aria-label="Periode sebelumnya"
              className="clay-pagination-arrow clay-key-neutral flex h-8 w-8 items-center justify-center rounded-full bg-white"
            >
              <span className="material-symbols-outlined icon-md text-slate-600">chevron_left</span>
            </button>
            <span className="min-w-[140px] text-center text-sm font-bold text-slate-800">{labelPeriode(bulan, tahun)}</span>
            <button
              onClick={() => navigatePeriode(1)}
              disabled={!bisaMaju}
              aria-label="Periode berikutnya"
              className="clay-pagination-arrow clay-key-neutral flex h-8 w-8 items-center justify-center rounded-full bg-white"
            >
              <span className="material-symbols-outlined icon-md text-slate-600">chevron_right</span>
            </button>
          </div>

          {/* Hero Total Budget — gradient biru (persis GAS) */}
          <div className="clay clay-key-blue mb-4 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-5 text-white">
            <p className="mb-1 text-xs opacity-90 sm:text-sm">Total Budget</p>
            <p className="font-mono mb-2 text-xl font-extrabold sm:text-2xl">{formatRupiah(ringkasan.totalLimit)}</p>
            <div className="flex items-center justify-between text-[11px] opacity-90">
              <span>Terpakai: {formatRupiah(ringkasan.totalTerpakai)}</span>
              <span>Sisa: {formatRupiah(ringkasan.sisa)}</span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
              <div
                className={`h-full rounded-full transition-all ${ringkasan.lewat ? 'bg-red-300' : 'bg-white'}`}
                style={{ width: `${Math.min(100, ringkasan.persen)}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
              <div>
                <p className="text-[10px] font-medium opacity-80">Pemasukan bulan ini</p>
                <p className="font-mono text-xs font-bold">—</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium opacity-80">Pengeluaran bulan ini</p>
                <p className="font-mono text-xs font-bold">—</p>
              </div>
            </div>
          </div>

          {/* Daftar budget */}
          <BudgetPanel
            uid={uid}
            kategoriList={kategoriList}
            bulan={bulan}
            tahun={tahun}
            budgets={ringkasan.list}
            modal={modal}
            setModal={setModal}
            hapusTarget={hapusTarget}
            setHapusTarget={setHapusTarget}
          />
        </>
      )}

      {/* Modal Form Budget */}
      <FormBudgetModal
        open={modal.open}
        edit={modal.edit}
        uid={uid}
        kategoriList={kategoriList}
        existing={ringkasan.list}
        bulan={bulan}
        tahun={tahun}
        onClose={() => setModal({ open: false, edit: null })}
      />
    </section>
  )
}
