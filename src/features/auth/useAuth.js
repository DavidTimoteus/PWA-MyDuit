import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { getFirebase } from '../../lib/firebase.js'

// status: 'loading' (cek sesi) | 'masuk' | 'keluar' | 'error'
export function useAuth() {
  const [state, setState] = useState({ status: 'loading', user: null })

  useEffect(() => {
    let unsub = () => {}
    try {
      const { auth } = getFirebase()
      unsub = onAuthStateChanged(auth, (user) => {
        setState({ status: user ? 'masuk' : 'keluar', user })
      })
    } catch (e) {
      setState({ status: 'error', user: null, error: e?.message ?? String(e) })
    }
    return () => unsub()
  }, [])

  return state
}
