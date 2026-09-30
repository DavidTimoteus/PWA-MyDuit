/**
 * pesanErrorSimpan — ubah error Firestore jadi kalimat yang bisa ditindaklanjuti.
 *
 * Mengapa perlu
 * -------------
 * Semua alur simpan memakai Optimistic UI: modal ditutup lebih dulu, penulisan
 * berjalan di latar. Kalau gagal, satu-satunya hal yang dilihat user adalah
 * pesan. Pesan "Gagal menyimpan transaksi." memberi tahu APA yang gagal, tapi
 * tidak MENGAPA dan tidak APA YANG HARUS DILAKUKAN — padahal penyebabnya
 * berbeda-beda dan tindakannya berbeda: offline cukup menunggu, permission
 * butuh login ulang, kuota butuh tunggu besok.
 *
 * Kode error Firestore dipetakan ke kalimat spesifik. Kode tak dikenal tetap
 * menampilkan pesan aslinya supaya tidak menyesatkan.
 */

const PETA = {
  'unavailable': 'Koneksi ke server terputus. Data tersimpan di perangkat dan akan dikirim otomatis saat online kembali.',
  'deadline-exceeded': 'Server tidak merespons. Data sudah tersimpan di perangkat dan akan dikirim otomatis.',
  'permission-denied': 'Akun ini tidak punya izin menulis. Coba keluar lalu masuk kembali.',
  'unauthenticated': 'Sesi login sudah berakhir. Silakan masuk kembali.',
  'resource-exhausted': 'Kuota harian tercapai. Coba lagi besok, atau hubungi pemilik proyek Firebase.',
  'failed-precondition': 'Data prasyarat belum lengkap (misalnya rekening belum dibuat).',
  'not-found': 'Data yang ingin diubah sudah tidak ada. Muat ulang halaman.',
  'aborted': 'Terjadi konflik penulisan bersamaan. Coba simpan sekali lagi.',
  'cancelled': 'Proses dibatalkan sebelum selesai.',
  'invalid-argument': 'Data yang dikirim tidak valid. Periksa kembali isian form.',
}

/** Ambil kode dari error Firestore (bentuknya "firestore/permission-denied"). */
function kodeError(e) {
  const raw = e?.code ?? e?.name ?? ''
  if (typeof raw !== 'string') return ''
  return raw.includes('/') ? raw.split('/').pop() : raw
}

export function pesanErrorSimpan(aksi, e) {
  const kode = kodeError(e)
  const khusus = PETA[kode]
  if (khusus) return `${aksi} gagal. ${khusus}`

  // Pesan asli dipakai kalau ada — lebih baik daripada kalimat generik.
  const asli = String(e?.message ?? '').trim()
  if (asli && asli.length < 160) return `${aksi} gagal: ${asli}`
  return `${aksi} gagal karena kesalahan tak terduga. Coba lagi sebentar lagi.`
}
