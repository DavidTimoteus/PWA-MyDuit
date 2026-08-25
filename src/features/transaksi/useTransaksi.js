import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useRef, useState } from 'react'
import {
  buildTransQuery,
  docKeTransaksi,
  seedKategoriJikaKosong,
} from '../../lib/db.js'
import { getFirebase } from '../../lib/firebase.js'

const PAGE_SIZE = 50

// Langganan live riwayat transaksi sesuai filter + pagination kursor ("Muat lagi").
// Dokumen pertama selalu live (onSnapshot) -> tulis offline tampil instan.
export function useTransaksi(uid, { jenis, range }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const lastDocRef = useRef(null)

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    setError('')
    lastDocRef.current = null
    setHasMore(false)

    const q = buildTransQuery(uid, { jenis, range, pageSize: PAGE_SIZE })
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(docKeTransaksi)
        lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null
        setDocs(list)
        setHasMore(snap.docs.length === PAGE_SIZE)
        setLoading(false)
      },
      (e) => {
        setError(e?.message ?? String(e))
        setLoading(false)
      },
    )
    return () => unsub()
  }, [uid, jenis, range?.start, range?.end])

  async function muatLagi() {
    if (!uid || !lastDocRef.current || loadingMore) return
    setLoadingMore(true)
    try {
      const q = buildTransQuery(uid, { jenis, range, pageSize: PAGE_SIZE, cursor: lastDocRef.current })
      const snap = await getDocs(q)
      const list = snap.docs.map(docKeTransaksi)
      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? lastDocRef.current
      setDocs((prev) => [...prev, ...list])
      setHasMore(snap.docs.length === PAGE_SIZE)
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      setLoadingMore(false)
    }
  }

  return { docs, loading, loadingMore, hasMore, error, muatLagi, pageSize: PAGE_SIZE }
}

// Langganan daftar akun & kategori (deleted == false). Kategori di-seed otomatis
// sekali bila masih kosong (login pertama).
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
