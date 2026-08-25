import { useEffect, useState } from 'react'
import { canInstall, isIOS, isStandalone, onInstallAvailable, promptInstall } from '../lib/pwa.js'

// Tombol "Install App".
// - Sudah standalone (dibuka sebagai app) -> tidak dirender.
// - Browser dukung beforeinstallprompt -> langsung prompt.
// - iOS Safari -> buka petunjuk manual Share > Add to Home Screen.
// variant: 'sidebar' (item lebar) | 'chip' (pill kecil utk header mobile)
export default function InstallButton({ variant = 'sidebar' }) {
  const [available, setAvailable] = useState(false)
  const [hint, setHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) return undefined
    return onInstallAvailable(setAvailable)
  }, [])

  if (isStandalone()) return null

  const tampil = available || isIOS()
  if (!tampil) return null

  async function klik() {
    if (canInstall()) {
      await promptInstall()
    } else {
      setHint(true)
    }
  }

  const cls =
    variant === 'sidebar'
      ? 'flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-emerald-50'
      : 'flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-primary transition-colors active:bg-primary active:text-white'

  return (
    <>
      <button onClick={klik} className={cls} title="Install aplikasi">
        <span className="material-symbols-outlined text-[20px]">install_mobile</span>
        {variant === 'sidebar' && <span>Install App</span>}
      </button>

      {hint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-sm" onClick={() => setHint(false)}>
          <div className="w-full max-w-xs rounded-[24px] bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined text-4xl text-primary">ios_share</span>
            <p className="mt-2 text-sm font-bold text-slate-800">Pasang MyDuit di iPhone</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Tekan ikon <strong>Share</strong> di bawah Safari, lalu pilih{' '}
              <strong>“Add to Home Screen”</strong>.
            </p>
            <button onClick={() => setHint(false)} className="mt-4 w-full rounded-full bg-primary py-2.5 text-xs font-extrabold text-white shadow hover:bg-primary-dark">
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  )
}
