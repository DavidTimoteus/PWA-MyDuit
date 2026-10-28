import { useEffect, useState } from 'react'

// Splash screen MyDuit — tema hijau signature.
// Background: gradien hijau gelap #1b4332 → #2d6a4f → #40916c.
// Logo: kotak squircle clay hijau + favicon SVG (anti-flash, tanpa webfont).
// Judul + tagline memakai teks putih/krem kontras tinggi di atas hijau.
// Dot spinner putih semi-transparan (rgba 255,255,255,0.7).
// Ditampilkan di atas segalanya (z-99999), lalu fade-out smooth & dihapus dari DOM
// setelah ~1.4 detik (min waktu agar animasi masuk terasa) atau setelah
// aplikasi siap dipakai (mana yang lebih akhir).
export default function Splash({ ready }) {
  const [leaving, setLeaving] = useState(false)
  const [mounted, setMounted] = useState(true)

  useEffect(() => {
    const minTime = 1400
    const fadeMs = 450
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
          <img src="/favicon.svg" alt="MyDuit" className="w-12 h-12" width="48" height="48" />
        </div>
        <div className="splash-title font-display font-extrabold tracking-tight text-white text-3xl">
          MyDuit
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
