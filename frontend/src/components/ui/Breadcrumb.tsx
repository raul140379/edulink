import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  href?: string
}

// Migas de pan bajo el segundo nivel de navegación — el último ítem (sin
// href) es la página actual. Extracción del bloque que antes vivía inline en
// DashboardShell, mismo look (antes con CSS propio, ahora Tailwind).
export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="flex items-center gap-2 px-6 pt-3 text-[12.5px] text-neutral-500 max-[860px]:px-4">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="opacity-60">/</span>}
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-brand-700">{item.label}</Link>
            ) : (
              <span className={isLast ? 'text-brand-700 font-semibold' : ''}>{item.label}</span>
            )}
          </span>
        )
      })}
    </div>
  )
}
