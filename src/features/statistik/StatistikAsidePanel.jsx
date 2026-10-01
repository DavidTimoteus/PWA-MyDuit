import { useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format.js'

// Panel kanan khusus tab Statistik (desktop only). Render di Shell dengan
// `tab === 'statistik'`. Subscribe ringkasan via event `myduit:statistik-update`
// yang dikirim StatistikView tiap data berubah — menjaga panel ini tidak
// menggandakan query Firestore.
//
// Layout mengikuti GAS #asideGroupStatistik (prototipe DesktopPrototype-Statistik):
//   - Rounded-[28px] panel dengan p-5 konsisten
//   - Header "Statistik Cepat" + tombol Cetak PDF (sejajar)
//   - Update API Key AI (tombol btn-md compact)
//   - Pengeluaran Terbesar (card dengan shadow hue merah)
//   - Rasio Tabungan (card dengan shadow hue primary/hijau)
//   - Divider
//   - Label "Aksi Cepat" + 3 baris Statistik Cepat
//   - Tombol Cetak PDF dipindah ke header (konsisten dengan RightPanel Transaksi)
export default function StatistikAsidePanel() {
  const [data, setData] = useState(null)

  useEffect(() => {
    function onUpdate(e) {
      setData(e.detail)
    }
    window.addEventListener('myduit:statistik-update', onUpdate)
    return () => window.removeEventListener('myduit:statistik-update', onUpdate)
  }, [])

  // Placeholder saat pertama kali dimuat. Dibungkus useMemo supaya identitasnya
  // stabil antar-render — kalau tidak, useMemo di bawah dianggap selalu berubah.
  const ringkas = useMemo(
    () =>
      data || {
        in: 0, out: 0, saldo: 0, rataHarian: 0, akunList: 0,
        jmlTransaksi: 0, kategoriAktif: 0,
        pengeluaranTerbesar: null,
      },
    [data],
  )
  const { pengeluaranTerbesar } = ringkas

  const rasioTabungan = useMemo(() => {
    if (ringkas.in === 0) return 0
    return Math.round((ringkas.saldo / ringkas.in) * 100)
  }, [ringkas])

  const rasioBadge = useMemo(() => {
    if (ringkas.in === 0) return '—'
    if (rasioTabungan >= 30) return 'Hebat'
    if (rasioTabungan >= 15) return 'Baik'
    if (rasioTabungan >= 0) return 'Cukup'
    return 'Boros'
  }, [rasioTabungan, ringkas])

  function handleCetakPdf() {
    window.dispatchEvent(new CustomEvent('myduit:export-pdf'))
  }

  return (
    <aside className="hidden lg:flex lg:h-full lg:w-[350px] lg:min-w-[350px] lg:max-w-[350px] lg:shrink-0 lg:grow-0 lg:flex-col lg:overflow-hidden lg:p-4 lg:pl-2">
      <div className="clay clay-key-primary flex h-full flex-col overflow-hidden rounded-[28px] bg-surfaceContainerLowest p-5 w-full min-w-0">
        {/* Header — judul "Statistik Cepat" + tombol Cetak PDF di kanan */}
        <div className="flex shrink-0 items-center justify-between px-1 pb-3">
          <h2 className="text-base font-extrabold tracking-tight text-slate-800">Statistik Cepat</h2>
          <button
            onClick={handleCetakPdf}
            aria-label="Cetak PDF"
            title="Cetak PDF"
            className="pdf-action-btn clay-key-danger"
          >
            <span className="material-symbols-outlined icon-md">picture_as_pdf</span>
          </button>
        </div>
        <div className="mb-3 h-px shrink-0 bg-slate-200/70"></div>

        {/* Update API Key AI — btn-md tinggi cukup, tidak gepeng */}
        <button
          onClick={() => alert('Buka modal Update API Key AI')}
          className="clay-btn clay-key-blue btn-md mb-3 w-full shrink-0 rounded-xl bg-blue-50 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-100"
        >
          Update API Key AI
        </button>

        {/* Grup konten utama — overflow-hidden dicopot: memotong clay shadow kartu */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Pengeluaran Terbesar — shadow hue merah (clay-key-danger) */}
          <div className="clay-card clay-key-danger shrink-0 rounded-[22px] bg-surfaceContainerLowest p-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pengeluaran Terbesar</p>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <span className="material-symbols-outlined icon-md">shopping_cart</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{pengeluaranTerbesar?.nama ?? '—'}</p>
                <p className="text-[11px] leading-tight text-textSecondary">
                  {pengeluaranTerbesar ? `${((pengeluaranTerbesar.total / Math.max(1, ringkas.out)) * 100).toFixed(0)}% dari total` : 'Belum ada data periode ini'}
                </p>
              </div>
              <p className="shrink-0 font-mono text-xs font-bold text-expense">{formatRupiah(pengeluaranTerbesar?.total ?? 0)}</p>
            </div>
          </div>

          {/* Rasio Tabungan — shadow hue primary/hijau (clay-key-primary) */}
          <div className="clay-card clay-key-primary shrink-0 rounded-[22px] bg-surfaceContainerLowest p-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rasio Tabungan</p>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-xl font-extrabold text-emerald-600">{rasioTabungan}%</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{rasioBadge}</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: 'var(--color-surface)', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,.12), inset -3px -3px 7px rgba(255,255,255,.85)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(0, Math.min(100, rasioTabungan))}%`, background: 'linear-gradient(to right, var(--color-primary-light), var(--color-primary))' }}
              ></div>
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-textSecondary">Sisa pemasukan setelah pengeluaran</p>
          </div>
        </div>

        {/* Divider + Aksi Cepat section */}
        <div className="mt-3 h-px shrink-0 bg-slate-200/70"></div>
        <p className="mb-2 shrink-0 px-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Aksi Cepat</p>
        <div className="mt-0 space-y-2">
          <div className="clay-card clay-key-primary flex items-center justify-between rounded-[16px] bg-surfaceContainerLowest px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-primary">
                <span className="material-symbols-outlined icon-md">calendar_today</span>
              </div>
              <span className="truncate text-xs font-semibold text-slate-600">Rata-rata harian</span>
            </div>
            <span className="shrink-0 font-mono text-xs font-bold text-slate-800">{formatRupiah(ringkas.rataHarian)}</span>
          </div>
          <div className="clay-card clay-key-blue flex items-center justify-between rounded-[16px] bg-surfaceContainerLowest px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <span className="material-symbols-outlined icon-md">receipt</span>
              </div>
              <span className="truncate text-xs font-semibold text-slate-600">Transaksi periode ini</span>
            </div>
            <span className="shrink-0 font-mono text-xs font-bold text-slate-800">{ringkas.jmlTransaksi ?? 0}</span>
          </div>
          <div className="clay-card clay-key-neutral flex items-center justify-between rounded-[16px] bg-surfaceContainerLowest px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <span className="material-symbols-outlined icon-md">category</span>
              </div>
              <span className="truncate text-xs font-semibold text-slate-600">Kategori aktif</span>
            </div>
            <span className="shrink-0 font-mono text-xs font-bold text-slate-800">{ringkas.kategoriAktif ?? 0}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}