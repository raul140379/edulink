'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { getToken, getUser, logout } from '@/lib/auth'
import { apiFetch } from '@/lib/api'

interface Me {
  teacher?: { firstName: string; lastName: string } | null
  teacherTutor?: { firstName: string; lastName: string } | null
  school?: { id: number; name: string } | null
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return }
    setChecked(true)
    apiFetch<Me>('/api/auth/me').then(setMe).catch(() => {})
  }, [router])

  if (!checked) return null

  const teacherName = me?.teacher || me?.teacherTutor
    ? `${(me.teacher || me.teacherTutor)!.firstName}`.split(' ')[0]
    : getUser()?.email || ''

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-brand-700 text-white px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-[15px] font-bold truncate">{teacherName}</div>
          {me?.school && <div className="text-[11px] text-white/70 truncate">{me.school.name}</div>}
        </div>
        <button
          onClick={() => { logout(); router.replace('/login') }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 active:bg-white/20 shrink-0 text-[13px] font-semibold"
        >
          <LogOut size={16} /> Salir
        </button>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
