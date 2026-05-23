'use client'

import { useEffect, useState } from 'react'
import { FileBarChart, Download, Users, GraduationCap, DollarSign, AlertCircle } from 'lucide-react'

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
  const [activeTab,   setActiveTab]   = useState<'teachers' | 'delegates' | 'treasury'>('teachers')
  const [teachers,    setTeachers]    = useState<any[]>([])
  const [delegates,   setDelegates]   = useState<any[]>([])
  const [treasury,    setTreasury]    = useState<any>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchReport = async (type: string) => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${API_URL}/api/reports/${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
      if (type === 'teachers')  setTeachers(data)
      if (type === 'delegates') setDelegates(data)
      if (type === 'treasury')  setTreasury(data)
    } catch { setError('Error de conexión') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchReport(activeTab) }, [activeTab])

  // ── Exportar PDF ──────────────────────────────
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

  // ── Exportar Excel ────────────────────────────
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reportes</h1>
          <p>Informes y estadísticas del sistema</p>
        </div>
        <div className="export-btns">
          <button className="btn-pdf" onClick={exportPDF}>
            <Download size={14}/> PDF
          </button>
          <button className="btn-excel" onClick={exportExcel}>
            <Download size={14}/> Excel
          </button>
        </div>
      </div>

      {error && <div className="alert err">{error}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'teachers' ? 'active' : ''}`}
          onClick={() => setActiveTab('teachers')}>
          <GraduationCap size={15}/> Maestros
        </button>
        <button className={`tab ${activeTab === 'delegates' ? 'active' : ''}`}
          onClick={() => setActiveTab('delegates')}>
          <Users size={15}/> Delegados
        </button>
        <button className={`tab ${activeTab === 'treasury' ? 'active' : ''}`}
          onClick={() => setActiveTab('treasury')}>
          <DollarSign size={15}/> Económico
        </button>
      </div>

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : (
        <>
          {/* Reporte Maestros */}
          {activeTab === 'teachers' && (
            <div className="report-card">
              <div className="report-title"><GraduationCap size={15}/> Maestros registrados ({teachers.length})</div>
              <table>
                <thead>
                  <tr><th>#</th><th>Maestro</th><th>CI</th><th>Especialidad</th><th>Materias asignadas</th><th>Tutor de curso</th></tr>
                </thead>
                <tbody>
                  {teachers.map((t, i) => (
                    <tr key={t.id}>
                      <td className="muted">{i + 1}</td>
                      <td><div className="name">{t.lastName} {t.firstName}</div>
                        <div className="sub">{t.user?.email}</div></td>
                      <td className="muted">{t.ci || '—'}</td>
                      <td className="muted">{t.specialty || '—'}</td>
                      <td>
                        {t.assignments.length === 0 ? <span className="muted">Sin asignaciones</span> :
                          <div className="chips">
                            {t.assignments.map((a: any, j: number) => (
                              <span key={j} className="chip blue">{a.subject.name}</span>
                            ))}
                          </div>}
                      </td>
                      <td>
                        {t.tutorCourse ? (
                          <span className="chip green">
                            {LEVEL_LABELS[t.tutorCourse.course.level]} {GRADE_LABELS[t.tutorCourse.course.grade]} {t.tutorCourse.course.parallel}
                          </span>
                        ) : <span className="muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Reporte Delegados */}
          {activeTab === 'delegates' && (
            <div className="report-card">
              <div className="report-title"><Users size={15}/> Delegados por curso</div>
              <table>
                <thead>
                  <tr><th>#</th><th>Curso</th><th>Turno</th><th>Estudiantes</th><th>Delegado</th><th>Teléfono</th><th>Maestro Tutor</th></tr>
                </thead>
                <tbody>
                  {delegates.map((c, i) => (
                    <tr key={c.id}>
                      <td className="muted">{i + 1}</td>
                      <td><div className="name">{LEVEL_LABELS[c.level]} — {GRADE_LABELS[c.grade]} {c.parallel}</div></td>
                      <td className="muted">{SHIFT_LABELS[c.shift]}</td>
                      <td className="muted">{c._count.assignments}</td>
                      <td>
                        {c.delegate ? (
                          <div>
                            <div className="name">{c.delegate.lastName} {c.delegate.firstName}</div>
                            {c.delegate.ci && <div className="sub">CI: {c.delegate.ci}</div>}
                          </div>
                        ) : <span className="no-data">Sin delegado</span>}
                      </td>
                      <td className="muted">{c.delegate?.phone || '—'}</td>
                      <td>
                        {c.tutor ? (
                          <span className="chip green">{c.tutor.teacher.lastName} {c.tutor.teacher.firstName}</span>
                        ) : <span className="muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Reporte Económico */}
          {activeTab === 'treasury' && treasury && (
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              {/* Resumen */}
              <div className="summary-grid">
                <div className="sum-card">
                  <div className="sum-label">Total cobrado</div>
                  <div className="sum-value">{fmt(treasury.summary.totalCharged)}</div>
                </div>
                <div className="sum-card green">
                  <div className="sum-label">Recaudado</div>
                  <div className="sum-value">{fmt(treasury.summary.totalCollected)}</div>
                </div>
                <div className="sum-card red">
                  <div className="sum-label">Pendiente</div>
                  <div className="sum-value">{fmt(treasury.summary.totalPending)}</div>
                </div>
                <div className="sum-card">
                  <div className="sum-label">Gestión</div>
                  <div className="sum-value">{treasury.academicYear.year}</div>
                </div>
              </div>

              {/* Por tipo */}
              <div className="report-card">
                <div className="report-title"><DollarSign size={15}/> Por tipo de cargo</div>
                <table>
                  <thead>
                    <tr><th>Tipo</th><th>Cargos</th><th>Cobrado</th><th>Recaudado</th><th>Pendiente</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(treasury.byType).map(([type, data]: any) => (
                      <tr key={type}>
                        <td><div className="name">{TYPE_LABELS[type] || type}</div></td>
                        <td className="muted">{data.count}</td>
                        <td>{fmt(data.charged)}</td>
                        <td className="green-text">{fmt(data.collected)}</td>
                        <td className="red-text">{fmt(data.charged - data.collected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Morosos */}
              <div className="report-card">
                <div className="report-title"><AlertCircle size={15}/> Tutores con deuda ({treasury.morosos.length})</div>
                <table>
                  <thead>
                    <tr><th>#</th><th>Tutor</th><th>CI</th><th>Teléfono</th><th>Estudiante</th><th>Pendiente</th></tr>
                  </thead>
                  <tbody>
                    {treasury.morosos.map((m: any, i: number) => (
                      <tr key={m.id}>
                        <td className="muted">{i + 1}</td>
                        <td><div className="name">{m.lastName} {m.firstName}</div></td>
                        <td className="muted">{m.ci || '—'}</td>
                        <td className="muted">{m.phone || '—'}</td>
                        <td className="muted">{m.student ? `${m.student.lastName} ${m.student.firstName}` : '—'}</td>
                        <td className="red-text font-bold">{fmt(m.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#0F6E56;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .export-btns{display:flex;gap:8px}
        .btn-pdf{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#C0392B;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-pdf:hover{background:#A93226}
        .btn-excel{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#0F6E56;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-excel:hover{background:#0A5040}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px;background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .tabs{display:flex;background:#F0F6FC;border-radius:10px;padding:4px;gap:4px;margin-bottom:16px}
        .tab{flex:1;padding:9px;border:none;border-radius:8px;font-size:13px;cursor:pointer;background:transparent;color:#6B8BB0;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s}
        .tab.active{background:#fff;color:#0F6E56;font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.1)}
        .center{display:flex;justify-content:center;padding:48px}
        .report-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .report-title{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:700;color:#1A3A7C}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC;vertical-align:top}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .name{font-weight:500;color:#1A3A7C}
        .sub{font-size:11px;color:#6B8BB0;margin-top:2px}
        .chips{display:flex;flex-wrap:wrap;gap:4px}
        .chip{padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500}
        .chip.blue{background:#E0ECF8;color:#1A3A7C}
        .chip.green{background:#E1F5EE;color:#0F6E56}
        .no-data{font-size:12px;color:#C0392B;font-style:italic}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px}
        .sum-card.green{border-color:#9FE1CB}
        .sum-card.red{border-color:#FFBBBB}
        .sum-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
        .sum-value{font-size:18px;font-weight:700;color:#1A3A7C}
        .green-text{color:#0F6E56;font-weight:500}
        .red-text{color:#C0392B;font-weight:500}
        .font-bold{font-weight:700}
        .spinner{width:24px;height:24px;border:2px solid rgba(15,110,86,.2);border-top-color:#0F6E56;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.tabs{flex-direction:column}.summary-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}