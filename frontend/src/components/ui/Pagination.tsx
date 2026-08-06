'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}

// Paginación 100% de UI — pagina en cliente sobre una lista ya traída, no
// dispara ningún fetch nuevo por sí sola.
export default function Pagination({ page, pageCount, onPageChange, className = '' }: PaginationProps) {
  if (pageCount <= 1) return null

  return (
    <div className={`flex items-center justify-center gap-1 pt-4 ${className}`}>
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-300 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Página anterior"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="text-[12.5px] text-neutral-500 px-3">Página {page} de {pageCount}</span>
      <button
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-300 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Página siguiente"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}
