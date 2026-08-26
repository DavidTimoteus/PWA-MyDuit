import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { seedKategoriJikaKosong } from './db.js'
import { getFirebase } from './firebase.js'

// Langganan daftar akun & kategori (deleted == false). Kategori default di-seed
// otomatis sekali bila masih kosong (login pertama).
export function useAkunKategori(uid) {
  const [akunList, setAkunList] = useState([])
  const [kategoriList, setKategoriList] = useState([])
  const [siap, setSiap] = useState(false)

  useEffect(() => {
    if (!uid) return
    const { db } = getFirebase()
    const unsubs = []

    // Seed kategori default sekali (diabaikan bila offline & database masih kosong).
    seedKategoriJikaKosong(uid).catch(() => {})

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'akun'), where('deleted', '==', false)),
        (snap) => {
          setAkunList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
          setSiap(true)
        },
      ),
    )
    unsubs.push(
      onSnapshot(
        query(collection(db, 'users', uid, 'kategori'), where('deleted', '==', false), orderBy('nama', 'asc')),
        (snap) => {
          setKategoriList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
          setSiap(true)
        },
      ),
    )
    return () => unsubs.forEach((u) => u())
  }, [uid])

  return { akunList, kategoriList, siap }
}
