import {
  addDoc,
  collection,
  getDocs,
  increment,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  doc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getFirebase } from './firebase.js'

// ===== KOLEKSI =====
// users/{uid}/transaksi : { jumlah(int), jenis('pemasukan'|'pengeluaran'), kategoriId,
//   kategoriNama, akunId, akunNama, tanggal('YYYY-MM-DD'), catatan, deleted, createdAt }
// users/{uid}/akun      : { nama, tipe, saldo(int), deleted, createdAt, updatedAt }
// users/{uid}/kategori  : { nama, jenis, deleted, createdAt }

export function userCol(uid, nama) {
  const { db } = getFirebase()
  return collection(db, 'users', uid, nama)
}

export function transaksiRef(uid, id) {
  const { db } = getFirebase()
  return doc(db, 'users', uid, 'transaksi', id)
}

export function akunRef(uid, id) {
  const { db } = getFirebase()
  return doc(db, 'users', uid, 'akun', id)
}

// Delta saldo: pemasukan menambah, pengeluaran mengurangi.
export function deltaSaldo(trans) {
  return trans.jenis === 'pemasukan' ? trans.jumlah : -trans.jumlah
}

// ===== KATEGORI DEFAULT (seed sekali saat pertama login) =====
export const KATEGORI_DEFAULT = {
  pemasukan: ['Gaji', 'Bonus', 'Hadiah', 'Penjualan', 'Lainnya'],
  pengeluaran: ['Makanan', 'Transportasi', 'Tagihan', 'Belanja', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'],
}

export async function seedKategoriJikaKosong(uid) {
  const snap = await getDocs(query(userCol(uid, 'kategori'), fbLimit(1)))
  if (!snap.empty) return false
  const batch = writeBatch(getFirebase().db)
  for (const jenis of Object.keys(KATEGORI_DEFAULT)) {
    for (const nama of KATEGORI_DEFAULT[jenis]) {
      const ref = doc(userCol(uid, 'kategori'))
      batch.set(ref, { nama, jenis, deleted: false, createdAt: serverTimestamp() })
    }
  }
  await batch.commit()
  return true
}

// ===== AKUN (minimal utk Fase 2; modul lengkap di Fase 3) =====
export async function tambahAkun(uid, { nama, saldoAwal = 0, tipe = 'Rekening Utama' }) {
  const ref = await addDoc(userCol(uid, 'akun'), {
    nama,
    tipe,
    saldo: Number(saldoAwal) || 0,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

// ===== TRANSAKSI CRUD (offline-first) =====
// Catatan desain: saldo akun diupdate via increment() — mutation ini masuk antrean
// offline Firestore sama seperti penulisan dokumen, jadi catat saat offline tetap
// konsisten saat online. (Trade-off v1: bukan transaksi atomik lintas dokumen;
// rekonsiliasi via mutasiLog menyusul di Fase 3.)

export async function simpanTransaksi(uid, data) {
  const trans = {
    jumlah: Number(data.jumlah),
    jenis: data.jenis,
    kategoriId: data.kategoriId,
    kategoriNama: data.kategoriNama ?? '',
    akunId: data.akunId,
    akunNama: data.akunNama ?? '',
    tanggal: data.tanggal,
    catatan: data.catatan ?? '',
    deleted: false,
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(userCol(uid, 'transaksi'), trans)
  await updateDoc(akunRef(uid, data.akunId), {
    saldo: increment(deltaSaldo(trans)),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTransaksi(uid, lama, data) {
  const baru = {
    jumlah: Number(data.jumlah),
    jenis: data.jenis,
    kategoriId: data.kategoriId,
    kategoriNama: data.kategoriNama ?? '',
    akunId: data.akunId,
    akunNama: data.akunNama ?? '',
    tanggal: data.tanggal,
    catatan: data.catatan ?? '',
  }
  await updateDoc(transaksiRef(uid, lama.id), baru)
  // Kembalikan efek saldo lama, terapkan efek baru (bisa beda akun).
  if (lama.akunId) {
    await updateDoc(akunRef(uid, lama.akunId), {
      saldo: increment(-deltaSaldo(lama)),
      updatedAt: serverTimestamp(),
    })
  }
  await updateDoc(akunRef(uid, baru.akunId), {
    saldo: increment(deltaSaldo(baru)),
    updatedAt: serverTimestamp(),
  })
}

export async function hapusTransaksi(uid, trans) {
  await updateDoc(transaksiRef(uid, trans.id), { deleted: true })
  if (trans.akunId) {
    await updateDoc(akunRef(uid, trans.akunId), {
      saldo: increment(-deltaSaldo(trans)),
      updatedAt: serverTimestamp(),
    })
  }
}

// ===== QUERY RIWAYAT =====
// Filter tanggal pakai perbandingan string 'YYYY-MM-DD' (aman kronologis).
// Butuh composite index (lihat firestore.indexes.json); bila error missing-index
// saat dev, klik link di pesan error untuk membuatnya sekali di console.
export function buildTransQuery(uid, { jenis, range, pageSize, cursor }) {
  const constraints = [where('deleted', '==', false)]
  if (jenis && jenis !== 'semua') constraints.push(where('jenis', '==', jenis))
  if (range) {
    constraints.push(where('tanggal', '>=', range.start))
    constraints.push(where('tanggal', '<=', range.end))
  }
  constraints.push(orderBy('tanggal', 'desc'))
  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(fbLimit(pageSize))
  if (cursor) constraints.push(startAfter(cursor))
  return query(userCol(uid, 'transaksi'), ...constraints)
}

export function docKeTransaksi(d) {
  const data = d.data()
  return { id: d.id, ...data }
}
