'use client'

import { useState } from 'react'
import { Search, SlidersHorizontal, MoreHorizontal, LucideIcon } from 'lucide-react'
import { Select } from './Input'
import Button from './Button'
import Popover from './Popover'
import Drawer from './Drawer'

export interface FilterConfig {
  key: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}

export interface ActionConfig {
  key: string
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

export interface ViewOption {
  key: string
  label: string
  icon?: LucideIcon
}

export interface ToolbarProps {
  search?: { value: string; onChange: (v: string) => void; placeholder?: string; onSubmit?: () => void }
  filters?: FilterConfig[]
  /** Cuántos filtros van sueltos en la barra antes de pasar a "Más filtros" (default 3). */
  maxVisibleFilters?: number
  actions?: ActionConfig[]
  /** Cuántas acciones van sueltas antes de pasar al menú "···" (default 2). */
  maxVisibleActions?: number
  views?: { items: ViewOption[]; active: string; onChange: (key: string) => void }
  className?: string
}

// Toolbar Nivel 3 — configurada por objeto, un módulo solo declara qué
// búsqueda/filtros/acciones/vistas necesita y este componente decide el
// layout (qué va suelto y qué va a "Más filtros"/"···"), incluyendo el
// colapso a Popover (desktop/tablet) o Drawer tipo bottom-sheet (mobile,
// mismo breakpoint de 860px que ya usa DashboardShell).
export default function Toolbar({
  search, filters = [], maxVisibleFilters = 3, actions = [], maxVisibleActions = 2, views, className = '',
}: ToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [moreMode, setMoreMode] = useState<'popover' | 'drawer'>('popover')
  const [actionsOpen, setActionsOpen] = useState(false)

  const visibleFilters = filters.slice(0, maxVisibleFilters)
  const overflowFilters = filters.slice(maxVisibleFilters)
  const visibleActions = actions.slice(0, maxVisibleActions)
  const overflowActions = actions.slice(maxVisibleActions)

  const openMore = () => {
    setMoreMode(typeof window !== 'undefined' && window.innerWidth <= 860 ? 'drawer' : 'popover')
    setMoreOpen(true)
  }

  const renderFilterSelect = (f: FilterConfig) => (
    <Select
      key={f.key}
      aria-label={f.label}
      value={f.value}
      onChange={e => f.onChange(e.target.value)}
      className="w-auto min-w-[130px]"
    >
      <option value="">{f.placeholder || f.label}</option>
      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  )

  return (
    <div className={`flex items-center gap-2.5 flex-wrap ${className}`}>
      {search && (
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
          <input
            value={search.value}
            onChange={e => search.onChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search.onSubmit?.()}
            placeholder={search.placeholder || 'Buscar...'}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-900 placeholder:text-neutral-500 transition-colors focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
      )}

      {visibleFilters.map(renderFilterSelect)}

      {overflowFilters.length > 0 && (
        <div className="relative">
          <Button variant="secondary" size="sm" onClick={openMore}>
            <SlidersHorizontal size={14} /> Más filtros
          </Button>
          {moreMode === 'popover' ? (
            <Popover open={moreOpen} onClose={() => setMoreOpen(false)} align="right">
              <div className="flex flex-col gap-3 w-[220px]">
                {overflowFilters.map(f => (
                  <label key={f.key} className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-neutral-700">{f.label}</span>
                    {renderFilterSelect(f)}
                  </label>
                ))}
              </div>
            </Popover>
          ) : (
            <Drawer open={moreOpen} onClose={() => setMoreOpen(false)} side="bottom" title="Más filtros">
              <div className="flex flex-col gap-3">
                {overflowFilters.map(f => (
                  <label key={f.key} className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-neutral-700">{f.label}</span>
                    {renderFilterSelect(f)}
                  </label>
                ))}
              </div>
            </Drawer>
          )}
        </div>
      )}

      {views && views.items.length > 0 && (
        <div className="flex bg-neutral-100 rounded-lg p-0.5 gap-0.5">
          {views.items.map(v => (
            <button
              key={v.key}
              onClick={() => views.onChange(v.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ${views.active === v.key ? 'bg-white text-brand-700 shadow-sm' : 'text-neutral-500 hover:text-brand-700'}`}
            >
              {v.icon && <v.icon size={13} />} {v.label}
            </button>
          ))}
        </div>
      )}

      {visibleActions.map(a => (
        <Button key={a.key} variant={a.variant || 'secondary'} size="sm" onClick={a.onClick}>
          {a.icon && <a.icon size={13} />} {a.label}
        </Button>
      ))}

      {overflowActions.length > 0 && (
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => setActionsOpen(v => !v)} aria-label="Más acciones">
            <MoreHorizontal size={16} />
          </Button>
          <Popover open={actionsOpen} onClose={() => setActionsOpen(false)} align="right">
            <div className="flex flex-col gap-1 w-[180px] -m-1">
              {overflowActions.map(a => (
                <button
                  key={a.key}
                  onClick={() => { a.onClick(); setActionsOpen(false) }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-neutral-700 hover:bg-neutral-100 text-left"
                >
                  {a.icon && <a.icon size={14} />} {a.label}
                </button>
              ))}
            </div>
          </Popover>
        </div>
      )}
    </div>
  )
}
