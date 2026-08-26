import { useRef, useState } from 'react'
import { exportData, restoreData } from './backup.js'

export default function BackupModal({ open, onClose, uid }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [preview, setPreview] = useState(null)
  const fileRef = useRef(null)

  if (!open) return null

  function download(json) {
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    a.href = url
    a.download = `myduit-backup-${ts}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function ekspor() {
    setLoading(true)
    setMsg(null)
    try {
      const json = await exportData(uid)
      download(json)
      setMsg({ type: 'ok', text: `Ekspor ${Object.values(json.data).flat().length} dokumen berhasil.` })
    } catch (e) {
      setMsg({ type: 'err', text: e?.message ?? 'Gagal ekspor.' })
    } finally {
      setLoading(false)
    }
  }

  function pilihFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result)
        if (json.app !== 'MyDuit' || !json.data) throw new Error('bukan')
        const ringkasan = (['akun', 'kategori', 'transaksi', 'budget', 'utang'])
          .map((c) => `${c}: ${Array.isArray(json.data[c]) ? json.data[c].length : 0}`)
          .join(' · ')
        setPreview({ json, ringkasan })
        setMsg(null)
      } catch {
        setPreview(null)
        setMsg({ type: 'err', text: 'Berkas bukan backup MyDuit yang valid.' })
      }
    }
    reader.readAsText(file)
  }

  async function pulihkan() {
    if (!preview) return
    setLoading(true)
    setMsg(null)
    try {
      const n = await restoreData(uid, preview.json)
      setMsg({ type: 'ok', text: `Pemulihan ${n} dokumen selesai.` })
      setPreview(null)
    } catch (e) {
      setMsg({ type: 'err', text: e?.message ?? 'Gagal memulihkan.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-t-[28px] bg-white p-5 shadow-2xl md:rounded-[28px]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-800">Backup & Pulihkan</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-slate-400">
          Ekspor semua data ke berkas JSON di perangkatmu. Pemulihan akan menimpa dokumen dengan ID sama — aman untuk pindah device.
        </p>

        <button
          onClick={ekspor}
          disabled={loading}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-extrabold text-white shadow hover:bg-primary-dark disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Ekspor Data Sekarang
        </button>

        <div className="my-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wide text-slate-300">
          <span className="h-px flex-1 bg-slate-200" /> atau <span className="h-px flex-1 bg-slate-200" />
        </div>

        <input ref={fileRef} type="file" accept="application/json" onChange={pilihFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">upload</span>
          Pilih Berkas Backup
        </button>

        {preview && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold text-slate-500">{preview.ringkasan}</p>
            <button
              onClick={pulihkan}
              disabled={loading}
              className="mt-2 w-full rounded-full bg-expense py-2.5 text-xs font-extrabold text-white shadow hover:brightness-110 disabled:opacity-60"
            >
              {loading ? 'Memulihkan…' : 'Pulihkan Data Ini'}
            </button>
          </div>
        )}

        {msg && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${msg.type === 'ok' ? 'bg-emerald-50 text-income' : 'bg-red-50 text-expense'}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  )
}
