'use client'

import { useEffect, useState } from 'react'
import { Lock, LockOpen, RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import EmptyState from '@/components/ui/EmptyState'
import LoadingState from '@/components/ui/LoadingState'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface AcademicYearClosure {
  id: number
  year: number
  isActive: boolean
  economicClosedAt: string | null
  economicClosedBy: { id: number; email: string } | null
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Cierre económico de una gestión (Junta Escolar) — independiente del cierre
// académico (isActive, que maneja Dirección). Cerrar traslada todo Charge
// PENDIENTE/PARCIAL de tutor de esa gestión a la gestión activa como
// DEUDA_ANTERIOR, y anula los originales — ver academicClosure.service.ts.
export default function CierreGestionPage() {
  const toast   = useToast()
  const confirm = useConfirm()

  const [items, setItems] = useState<AcademicYearClosure[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const fetchData = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/academic-years`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setItems(data)
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const handleClose = async (y: AcademicYearClosure) => {
    if (!await confirm(
      `Esto va a trasladar todo cargo pendiente/parcial de la gestión ${y.year} a la gestión activa como "Deuda Anterior", y anular los cargos originales de ${y.year}. No se puede deshacer el traslado después. ¿Cerrar económicamente la gestión ${y.year}?`
    )) return
    setBusyId(y.id)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/academic-years/${y.id}/close-economic-period`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally { setBusyId(null) }
  }

  const handleReopen = async (y: AcademicYearClosure) => {
    if (!await confirm(
      `Reabrir la gestión ${y.year} no deshace los traslados de deuda ya realizados — solo permite volver a intentar el cierre si quedó algo pendiente por cargar. ¿Reabrir económicamente la gestión ${y.year}?`
    )) return
    setBusyId(y.id)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/academic-years/${y.id}/reopen-economic-period`, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally { setBusyId(null) }
  }

  const columns: Column<AcademicYearClosure>[] = [
    { key: 'gestion', header: 'Gestión', render: y => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-brand-700">{y.year}</span>
        {y.isActive && <Badge tone="brand">Activa</Badge>}
      </div>
    ) },
    { key: 'estado', header: 'Estado económico', render: y => (
      y.economicClosedAt
        ? <Badge tone="neutral">Cerrada el {fmtDate(y.economicClosedAt)}{y.economicClosedBy ? ` por ${y.economicClosedBy.email}` : ''}</Badge>
        : <Badge tone="success">Abierta</Badge>
    ) },
    { key: 'accion', header: 'Acción', render: y => (
      y.isActive ? (
        <span className="text-[11.5px] text-neutral-400">No se puede cerrar la gestión activa</span>
      ) : y.economicClosedAt ? (
        <Button size="sm" variant="secondary" onClick={() => handleReopen(y)} loading={busyId === y.id}>
          <LockOpen size={12}/> Reabrir
        </Button>
      ) : (
        <Button size="sm" onClick={() => handleClose(y)} loading={busyId === y.id}>
          <Lock size={12}/> Cerrar gestión económica
        </Button>
      )
    ) },
  ]

  return (
    <div>
      <PageHeader
        title="Cierre de Gestión" description="Cierre económico de una gestión terminada — traslada la deuda pendiente a la gestión activa"
      />

      <Toolbar
        className="mb-4"
        actions={[{ key: 'refresh', label: 'Actualizar', icon: RefreshCw, onClick: fetchData }]}
      />

      <Card padded={false} className="overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState icon={Lock} message="Todavía no hay gestiones registradas" />
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={items} rowKey={y => y.id} />
          </div>
        )}
      </Card>
    </div>
  )
}
