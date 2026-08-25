// Helper format & tanggal (konvensi Indonesia, Rupiah integer).

export function formatRupiah(n, { tanda = false } = {}) {
  const v = Number(n) || 0
  const abs = Math.abs(v).toLocaleString('id-ID')
  if (tanda) return `${v < 0 ? '−' : '+'} Rp${abs}`
  return `${v < 0 ? '−' : ''}Rp${abs}`
}

// "12.500" -> 12500 ; menerima input bebas
export function parseNominal(str) {
  const digits = String(str ?? '').replace(/\D/g, '')
  return digits ? parseInt(digits, 10) : 0
}

// Untuk input live: angka -> "12.500"
export function formatRibuanInput(str) {
  const v = parseNominal(str)
  return v ? v.toLocaleString('id-ID') : ''
}

export function isoHariIni() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoDari(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Label grup tanggal: Hari Ini / Kemarin / "Senin, 12 Mei 2026"
export function tanggalLabel(iso) {
  const hari = isoHariIni()
  if (iso === hari) return 'Hari Ini'
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (iso === isoDari(y)) return 'Kemarin'
  const d = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

export function tanggalPendek(iso) {
  const d = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d)
}

// Rentang tanggal untuk chip filter. 'semua' -> null (tanpa batas).
export function rangeForFilter(chip, rentang = {}) {
  const now = new Date()
  const today = isoHariIni()
  switch (chip) {
    case 'hari':
      return { start: today, end: today }
    case 'minggu': {
      const d = new Date(now)
      const day = (d.getDay() + 6) % 7 // Senin = 0
      d.setDate(d.getDate() - day)
      return { start: isoDari(d), end: today }
    }
    case 'bulan': {
      const awal = new Date(now.getFullYear(), now.getMonth(), 1)
      const akhir = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start: isoDari(awal), end: isoDari(akhir) }
    }
    case 'tahun':
      return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` }
    case 'rentang':
      return { start: rentang.start || '0000-01-01', end: rentang.end || '9999-12-31' }
    default:
      return null // semua
  }
}
