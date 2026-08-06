import { RefObject } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { MenuGroup, MenuItem } from './DashboardShell'

interface ModuleNavigationProps {
  visibleGroups: MenuGroup[]
  activeItem?: MenuItem
  activeGroup?: MenuGroup
  openGroup: string | null
  mobileOpen: boolean
  onGroupClick: (group: MenuGroup) => void
  navRef: RefObject<HTMLDivElement | null>
}

// Nivel 1 (pestañas de módulo) + Nivel 2 (segundo nivel fijo del módulo
// activo, en escritorio) — extracción 1:1 de DashboardShell, mismas clases
// CSS y mismo comportamiento (acordeón mobile intacto). Uso interno de
// DashboardShell, no pensado para usarse suelto en una página.
export default function ModuleNavigation({
  visibleGroups, activeItem, activeGroup, openGroup, mobileOpen, onGroupClick, navRef,
}: ModuleNavigationProps) {
  return (
    <div className="nav-stack">
      <nav className={`navbar ${mobileOpen ? 'mobile-open' : ''}`} ref={navRef}>
        {visibleGroups.map(group => {
          const isDirectLink = group.items.length === 1
          const hasActive = group.items.some(i => i.href === activeItem?.href)

          if (isDirectLink) {
            const item = group.items[0]
            return (
              <Link key={group.label} href={item.href} className={`nav-top-item ${hasActive ? 'active' : ''}`}>
                {group.icon} {group.label}
              </Link>
            )
          }

          return (
            <div key={group.label} className="nav-dropdown-wrap">
              <button
                className={`nav-top-item ${hasActive ? 'active' : ''}`}
                onClick={() => onGroupClick(group)}
              >
                {group.icon} {group.label} <span className="chev-icon"><ChevronDown size={13} className={openGroup === group.label ? 'chev-open' : ''}/></span>
              </button>
              {openGroup === group.label && (
                <div className="nav-dropdown">
                  {group.items.map(item => {
                    const isActive = item.href === activeItem?.href
                    return (
                      <Link key={item.href} href={item.href} className={`dropdown-item ${isActive ? 'active' : ''}`}>
                        {item.icon} {item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {activeGroup && (
        <div className="subnav">
          {activeGroup.items.map(item => (
            <Link key={item.href} href={item.href} className={`subnav-item ${item.href === activeItem?.href ? 'active' : ''}`}>
              {item.icon} {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
