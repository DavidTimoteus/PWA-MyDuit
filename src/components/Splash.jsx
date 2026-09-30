import { useEffect, useState } from 'react'

// Splash screen ala GAS MyDuit — gradient hijau + logo clay savings +
// judul MyDuit animasi huruf + tagline + sub + 6 dot spinner.
// Ditampilkan di atas segalanya (z-99999), lalu fade-out & dihapus dari DOM
// setelah ~1.4 detik (min waktu agar animasi masuk terasa) atau setelah
// aplikasi siap dipakai (mana yang lebih akhir).
export default function Splash({ ready }) {
  const [leaving, setLeaving] = useState(false)
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    const minTime = 1400
    const fadeMs = 550
    let timer
    const dismiss = () => {
      setLeaving(true)
      timer = setTimeout(() => setMounted(false), fadeMs)
    }
    if (ready) {
      // Tunggu minimum waktu splash tampil, baru keluar
      timer = setTimeout(dismiss, minTime)
    }
    return () => clearTimeout(timer)
  }, [ready])

  if (!mounted) return null

  return (
    <div id="splashScreen" className={`splash-screen${leaving ? ' is-leaving' : ''}`} aria-hidden={leaving}>
      <div className="splash-inner">
        <div className="splash-logo">
          <span className="material-symbols-outlined">savings</span>
        </div>
        <div className="splash-title">
          <span className="splash-title-letter">M</span>
          <span className="splash-title-letter">y</span>
          <span className="splash-title-letter">D</span>
          <span className="splash-title-letter">u</span>
          <span className="splash-title-letter">i</span>
          <span className="splash-title-letter">t</span>
        </div>
        <div className="splash-tagline">Catat. Pantau. Kendalikan.</div>
        <div className="splash-sub">Pemasukan dan pengeluaranmu dalam satu tempat.</div>
        <div className="splash-dots" aria-hidden="true">
          <span className="splash-dot"></span>
          <span className="splash-dot"></span>
          <span className="splash-dot"></span>
          <span className="splash-dot"></span>
          <span className="splash-dot"></span>
          <span className="splash-dot"></span>
        </div>
      </div>
    </div>
  )
}
