// Self-check mata uang aktif: `node src/lib/format.check.mjs`
// Memverifikasi prioritas lokasi manual > deteksi otomatis, dan bahwa cache
// mata uang di format.js benar-benar direset oleh simpanNegaraManual().
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
// Node >=21 punya `navigator` global read-only, jadi override lewat defineProperty.
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true })
globalThis.window = { dispatchEvent: () => {} }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }

const f = await import('./format.js')

// Otomatis: tanpa pilihan manual, ikut timezone/locale (di CI biasanya en-US).
f.simpanNegaraManual('')
assert.equal(f.detectCountryInfo(navigator.language).manual, false)

// Manual menang & seluruh formatter ikut berubah.
f.simpanNegaraManual('US')
assert.equal(f.detectCurrency(navigator.language), 'USD')
assert.equal(f.detectLocale(), 'en-US')
assert.equal(f.simbolUang(), 'US$')
assert.equal(f.formatRupiah(1234567), 'US$1,234,567')
assert.equal(f.formatNominal(1234567), '1,234,567')
assert.equal(f.formatRibuanInput('1234567'), '1,234,567')

// Ganti negara -> cache modul harus ikut invalid (bukan nilai USD lama).
f.simpanNegaraManual('ID')
assert.equal(f.simbolUang(), 'Rp')
assert.equal(f.formatRupiah(1234567), 'Rp1.234.567')
assert.equal(f.formatRupiah(-5000, { tanda: true }), '− Rp5.000')

// Kode kosong = balik ke deteksi otomatis.
f.simpanNegaraManual('')
assert.equal(f.negaraManual(), '')

// parseNominal tetap toleran terhadap pemisah locale apa pun.
assert.equal(f.parseNominal('1,234,567'), 1234567)
assert.equal(f.parseNominal('1.234.567'), 1234567)

console.log('format.check: OK')
