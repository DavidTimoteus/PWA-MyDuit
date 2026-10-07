// State riwayat transaksi (docs) di balik useTransaksi — sengaja dipisah
// jadi fungsi murni supaya bisa diuji di Node tanpa Firestore/DOM.
//
// Dua jaminan yang dikunci di file ini:
//  1. Ganti filter -> dokumen lama DIBUANG. Tanpa ini, langkah "Muat lagi"
//     (yang mempertahankan dokumen di luar halaman pertama) menyuntikkan
//     dokumen filter sebelumnya ke daftar baru: pilih "Semua Transaksi" lalu
//     kembali ke "Hari Ini", tampilannya tidak pernah berubah.
//  2. Tanpa halaman lanjutan, snapshot adalah kebenaran tunggal — transaksi
//     yang dihapus langsung hilang dari daftar, bukan "hidup lagi" karena
//     dianggap dokumen halaman lanjutan.

export const RIWAYAT_AWAL = { kunci: null, adaLanjutan: false, docs: [] }

// Gabungkan halaman pertama (live onSnapshot, maks PAGE_SIZE dokumen) dengan
// riwayat halaman lanjutan hasil "Muat lagi".
export function gabungSnapshot({ prev, list, adaLanjutan }) {
  if (!adaLanjutan) return list
  if (prev.length <= list.length) return list
  const idsBaru = new Set(list.map((t) => t.id))
  return [...list, ...prev.filter((t) => !idsBaru.has(t.id))]
}

// Aksi:
//   { type: 'mulai', kunci }        -> langganan query baru (ganti filter/uid)
//   { type: 'snapshot', kunci, list } -> halaman pertama terbaru dari Firestore
//   { type: 'lanjut', kunci, list }   -> hasil getDocs "Muat lagi"
export function kurangRiwayat(state, aksi) {
  switch (aksi.type) {
    case 'mulai': {
      // Query sama -> state dipertahankan (sinkronisasi ulang bukan ganti filter).
      if (aksi.kunci === state.kunci) return state
      return { kunci: aksi.kunci, adaLanjutan: false, docs: [] }
    }
    case 'snapshot': {
      // Langganan basi (kunci sudah berganti) -> abaikan, jangan menuliskan
      // dokumen filter lama ke daftar filter baru.
      if (aksi.kunci !== state.kunci) return state
      return {
        ...state,
        docs: gabungSnapshot({ prev: state.docs, list: aksi.list, adaLanjutan: state.adaLanjutan }),
      }
    }
    case 'lanjut': {
      if (aksi.kunci !== state.kunci) return state
      const ada = new Set(state.docs.map((t) => t.id))
      return {
        ...state,
        adaLanjutan: true,
        docs: [...state.docs, ...aksi.list.filter((t) => !ada.has(t.id))],
      }
    }
    default:
      return state
  }
}
