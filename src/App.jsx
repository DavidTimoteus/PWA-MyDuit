import { isFirebaseConfigured } from './lib/firebase.js'

export default function App() {
  const siap = isFirebaseConfigured()

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-dark via-primary to-primary-light text-3xl font-extrabold text-white">
          M
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">MyDuit</h1>
        <p className="mt-1 text-sm font-semibold text-slate-400">
          Catat. Pantau. Kendalikan.
        </p>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left text-xs leading-relaxed text-slate-600">
          {siap ? (
            <>
              Konfigurasi Firebase terbaca. Lanjut ke <strong>Fase 1</strong>: login
              Google + shell UI.
            </>
          ) : (
            <>
              Belum dikonfigurasi — salin <code>.env.example</code> menjadi{' '}
              <code>.env.local</code>, isi nilai dari Firebase Console, lalu jalankan
              ulang dev server.
            </>
          )}
        </div>
      </div>
    </div>
  )
}
