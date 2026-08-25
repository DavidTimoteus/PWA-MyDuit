import AuthScreen from './components/AuthScreen.jsx'
import Shell from './components/Shell.jsx'
import { useAuth } from './features/auth/useAuth.js'
import { isFirebaseConfigured } from './lib/firebase.js'

function LayarTunggu() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-primary-light">
      <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-white/15 text-3xl font-extrabold text-white">
        M
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white/70">MyDuit</p>
    </div>
  )
}

function LayarSetup(error) {
  return (
    <div className="min-h-full flex items-center justify-center bg-surface p-6">
      <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow">
        <h1 className="text-lg font-extrabold text-slate-800">Konfigurasi belum lengkap</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{error}</p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isFirebaseConfigured()) {
    return (
      <LayarSetup error="Salin .env.example menjadi .env.local lalu isi nilai Firebase, kemudian jalankan ulang dev server." />
    )
  }

  const { status, user, error } = useAuth()
  if (status === 'loading') return <LayarTunggu />
  if (status === 'error') return <LayarSetup error={error} />
  if (!user) return <AuthScreen />
  return <Shell user={user} />
}
