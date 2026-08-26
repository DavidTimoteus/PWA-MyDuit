import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import TransaksiView from '../features/transaksi/TransaksiView.jsx'
import BudgetView from '../features/budget/BudgetView.jsx'
import UtangView from '../features/utang/UtangView.jsx'
import StatistikView from '../features/statistik/StatistikView.jsx'
import InstallButton from './InstallButton.jsx'
import { getFirebase } from '../lib/firebase.js'

const TABS = [
  { id: 'transaksi', label: 'Transaksi', icon: 'receipt_long', fase: 'Fase 2' },
  { id: 'budget', label: 'Budget', icon: 'account_balance_wallet', fase: 'Fase 3' },
  { id: 'statistik', label: 'Statistik', icon: 'bar_chart', fase: 'Fase 4' },
  { id: 'utang', label: 'Utang', icon: 'payments', fase: 'Fase 3' },
]

function Avatar({ user, size = 'h-9 w-9 text-sm' }) {
  if (user.photoURL) {
    return <img src={user.photoURL} alt="" className={`${size} rounded-full object-cover`} referrerPolicy="no-referrer" />
  }
  const inisial = (user.displayName || user.email || '?').charAt(0).toUpperCase()
  return (
    <div className={`${size} flex items-center justify-center rounded-full bg-gradient-to-br from-primary-dark to-primary-light font-extrabold text-white`}>
      {inisial}
    </div>
  )
}

export default function Shell({ user }) {
  const [tab, setTab] = useState('transaksi')
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const aktif = TABS.find((t) => t.id === tab)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  async function keluar() {
    const { auth } = getFirebase()
    await signOut(auth)
  }

  return (
    <div className="min-h-full md:flex">
      {/* ===== SIDEBAR DESKTOP ===== */}
      <aside className="hidden md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-slate-200/70 md:bg-white">
        <div className="flex items-center gap-3 px-5 pb-4 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-dark via-primary to-primary-light text-lg font-extrabold text-white shadow">
            M
          </div>
          <div>
            <p className="text-base font-extrabold tracking-tight text-slate-800">MyDuit</p>
            <p className="text-[11px] font-semibold text-slate-400">Catat. Pantau. Kendalikan.</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${
                tab === t.id
                  ? 'bg-primary text-white shadow'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${tab === t.id ? '[font-variation-settings:"FILL"_1]' : ''}`}>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-2">
          <InstallButton variant="sidebar" />
        </div>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <Avatar user={user} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{user.displayName ?? 'Pengguna'}</p>
              <p className="truncate text-[11px] font-semibold text-slate-400">{user.email}</p>
            </div>
            <button
              onClick={keluar}
              title="Keluar"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-500 hover:text-white"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ===== KONTEN UTAMA ===== */}
      <main className="flex-1 pb-24 md:pb-6">
        {!online && (
          <div className="sticky top-0 z-10 flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-[11px] font-bold text-amber-900">
            <span className="material-symbols-outlined text-[14px]">wifi_off</span>
            Mode offline — perubahan tersimpan di perangkat & otomatis tersinkron saat daring.
          </div>
        )}
        {/* Header mobile */}
        <header className="flex items-center justify-between px-5 pt-6 md:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-dark via-primary to-primary-light text-lg font-extrabold text-white shadow">
              M
            </div>
            <div>
              <p className="text-base font-extrabold tracking-tight text-slate-800">MyDuit</p>
              <p className="text-[11px] font-semibold text-slate-400">Catat. Pantau. Kendalikan.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InstallButton variant="chip" />
            <Avatar user={user} size="h-9 w-9 text-xs" />
            <button
              onClick={keluar}
              title="Keluar"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors active:bg-red-500 active:text-white"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </header>

        {/* Konten modul aktif */}
        {tab === 'transaksi' ? (
          <TransaksiView user={user} />
        ) : tab === 'budget' ? (
          <BudgetView user={user} />
        ) : tab === 'utang' ? (
          <UtangView user={user} />
        ) : tab === 'statistik' ? (
          <StatistikView user={user} />
        ) : (
          <section className="mx-auto mt-6 max-w-3xl px-5">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">{aktif.label}</h2>
            <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
              <span className="material-symbols-outlined mb-3 text-5xl text-primary/40">{aktif.icon}</span>
              <p className="text-sm font-bold text-slate-700">Modul {aktif.label} menyusul di {aktif.fase}.</p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-400">
                Fondasi offline-first (Auth + Firestore persistence) sudah siap — konten modul dibangun bertahap sesuai roadmap.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* ===== BOTTOM NAV MOBILE ===== */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors ${
                tab === t.id ? 'text-primary' : 'text-slate-400'
              }`}
            >
              <span className={`material-symbols-outlined text-[24px] ${tab === t.id ? '[font-variation-settings:"FILL"_1]' : ''}`}>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
