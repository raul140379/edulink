'use client'

import { useEffect, useState } from 'react'
import { Download, DollarSign, AlertCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import StatCard from '@/components/ui/StatCard'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const TYPE_LABELS: Record<string, string> = {
  CUOTA_INICIAL: 'Cuota Inicial', DEUDA_ANTERIOR: 'Deuda Anterior',
  MULTA_ASAMBLEA: 'Multa Asamblea', MINGA: 'Minga', MULTA_REUNION: 'Multa Reunión',
  ACTIVIDAD: 'Actividad', MATERIAL_ESCOLAR: 'Material Escolar', OTRO: 'Otro',
}

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

// Reporte financiero — extraído de la antigua pestaña "Económico" de
// Reportes, para vivir como página propia (enlazada tanto desde
// Tesorería → Reportes Financieros como desde Reportes → Tesorería).
export default function ReportesFinancierosPage() {
  const toast    = useToast()
  const district = useDistrictConfig()
  const [treasury, setTreasury] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/api/reports/treasury`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) { toast(data.message, 'error'); return }
        setTreasury(data)
      })
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exportPDF = async () => {
    if (!treasury) return
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`U.E. Naciones Unidas${district.location ? ` — ${district.location}` : ''}`, 14, 15)
    doc.setFontSize(12)
    doc.text(`Reporte Económico — Gestión ${treasury.academicYear.year}`, 14, 25)
    doc.setFontSize(10)
    doc.text(`Total cobrado: ${fmt(treasury.summary.totalCharged)}`, 14, 35)
    doc.text(`Total recaudado: ${fmt(treasury.summary.totalCollected)}`, 14, 42)
    doc.text(`Total pendiente: ${fmt(treasury.summary.totalPending)}`, 14, 49)
    autoTable(doc, {
      startY: 58,
      head: [['Tipo de Cargo', 'Cargos', 'Cobrado', 'Recaudado', 'Pendiente']],
      body: Object.entries(treasury.byType).map(([type, data]: any) => [
        TYPE_LABELS[type] || type, data.count, fmt(data.charged), fmt(data.collected), fmt(data.charged - data.collected),
      ]),
    })
    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.setFontSize(12)
    doc.text('Tutores con deuda pendiente', 14, finalY)
    autoTable(doc, {
      startY: finalY + 6,
      head: [['#', 'Tutor', 'CI', 'Teléfono', 'Estudiante', 'Pendiente']],
      body: treasury.morosos.map((m: any, i: number) => [
        i + 1, `${m.lastName} ${m.firstName}`, m.ci || '—', m.phone || '—',
        m.student ? `${m.student.lastName} ${m.student.firstName}` : '—', fmt(m.pending),
      ]),
    })
    doc.save('reporte-economico.pdf')
  }

  const exportExcel = async () => {
    if (!treasury) return
    const XLSX = await import('xlsx')
    const wsData = [
      [`Reporte Económico — Gestión ${treasury.academicYear.year}`],
      [],
      ['Total cobrado', fmt(treasury.summary.totalCharged)],
      ['Total recaudado', fmt(treasury.summary.totalCollected)],
      ['Total pendiente', fmt(treasury.summary.totalPending)],
      [],
      ['RESUMEN POR TIPO DE CARGO'],
      ['Tipo', 'Cargos', 'Cobrado', 'Recaudado', 'Pendiente'],
      ...Object.entries(treasury.byType).map(([type, data]: any) => [
        TYPE_LABELS[type] || type, data.count, data.charged, data.collected, data.charged - data.collected,
      ]),
      [],
      ['TUTORES CON DEUDA PENDIENTE'],
      ['#', 'Apellidos', 'Nombres', 'CI', 'Teléfono', 'Estudiante', 'Pendiente'],
      ...treasury.morosos.map((m: any, i: number) => [
        i + 1, m.lastName, m.firstName, m.ci || '', m.phone || '',
        m.student ? `${m.student.lastName} ${m.student.firstName}` : '', m.pending,
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
    XLSX.writeFile(wb, `reporte-economico-${treasury.academicYear.year}.xlsx`)
  }

  const typeColumns: Column<[string, any]>[] = [
    { key: 'tipo', header: 'Tipo', render: ([type]) => <span className="font-medium text-brand-700">{TYPE_LABELS[type] || type}</span> },
    { key: 'cargos', header: 'Cargos', render: ([, data]) => <span className="text-xs text-neutral-500">{data.count}</span> },
    { key: 'cobrado', header: 'Cobrado', render: ([, data]) => fmt(data.charged) },
    { key: 'recaudado', header: 'Recaudado', render: ([, data]) => <span className="text-success-700 font-medium">{fmt(data.collected)}</span> },
    { key: 'pendiente', header: 'Pendiente', render: ([, data]) => <span className="text-danger-600 font-medium">{fmt(data.charged - data.collected)}</span> },
  ]

  const morososColumns: Column<any>[] = [
    { key: 'num', header: '#', render: (m) => <span className="text-xs text-neutral-500">{treasury.morosos.indexOf(m) + 1}</span> },
    { key: 'tutor', header: 'Tutor', render: m => <span className="font-medium text-brand-700">{m.lastName} {m.firstName}</span> },
    { key: 'ci', header: 'CI', render: m => <span className="text-xs text-neutral-500">{m.ci || '—'}</span> },
    { key: 'telefono', header: 'Teléfono', render: m => <span className="text-xs text-neutral-500">{m.phone || '—'}</span> },
    { key: 'estudiante', header: 'Estudiante', render: m => <span className="text-xs text-neutral-500">{m.student ? `${m.student.lastName} ${m.student.firstName}` : '—'}</span> },
    { key: 'pendiente', header: 'Pendiente', render: m => <span className="text-danger-600 font-bold">{fmt(m.pending)}</span> },
  ]

  return (
    <div>
      <PageHeader title="Reportes Financieros" description="Resumen económico de la gestión activa" />

      <Toolbar
        className="mb-4"
        actions={[
          { key: 'pdf', label: 'PDF', icon: Download, variant: 'danger', onClick: exportPDF },
          { key: 'excel', label: 'Excel', icon: Download, variant: 'secondary', onClick: exportExcel },
        ]}
      />

      {loading ? (
        <Card><LoadingState /></Card>
      ) : !treasury ? (
        <Card className="text-center py-12 text-neutral-500">No hay gestión académica activa</Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <StatCard label="Total cobrado" value={fmt(treasury.summary.totalCharged)} />
            <StatCard label="Recaudado" value={fmt(treasury.summary.totalCollected)} tone="success" />
            <StatCard label="Pendiente" value={fmt(treasury.summary.totalPending)} tone="danger" />
            <StatCard label="Gestión" value={treasury.academicYear.year} />
          </div>

          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
              <DollarSign size={15}/> Por tipo de cargo
            </div>
            <div className="p-4">
              <Table columns={typeColumns} rows={Object.entries(treasury.byType)} rowKey={([type]) => type} />
            </div>
          </Card>

          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
              <AlertCircle size={15}/> Tutores con deuda ({treasury.morosos.length})
            </div>
            <div className="p-4">
              <Table columns={morososColumns} rows={treasury.morosos} rowKey={(m: any) => m.id} />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
