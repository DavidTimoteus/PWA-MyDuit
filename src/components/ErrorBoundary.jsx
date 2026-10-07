import { Component } from 'react'

/**
 * ErrorBoundary — jaring pengaman terakhir.
 *
 * Mengapa ada
 * -----------
 * Sebelumnya, satu error apa pun saat render (mis. chunk lazy yang gagal
 * diunduh setelah deploy baru, atau data Firestore yang bentuknya tak terduga)
 * membuat React melepas seluruh pohon dan menyisakan <div id="root"> kosong —
 * pengguna hanya melihat layar putih tanpa petunjuk apa pun, padahal catatan
 * keuangannya mungkin baik-baik saja. Boundary ini menggantinya dengan pesan
 * yang bisa ditindaklanjuti dan tombol muat ulang.
 *
 * Kasus khusus "chunk hilang" (ChunkLoadError / "Failed to fetch dynamically
 * imported module"): penyebabnya hampir selalu tab lama yang masih memegang
 * index.html lama sementara berkas ber-hash-nya sudah diganti deploy baru.
 * Muat ulang sekali menyelesaikannya, jadi kami melakukannya otomatis —
 * dengan penjaga sekali-per-sesi supaya tidak jadi loop muat ulang.
 */

const KEY_RELOAD = 'myduit-chunk-reload'

function pesanRamah(error) {
  const m = String(error?.message ?? error ?? '')
  if (/dynamically imported module|ChunkLoadError|Loading chunk|Importing a module script failed/i.test(m)) {
    return 'Versi aplikasi baru saja diperbarui. Muat ulang untuk melanjutkan.'
  }
  if (/network|offline|Failed to fetch/i.test(m)) {
    return 'Koneksi terputus. Periksa jaringan lalu coba lagi.'
  }
  return 'Terjadi kesalahan tak terduga saat menampilkan halaman.'
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[MyDuit] render error:', error, info?.componentStack)
    const m = String(error?.message ?? error ?? '')
    const chunkHilang = /dynamically imported module|ChunkLoadError|Loading chunk|Importing a module script failed/i.test(m)
    // Muat ulang otomatis HANYA sekali per sesi, khusus chunk hilang.
    if (chunkHilang && !sessionStorage.getItem(KEY_RELOAD)) {
      sessionStorage.setItem(KEY_RELOAD, '1')
      window.location.reload()
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const detail = String(error?.message ?? error ?? '')
    return (
      <div className="min-h-full flex items-center justify-center bg-surface p-6">
        <div className="clay-card w-full max-w-md rounded-[28px] p-6 text-center">
          <span className="material-symbols-outlined icon-hero text-amber-600">error</span>
          <h1 className="mt-3 text-lg font-extrabold text-slate-800">Aplikasi gagal dimuat</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{pesanRamah(error)}</p>
          <button
            onClick={() => window.location.reload()}
            className="clay-btn-primary btn-md mt-5 w-full"
          >
            Muat ulang
          </button>
          {detail && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                Detail teknis
              </summary>
              <pre className="mt-2 overflow-auto rounded-xl bg-slate-100 p-3 text-[11px] text-slate-600">
                {detail}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
