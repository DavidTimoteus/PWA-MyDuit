import { collection, getDocs, setDoc, doc } from 'firebase/firestore'
import { getFirebase } from '../../lib/firebase.js'

const KOLEKSI = ['akun', 'kategori', 'transaksi', 'budget', 'utang']

export async function exportData(uid) {
  const { db } = getFirebase()
  const data = {}
  for (const c of KOLEKSI) {
    const snap = await getDocs(collection(db, 'users', uid, c))
    data[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }
  return {
    app: 'MyDuit',
    version: 1,
    exportedAt: new Date().toISOString(),
    uid,
    data,
  }
}

export async function restoreData(uid, json) {
  if (!json || json.app !== 'MyDuit' || !json.data) {
    throw new Error('Berkas backup tidak valid (bukan file MyDuit).')
  }
  const { db } = getFirebase()
  let count = 0
  for (const c of KOLEKSI) {
    const arr = json.data[c]
    if (!Array.isArray(arr)) continue
    for (const item of arr) {
      if (!item || !item.id) continue
      // eslint-disable-next-line no-unused-vars
      const { id, ...rest } = item
      await setDoc(doc(db, 'users', uid, c, id), rest)
      count++
    }
  }
  return count
}
