import { useState } from 'react'
import { formatRupiah } from '../../lib/format.js'
import { hapusBudget } from '../../lib/db.js'
import FormBudgetModal from './FormBudgetModal.jsx'

// Daftar budget — paritas dengan ViewBudget.html #budgetLimitList.
// Terima props dari BudgetView: budgets (sudah dihitung dengan terpakai/persen),
// bulan, tahun, modal, setModal, hapusTarget, setHapusTarget, kategoriList.
export default function BudgetPanel({
  uid,
  kategoriList,
  bulan,
  tahun,
  budgets = [],
  modal,
  setModal,
  hapusTarget,
  setHapusTarget,
}) {
  const [hapusLoading, setHapusLoading] = useState(false)

  async function konfirmHapus() {
    if (!hapusTarget) return
    const target = hapusTarget
    setHapusTarget(null)
    setHapusLoading(false)
    try {
      await hapusBudget(uid, target.id)
    } catch (e) {
      console.warn('[budget-hapus] gagal:', e?.message ?? e)
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {budgets.length === 0 ? (
          <div className="clay-card-soft flex flex-col items-center px-6 py-12 text-center">
            <span className="material-symbols-outlined mb-3 text-5xl text-blue-400/50" style={{ fontVariationSettings: "'FILL' 0" }}>savings</span>
            <p className="text-sm font-bold text-slate-700">Belum ada budget untuk periode ini</p>
            <p className="mt-1 text-xs text-slate-400">Tekan tombol + di bawah untuk membatasi pengeluaran.</p>
            <button
              onClick={() => setModal({ open: true, edit: null })}
              className="clay-btn clay-key-blue mt-4 bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              + Tambah Budget
            </button>
          </div>
        ) : (
          budgets.map((b) => {
            const kategoriNama = b.kategoriNama ?? kategoriList.find((k) => k.id === b.kategoriId)?.nama ?? '?'
            return (
              <div key={b.id} className="clay-card p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${b.lewat ? 'bg-red-50 text-expense' : 'bg-blue-50 text-blue-700'}`}>
                    {kategoriNama.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{kategoriNama}</p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      Terpakai {formatRupiah(b.terpakai)} · Sisa {formatRupiah(b.limitNominal - b.terpakai)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => setModal({ open: true, edit: b })} title="Edit" className="clay-chip flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200">
                      <span className="material-symbols-outlined icon-xs">edit</span>
                    </button>
                    <button onClick={() => setHapusTarget(b)} title="Hapus" className="clay-chip flex h-8 w-8 items-center justify-center rounded-full !bg-red-50 text-red-500 hover:!bg-red-500 hover:text-white">
                      <span className="material-symbols-outlined icon-xs">delete</span>
                    </button>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${b.lewat ? 'bg-expense' : b.persen >= 80 ? 'bg-amber-400' : 'bg-blue-500'}`}
                      style={{ width: `${b.persen}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-extrabold ${b.lewat ? 'text-expense' : 'text-slate-500'}`}>
                    {b.lewat ? 'Melebihi!' : `${b.persen}%`}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <FormBudgetModal
        open={modal.open}
        edit={modal.edit}
        uid={uid}
        kategoriList={kategoriList}
        existing={budgets}
        bulan={bulan}
        tahun={tahun}
        onClose={() => setModal({ open: false, edit: null })}
      />

      {hapusTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-sm" onClick={() => setHapusTarget(null)}>
          <div className="clay-card w-full max-w-xs rounded-[24px] p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined text-4xl text-expense">delete</span>
            <p className="mt-2 text-sm font-bold text-slate-800">
              Hapus budget "{kategoriList.find((k) => k.id === hapusTarget.kategoriId)?.nama ?? hapusTarget.kategoriNama ?? '?'}"?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setHapusTarget(null)} className="clay-btn-soft btn-md text-xs font-bold text-slate-600">Batal</button>
              <button onClick={konfirmHapus} disabled={hapusLoading} className="clay-btn-danger btn-md text-xs font-bold disabled:opacity-60">
                {hapusLoading ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
