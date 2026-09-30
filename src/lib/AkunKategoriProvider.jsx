import { useEffect, useState } from 'react'
import { AkunKategoriCtx, langgananAkunKategori } from './useAkunKategori.js'
import { getFirebase } from './firebase.js'

/**
 * Membuka SATU langganan akun+kategori untuk seluruh aplikasi.
 * Lihat penjelasan lengkap di useAkunKategori.js.
 */
export default function AkunKategoriProvider({ uid, children }) {
  const [akunList, setAkunList] = useState([])
  const [kategoriList, setKategoriList] = useState([])
  const [siap, setSiap] = useState(false)

  useEffect(() => {
    if (!uid) {
      setAkunList([])
      setKategoriList([])
      setSiap(false)
      return
    }
    const { db } = getFirebase()
    return langgananAkunKategori(db, uid, {
      onAkun: setAkunList,
      onKategori: setKategoriList,
      onSiap: setSiap,
    })
  }, [uid])

  return (
    <AkunKategoriCtx.Provider value={{ akunList, kategoriList, siap }}>
      {children}
    </AkunKategoriCtx.Provider>
  )
}
