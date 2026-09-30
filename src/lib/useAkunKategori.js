import { createContext, useContext, useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { seedKategoriJikaKosong } from './db.js'
import { getFirebase } from './firebase.js'

/**
 * Langganan akun + kategori.
 *
 * `AkunKategoriProvider` (file AkunKategoriProvider.jsx) membuka SATU langganan
 * di root dan membagikannya lewat context — itu jalur normalnya. Hook ini
 * membaca context tersebut; kalau dipanggil di luar provider (mis. komponen
 * portal) ia membuka langganan sendiri sebagai fallback supaya tidak crash.
 *
 * Mengapa satu langganan bersama penting: sebelumnya hook ini mandiri, dan enam
 * komponen memakainya (Transaksi, RightPanel, Statistik, Budget, Rekening,
 * Utang) — dua di antaranya di tab yang sama. Satu halaman bisa menahan 12
 * langganan untuk dua koleksi yang sama, sehingga tiap perubahan memicu
 * belasan pembacaan dokumen dan render, menguras kuota Firestore dan baterai.
 */

export const AkunKategoriCtx = createContext(null)

const QUERY_AKUN = (db, uid) =>
  query(collection(db, 'users', uid, 'akun'), where('deleted', '==', false))

const QUERY_KATEGORI = (db, uid) =>
  query(
    collection(db, 'users', uid, 'kategori'),
    where('deleted', '==', false),
    orderBy('nama', 'asc'),
  )

/** Dedupe defensif per-nama (jaga-jaga dokumen duplikat lama di server). */
export function dedupeKategori(docs) {
  const seen = new Set()
  const list = []
  for (const d of docs) {
    const key = (d.data().nama ?? '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    list.push({ id: d.id, ...d.data() })
  }
  return list
}

/** Buka dua langganan; kembalikan fungsi pembersih. */
export function langgananAkunKategori(db, uid, { onAkun, onKategori, onSiap }) {
  const unsubs = []

  // Seed kategori default sekali (diabaikan bila offline & database kosong).
  seedKategoriJikaKosong(uid).catch(() => {})

  unsubs.push(
    onSnapshot(
      QUERY_AKUN(db, uid),
      (snap) => {
        onAkun(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        onSiap(true)
      },
      // Error (mis. offline & cache kosong): tandai siap agar UI tidak menunggu
      // selamanya di skeleton.
      () => onSiap(true),
    ),
  )

  unsubs.push(
    onSnapshot(
      QUERY_KATEGORI(db, uid),
      (snap) => {
        onKategori(dedupeKategori(snap.docs))
        onSiap(true)
      },
      () => onSiap(true),
    ),
  )

  return () => unsubs.forEach((u) => u())
}

export function useAkunKategori(uid) {
  const ctx = useContext(AkunKategoriCtx)
  return ctx ?? useAkunKategoriMandiri(uid)
}

function useAkunKategoriMandiri(uid) {
  const [akunList, setAkunList] = useState([])
  const [kategoriList, setKategoriList] = useState([])
  const [siap, setSiap] = useState(false)

  useEffect(() => {
    if (!uid) return
    const { db } = getFirebase()
    return langgananAkunKategori(db, uid, {
      onAkun: setAkunList,
      onKategori: setKategoriList,
      onSiap: setSiap,
    })
  }, [uid])

  return { akunList, kategoriList, siap }
}
