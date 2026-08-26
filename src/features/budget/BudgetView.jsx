import { useState } from 'react'
import RekeningPanel from './RekeningPanel.jsx'
import BudgetPanel from './BudgetPanel.jsx'

// Tab Budget = sub-tab Rekening | Budget (pola app GAS lama).
export default function BudgetView({ user }) {
  const [sub, setSub] = useState('rekening')

  return (
    <section className="mx-auto max-w-3xl px-5 pb-32 md:pb-10">
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-800">Budget</h2>

      <div className="clay-inset mt-4 flex p-1">
        {[
          { id: 'rekening', label: 'Rekening' },
          { id: 'budget', label: 'Budget' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`flex-1 rounded-full py-2 text-xs font-extrabold transition-all ${
              sub === t.id ? 'clay-btn-primary' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {sub === 'rekening' ? <RekeningPanel uid={user.uid} /> : <BudgetPanel uid={user.uid} />}
      </div>
    </section>
  )
}
