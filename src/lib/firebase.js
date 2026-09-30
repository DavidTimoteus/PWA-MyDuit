import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// ID database Firestore. SDK default menyambung ke '(default)'; kalau database
// di Firebase Console dibuat dengan nama lain (mis. 'myduit001'), WAJIB diisi di
// .env.local lewat VITE_FIREBASE_DATABASE_ID — kalau tidak, semua operasi tulis
// menggantung menunggu ack dari database yang tidak ada ("Database '(default)'
// not found") dan data hanya tersimpan di cache lokal (hilang saat refresh).
const DATABASE_ID = import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)'

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)
}

let app = null
let auth = null
let db = null

// Inisialisasi sekali saja. Firestore memakai offline persistence (IndexedDB)
// dengan tab manager multi-tab supaya buka beberapa tab tidak bentrok.
export function getFirebase() {
  if (!app) {
    if (!isFirebaseConfigured()) {
      throw new Error(
        'Konfigurasi Firebase belum diisi. Salin .env.example menjadi .env.local lalu isi nilainya.',
      )
    }
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = initializeFirestore(
      app,
      { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
      DATABASE_ID,
    )
  }
  return { app, auth, db }
}

export const googleProvider = new GoogleAuthProvider()
