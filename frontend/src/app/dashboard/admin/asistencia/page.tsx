'use client'
import { useState } from 'react'
import AsistenciaReporte from '@/components/AsistenciaReporte'

export default function AdminAsistenciaPage() {
  const [tab, setTab] = useState<'teacher' | 'staff'>('teacher')

  return (
    <div>
      <div className="flex gap-1.5 mb-4">
        {([
          { key: 'teacher' as const, label: 'Maestros' },
          { key: 'staff'   as const, label: 'Personal Administrativo' },
        ]).map(t => (
          <button
            key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${tab === t.key ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <AsistenciaReporte personType={tab} />
    </div>
  )
}
