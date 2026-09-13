'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { MODULES } from '@/modules/registry'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="px-4 py-5 flex flex-col gap-3 max-w-lg mx-auto">
      {MODULES.filter(m => m.enabled).map(m => {
        const Icon = m.icon
        return (
          <button
            key={m.id}
            onClick={() => router.push(m.href)}
            className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-border px-5 py-5 active:bg-bg-soft"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                <Icon size={22} className="text-brand-700" />
              </div>
              <span className="text-[16px] font-semibold text-brand-700">{m.label}</span>
            </div>
            <ChevronRight size={20} className="text-text-secondary shrink-0" />
          </button>
        )
      })}
    </div>
  )
}
