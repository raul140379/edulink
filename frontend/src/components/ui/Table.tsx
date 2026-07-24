import { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  emptyLabel?: string
  loading?: boolean
}

export default function Table<T>({ columns, rows, rowKey, emptyLabel = 'No hay datos para mostrar', loading = false }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-300/60">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-neutral-100">
            {columns.map((col) => (
              <th key={col.key} className={`text-left font-semibold text-neutral-700 px-4 py-3 whitespace-nowrap ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-neutral-500">
                Cargando...
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12">
                <div className="flex flex-col items-center gap-2 text-neutral-500">
                  <Inbox size={28} className="opacity-50" />
                  <span>{emptyLabel}</span>
                </div>
              </td>
            </tr>
          )}
          {!loading && rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-neutral-300/60 hover:bg-neutral-100/60 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-neutral-900 ${col.className ?? ''}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
