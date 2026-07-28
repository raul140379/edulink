'use client'

import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { useGamification } from './GamificationContext'

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

export default function GamificationTopBar() {
  const { state } = useGamification()
  const [fillPct, setFillPct] = useState(0)

  useEffect(() => {
    if (state.loading) return
    // Un tick después del montaje, para que se vea el llenado animado en vez
    // de aparecer ya lleno.
    const t = setTimeout(() => setFillPct(state.progressPct), 120)
    return () => clearTimeout(t)
  }, [state.loading, state.progressPct])

  if (!state.enabled || state.loading) return null

  const today = todayKey()

  return (
    <div className="gm-topbar bg-white border border-neutral-300 rounded-xl px-5 py-3.5 mb-5 flex items-center gap-7 flex-wrap">
      <div className="flex items-center gap-2.5">
        <Flame size={22} className="gm-flame shrink-0" style={{ color: 'var(--color-estudiante-racha)' }} />
        <div>
          <div className="text-[15px] font-bold text-brand-700 leading-none">{state.currentStreak} días</div>
          <div className="text-[10px] text-neutral-500 mt-1">de racha</div>
        </div>
      </div>

      <div className="w-px h-8 bg-neutral-300" />

      <div className="flex items-center gap-1.5">
        {state.weekCalendar.map((d, i) => {
          const done = d.status === 'PRESENTE' || d.status === 'RETRASO'
          const isToday = d.date === today
          return (
            <span
              key={i}
              title={`${d.label}${done ? ' · asistió' : ''}`}
              className="w-3.5 h-3.5 rounded-[4px]"
              style={{
                background: done ? 'var(--color-estudiante-logro)' : 'var(--color-neutral-300)',
                boxShadow: isToday ? '0 0 0 2px var(--color-estudiante-logro)' : 'none',
              }}
            />
          )
        })}
      </div>

      <div className="w-px h-8 bg-neutral-300" />

      <div className="flex-1 min-w-[170px]">
        <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1.5">
          <span className="font-bold px-2 py-0.5 rounded-full bg-accent-500" style={{ color: '#3A2F00' }}>Nv.{state.level}</span>
          <span>{state.xpIntoLevel} / {state.xpForNextLevel} XP</span>
        </div>
        <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="gm-xp-fill h-full rounded-full"
            style={{ width: `${fillPct}%`, background: 'linear-gradient(90deg, var(--color-brand-700), var(--color-brand-600))' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes gm-pulse-flame { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        .gm-flame { animation: gm-pulse-flame 2s ease-in-out infinite; transform-origin: center bottom; }
        .gm-xp-fill { transition: width 900ms cubic-bezier(.2,.8,.2,1); }
      `}</style>
    </div>
  )
}
