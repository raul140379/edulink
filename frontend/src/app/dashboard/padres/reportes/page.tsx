'use client'

import { useEffect, useState } from 'react'
import { Download, Users, GraduationCap, DollarSign, AlertCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const TYPE_LABELS:  Record<string, string> = {
  CUOTA_INICIAL: 'Cuota Inicial', DEUDA_ANTERIOR: 'Deuda Anterior',
  MULTA_ASAMBLEA: 'Multa Asamblea', MINGA: 'Minga', MULTA_REUNION: 'Multa Reunión',
  ACTIVIDAD: 'Actividad', MATERIAL_ESCOLAR: 'Material Escolar', OTRO: 'Otro',
}

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

export default function ReportesPage() {
  const toast = useToast()
  const [activeTab,   setActiveTab]   = useState<'teachers' | 'delegates' | 'treasury'>('teachers')
  const [teachers,    setTeachers]    = useState<any[]>([])
  const [delegates,   setDelegates]   = useState<any[]>([])
  const [treasury,    setTreasury]    = useState<any>(null)
  const [loading,     setLoading]     = useState(false)

  const fetchReport = async (type: string) => {
    const token = localStorage.getItem('token')
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/reports/${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      if (type === 'teachers')  setTeachers(data)
      if (type === 'delegates') setDelegates(data)
      if (type === 'treasury')  setTreasury(data)
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchReport(activeTab) }, [activeTab])

  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('U.E. Naciones Unidas — El Torno', 14, 15)
    doc.setFontSize(12)

    if (activeTab === 'teachers') {
      doc.text('Reporte de Maestros', 14, 25)
      autoTable(doc, {
        startY: 32,
        head: [['#', 'Apellidos', 'Nombres', 'CI', 'Materias', 'Tutor de Curso']],
        body: teachers.map((t, i) => [
          i + 1,
          t.lastName,
          t.firstName,
          t.ci || '—',
          t.assignments.map((a: any) => a.subject.name).join(', ') || '—',
          t.tutorCourse ? `${LEVEL_LABELS[t.tutorCourse.course.level]} ${GRADE_LABELS[t.tutorCourse.course.grade]} ${t.tutorCourse.course.parallel}` : '—',
        ]),
      })
      doc.save('reporte-maestros.pdf')
    }

    if (activeTab === 'delegates') {
      doc.text('Reporte de Delegados de Curso', 14, 25)
      autoTable(doc, {
        startY: 32,
        head: [['#', 'Curso', 'Turno', 'Delegado', 'CI', 'Teléfono', 'Maestro Tutor']],
        body: delegates.map((c, i) => [
          i + 1,
          `${LEVEL_LABELS[c.level]} ${GRADE_LABELS[c.grade]} ${c.parallel}`,
          SHIFT_LABELS[c.shift],
          c.delegate ? `${c.delegate.lastName} ${c.delegate.firstName}` : 'Sin delegado',
          c.delegate?.ci || '—',
          c.delegate?.phone || '—',
          c.tutor ? `${c.tutor.teacher.lastName} ${c.tutor.teacher.firstName}` : '—',
        ]),
      })
      doc.save('reporte-delegados.pdf')
    }

    if (activeTab === 'treasury' && treasury) {
      doc.text(`Reporte Económico — Gestión ${treasury.academicYear.year}`, 14, 25)
      doc.setFontSize(10)
      doc.text(`Total cobrado: ${fmt(treasury.summary.totalCharged)}`, 14, 35)
      doc.text(`Total recaudado: ${fmt(treasury.summary.totalCollected)}`, 14, 42)
      doc.text(`Total pendiente: ${fmt(treasury.summary.totalPending)}`, 14, 49)
      autoTable(doc, {
        startY: 58,
        head: [['Tipo de Cargo', 'Cargos', 'Cobrado', 'Recaudado', 'Pendiente']],
        body: Object.entries(treasury.byType).map(([type, data]: any) => [
          TYPE_LABELS[type] || type,
          data.count,
          fmt(data.charged),
          fmt(data.collected),
          fmt(data.charged - data.collected),
        ]),
      })
      const finalY = (doc as any).lastAutoTable.finalY + 10
      doc.setFontSize(12)
      doc.text('Tutores con deuda pendiente', 14, finalY)
      autoTable(doc, {
        startY: finalY + 6,
        head: [['#', 'Tutor', 'CI', 'Teléfono', 'Estudiante', 'Pendiente']],
        body: treasury.morosos.map((m: any, i: number) => [
          i + 1,
          `${m.lastName} ${m.firstName}`,
          m.ci || '—',
          m.phone || '—',
          m.student ? `${m.student.lastName} ${m.student.firstName}` : '—',
          fmt(m.pending),
        ]),
      })
      doc.save('reporte-economico.pdf')
    }
  }

  const exportExcel = async () => {
    const XLSX = await import('xlsx')

    let wsData: any[][] = []
    let fileName = ''

    if (activeTab === 'teachers') {
      fileName = 'reporte-maestros.xlsx'
      wsData = [
        ['#', 'Apellidos', 'Nombres', 'CI', 'Teléfono', 'Especialidad', 'Materias', 'Tutor de Curso'],
        ...teachers.map((t, i) => [
          i + 1,
          t.lastName,
          t.firstName,
          t.ci || '',
          t.phone || '',
          t.specialty || '',
          t.assignments.map((a: any) => a.subject.name).join(', '),
          t.tutorCourse ? `${LEVEL_LABELS[t.tutorCourse.course.level]} ${GRADE_LABELS[t.tutorCourse.course.grade]} ${t.tutorCourse.course.parallel}` : '',
        ])
      ]
    }

    if (activeTab === 'delegates') {
      fileName = 'reporte-delegados.xlsx'
      wsData = [
        ['#', 'Nivel', 'Grado', 'Paralelo', 'Turno', 'Estudiantes', 'Delegado', 'CI Delegado', 'Teléfono', 'Maestro Tutor'],
        ...delegates.map((c, i) => [
          i + 1,
          LEVEL_LABELS[c.level],
          GRADE_LABELS[c.grade],
          c.parallel,
          SHIFT_LABELS[c.shift],
          c._count.assignments,
          c.delegate ? `${c.delegate.lastName} ${c.delegate.firstName}` : 'Sin delegado',
          c.delegate?.ci || '',
          c.delegate?.phone || '',
          c.tutor ? `${c.tutor.teacher.lastName} ${c.tutor.teacher.firstName}` : '',
        ])
      ]
    }

    if (activeTab === 'treasury' && treasury) {
      fileName = `reporte-economico-${treasury.academicYear.year}.xlsx`
      wsData = [
        [`Reporte Económico — Gestión ${treasury.academicYear.year}`],
        [],
        ['Total cobrado', fmt(treasury.summary.totalCharged)],
        ['Total recaudado', fmt(treasury.summary.totalCollected)],
        ['Total pendiente', fmt(treasury.summary.totalPending)],
        [],
        ['RESUMEN POR TIPO DE CARGO'],
        ['Tipo', 'Cargos', 'Cobrado', 'Recaudado', 'Pendiente'],
        ...Object.entries(treasury.byType).map(([type, data]: any) => [
          TYPE_LABELS[type] || type,
          data.count,
          data.charged,
          data.collected,
          data.charged - data.collected,
        ]),
        [],
        ['TUTORES CON DEUDA PENDIENTE'],
        ['#', 'Apellidos', 'Nombres', 'CI', 'Teléfono', 'Estudiante', 'Pendiente'],
        ...treasury.morosos.map((m: any, i: number) => [
          i + 1,
          m.lastName,
          m.firstName,
          m.ci || '',
          m.phone || '',
          m.student ? `${m.student.lastName} ${m.student.firstName}` : '',
          m.pending,
        ])
      ]
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
    XLSX.writeFile(wb, fileName)
  }

  const teacherColumns: Column<any>[] = [
    { key: 'num', header: '#', render: (t) => <span className="text-xs text-neutral-500">{teachers.indexOf(t) + 1}</span> },
    {
      key: 'maestro', header: 'Maestro', render: t => (
        <div>
          <div className="font-medium text-brand-700">{t.lastName} {t.firstName}</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">{t.user?.email}</div>
        </div>
      )
    },
    { key: 'ci', header: 'CI', render: t => <span className="text-xs text-neutral-500">{t.ci || '—'}</span> },
    { key: 'esp', header: 'Especialidad', render: t => <span className="text-xs text-neutral-500">{t.specialty || '—'}</span> },
    {
      key: 'materias', header: 'Materias asignadas', render: t => t.assignments.length === 0
        ? <span className="text-xs text-neutral-500">Sin asignaciones</span>
        : <div className="flex flex-wrap gap-1">{t.assignments.map((a: any, j: number) => <Badge key={j} tone="brand">{a.subject.name}</Badge>)}</div>
    },
    {
      key: 'tutor', header: 'Tutor de curso', render: t => t.tutorCourse
        ? <Badge tone="success">{LEVEL_LABELS[t.tutorCourse.course.level]} {GRADE_LABELS[t.tutorCourse.course.grade]} {t.tutorCourse.course.parallel}</Badge>
        : <span className="text-xs text-neutral-500">—</span>
    },
  ]

  const delegateColumns: Column<any>[] = [
    { key: 'num', header: '#', render: (c) => <span className="text-xs text-neutral-500">{delegates.indexOf(c) + 1}</span> },
    { key: 'curso', header: 'Curso', render: c => <span className="font-medium text-brand-700">{LEVEL_LABELS[c.level]} — {GRADE_LABELS[c.grade]} {c.parallel}</span> },
    { key: 'turno', header: 'Turno', render: c => <span className="text-xs text-neutral-500">{SHIFT_LABELS[c.shift]}</span> },
    { key: 'estudiantes', header: 'Estudiantes', render: c => <span className="text-xs text-neutral-500">{c._count.assignments}</span> },
    {
      key: 'delegado', header: 'Delegado', render: c => c.delegate ? (
        <div>
          <div className="font-medium text-brand-700">{c.delegate.lastName} {c.delegate.firstName}</div>
          {c.delegate.ci && <div className="text-[11px] text-neutral-500 mt-0.5">CI: {c.delegate.ci}</div>}
        </div>
      ) : <span className="text-xs text-danger-600 italic">Sin delegado</span>
    },
    { key: 'telefono', header: 'Teléfono', render: c => <span className="text-xs text-neutral-500">{c.delegate?.phone || '—'}</span> },
    {
      key: 'tutorm', header: 'Maestro Tutor', render: c => c.tutor
        ? <Badge tone="success">{c.tutor.teacher.lastName} {c.tutor.teacher.firstName}</Badge>
        : <span className="text-xs text-neutral-500">—</span>
    },
  ]

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
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Reportes</h1>
          <p className="text-[13px] text-neutral-500">Informes y estadísticas del sistema</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPDF} className="flex items-center gap-1.5 px-4 py-2.5 bg-danger-500 text-white rounded-lg text-[13px] font-medium hover:bg-danger-600 transition-colors">
            <Download size={14}/> PDF
          </button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-4 py-2.5 bg-success-500 text-white rounded-lg text-[13px] font-medium hover:bg-success-700 transition-colors">
            <Download size={14}/> Excel
          </button>
        </div>
      </div>

      <div className="flex bg-neutral-100 rounded-[10px] p-1 gap-1 mb-4">
        <button
          onClick={() => setActiveTab('teachers')}
          className={`flex-1 py-2.5 rounded-lg text-[13px] flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'teachers' ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
        >
          <GraduationCap size={15}/> Maestros
        </button>
        <button
          onClick={() => setActiveTab('delegates')}
          className={`flex-1 py-2.5 rounded-lg text-[13px] flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'delegates' ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
        >
          <Users size={15}/> Delegados
        </button>
        <button
          onClick={() => setActiveTab('treasury')}
          className={`flex-1 py-2.5 rounded-lg text-[13px] flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'treasury' ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
        >
          <DollarSign size={15}/> Económico
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : (
        <>
          {activeTab === 'teachers' && (
            <Card padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
                <GraduationCap size={15}/> Maestros registrados ({teachers.length})
              </div>
              <div className="p-4">
                <Table columns={teacherColumns} rows={teachers} rowKey={t => t.id} />
              </div>
            </Card>
          )}

          {activeTab === 'delegates' && (
            <Card padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
                <Users size={15}/> Delegados por curso
              </div>
              <div className="p-4">
                <Table columns={delegateColumns} rows={delegates} rowKey={c => c.id} />
              </div>
            </Card>
          )}

          {activeTab === 'treasury' && treasury && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <Card><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1.5">Total cobrado</div><div className="text-lg font-bold text-brand-700">{fmt(treasury.summary.totalCharged)}</div></Card>
                <Card className="!border-success-500/40"><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1.5">Recaudado</div><div className="text-lg font-bold text-success-700">{fmt(treasury.summary.totalCollected)}</div></Card>
                <Card className="!border-danger-500/40"><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1.5">Pendiente</div><div className="text-lg font-bold text-danger-600">{fmt(treasury.summary.totalPending)}</div></Card>
                <Card><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-1.5">Gestión</div><div className="text-lg font-bold text-brand-700">{treasury.academicYear.year}</div></Card>
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
        </>
      )}
    </div>
  )
}
