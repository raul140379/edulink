'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Users, AlertCircle, CheckCircle, TrendingUp, Plus, ArrowRight } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Summary {
  totalCharged:   number
  totalCollected: number
  totalPending:   number
  byStatus: { PENDIENTE: number; PARCIAL: number; PAGADO: number }
  byType:   Record<string, { count: number; amount: number; collected: number }>
}

interface ParentBalance {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  students:  { student: { id: number; firstName: string; lastName: string } }[]
  summary: {
    totalDebt: number; totalPaid: number; totalPending: number
    hasDebt: boolean; chargesCount: number
  }
}

const TYPE_LABELS: Record<string, string> = {
  CUOTA_INICIAL:    'Cuota Inicial',
  DEUDA_ANTERIOR:   'Deuda Anterior',
  MULTA_ASAMBLEA:   'Multa Asamblea',
  MINGA:            'Minga',
  MULTA_REUNION:    'Multa Reunión',
  ACTIVIDAD:        'Actividad',
  MATERIAL_ESCOLAR: 'Material Escolar',
  OTRO:             'Otro',
}

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

export default function JuntaDashboard() {
  const router  = useRouter()
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [parents,  setParents]  = useState<ParentBalance[]>([])
  const [loading,  setLoading]  = useState(true)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(`${API_URL}/api/treasury/summary`,          { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/treasury/parents?status=CON_DEUDA`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [sData, pData] = await Promise.all([sRes.json(), pRes.json()])
      if (sRes.ok) setSummary(sData)
      if (pRes.ok) setParents(pData.slice(0, 5)) // Solo los 5 primeros
    } catch { console.error('Error cargando datos') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const porcentaje = summary
    ? summary.totalCharged > 0
      ? Math.round((summary.totalCollected / summary.totalCharged) * 100)
      : 0
    : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Panel de Tesorería</h1>
          <p>Gestión económica — U.E. Naciones Unidas</p>
        </div>
        <button className="btn-primary" onClick={() => router.push('/dashboard/junta/cargos/nuevo')}>
          <Plus size={16}/> Nuevo cargo
        </button>
      </div>

      {loading ? (
        <div className="center"><div className="spinner"/></div>
      ) : (
        <>
          {/* Tarjetas resumen */}
          <div className="summary-grid">
            <div className="sum-card">
              <div className="sum-icon blue"><DollarSign size={22}/></div>
              <div>
                <div className="sum-label">Total cobrado</div>
                <div className="sum-value">{fmt(summary?.totalCharged || 0)}</div>
              </div>
            </div>
            <div className="sum-card">
              <div className="sum-icon green"><CheckCircle size={22}/></div>
              <div>
                <div className="sum-label">Recaudado</div>
                <div className="sum-value">{fmt(summary?.totalCollected || 0)}</div>
              </div>
            </div>
            <div className="sum-card">
              <div className="sum-icon red"><AlertCircle size={22}/></div>
              <div>
                <div className="sum-label">Pendiente</div>
                <div className="sum-value">{fmt(summary?.totalPending || 0)}</div>
              </div>
            </div>
            <div className="sum-card">
              <div className="sum-icon yellow"><TrendingUp size={22}/></div>
              <div>
                <div className="sum-label">% Recaudado</div>
                <div className="sum-value">{porcentaje}%</div>
              </div>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="progress-card">
            <div className="progress-header">
              <span>Progreso de recaudación</span>
              <span className="progress-pct">{porcentaje}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${porcentaje}%` }}/>
            </div>
            <div className="progress-footer">
              <span className="green">{fmt(summary?.totalCollected || 0)} recaudado</span>
              <span className="red">{fmt(summary?.totalPending || 0)} pendiente</span>
            </div>
          </div>

          <div className="two-cols">
            {/* Estado por tipo de cargo */}
            <div className="section-card">
              <div className="section-title">📊 Por tipo de cargo</div>
              {summary && Object.keys(summary.byType).length === 0 ? (
                <div className="no-data">Sin cargos registrados</div>
              ) : (
                <div className="type-list">
                  {summary && Object.entries(summary.byType).map(([type, data]) => (
                    <div key={type} className="type-item">
                      <div className="type-info">
                        <span className="type-name">{TYPE_LABELS[type] || type}</span>
                        <span className="type-count">{data.count} cargos</span>
                      </div>
                      <div className="type-amounts">
                        <span className="green">{fmt(data.collected)}</span>
                        <span className="slash">/</span>
                        <span className="muted">{fmt(data.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Estado de cargos */}
            <div className="section-card">
              <div className="section-title">📋 Estado de cargos</div>
              <div className="status-list">
                <div className="status-item red">
                  <div className="status-left">
                    <AlertCircle size={16}/>
                    <span>Pendientes</span>
                  </div>
                  <span className="status-count">{summary?.byStatus.PENDIENTE || 0}</span>
                </div>
                <div className="status-item yellow">
                  <div className="status-left">
                    <TrendingUp size={16}/>
                    <span>Parciales</span>
                  </div>
                  <span className="status-count">{summary?.byStatus.PARCIAL || 0}</span>
                </div>
                <div className="status-item green">
                  <div className="status-left">
                    <CheckCircle size={16}/>
                    <span>Pagados</span>
                  </div>
                  <span className="status-count">{summary?.byStatus.PAGADO || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tutores con deuda */}
          <div className="section-card">
            <div className="section-header">
              <div className="section-title"><Users size={15}/> Tutores con deuda pendiente</div>
              <button className="btn-ver-todos" onClick={() => router.push('/dashboard/junta/tesoreria')}>
                Ver todos <ArrowRight size={13}/>
              </button>
            </div>
            {parents.length === 0 ? (
              <div className="no-data">🎉 ¡Todos los tutores están al día!</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Tutor</th>
                    <th>Estudiantes</th>
                    <th>Pendiente</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {parents.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div className="tname">{p.lastName} {p.firstName}</div>
                        {p.ci && <div className="tsub">CI: {p.ci}</div>}
                      </td>
                      <td>
                        {p.students.map(ps => (
                          <span key={ps.student.id} className="student-chip">
                            {ps.student.lastName} {ps.student.firstName}
                          </span>
                        ))}
                      </td>
                      <td className="amount red">{fmt(p.summary.totalPending)}</td>
                      <td>
                        <button className="btn-ver" onClick={() => router.push(`/dashboard/junta/tesoreria/${p.id}`)}>
                          Ver cuenta
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px}
        .page-header h1{font-size:20px;font-weight:700;color:#0F6E56;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .center{display:flex;justify-content:center;padding:48px}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .sum-icon{padding:10px;border-radius:10px;display:flex;align-items:center;justify-content:center}
        .sum-icon.blue{background:#E0ECF8;color:#1A3A7C}
        .sum-icon.green{background:#E1F5EE;color:#0F6E56}
        .sum-icon.red{background:#FFF0F0;color:#C0392B}
        .sum-icon.yellow{background:#FFFBEA;color:#7A6000}
        .sum-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .sum-value{font-size:18px;font-weight:700;color:#1A3A7C}
        .progress-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:18px;margin-bottom:16px}
        .progress-header{display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:#1A3A7C;margin-bottom:10px}
        .progress-pct{color:#0F6E56}
        .progress-bar{height:12px;background:#F0F6FC;border-radius:20px;overflow:hidden;margin-bottom:8px}
        .progress-fill{height:100%;background:linear-gradient(90deg,#0F6E56,#4A9FD4);border-radius:20px;transition:width .5s ease}
        .progress-footer{display:flex;justify-content:space-between;font-size:12px}
        .two-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
        .section-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden;margin-bottom:16px}
        .section-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #F0F6FC}
        .section-title{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F0F6FC;font-size:13px;font-weight:700;color:#1A3A7C}
        .section-card .section-title{border-bottom:none;padding-bottom:0}
        .section-header .section-title{border-bottom:none;padding:0}
        .btn-ver-todos{display:flex;align-items:center;gap:4px;background:none;border:none;color:#0F6E56;font-size:12px;font-weight:600;cursor:pointer}
        .btn-ver-todos:hover{text-decoration:underline}
        .type-list{display:flex;flex-direction:column;gap:0;padding:0 18px 14px}
        .type-item{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F0F6FC}
        .type-item:last-child{border-bottom:none}
        .type-info{display:flex;flex-direction:column;gap:2px}
        .type-name{font-size:13px;font-weight:500;color:#1A3A7C}
        .type-count{font-size:11px;color:#6B8BB0}
        .type-amounts{display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600}
        .slash{color:#CBE0F0}
        .status-list{display:flex;flex-direction:column;gap:0;padding:0 18px 14px}
        .status-item{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #F0F6FC}
        .status-item:last-child{border-bottom:none}
        .status-left{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500}
        .status-item.red .status-left{color:#C0392B}
        .status-item.yellow .status-left{color:#7A6000}
        .status-item.green .status-left{color:#0F6E56}
        .status-count{font-size:18px;font-weight:700;color:#1A3A7C}
        .no-data{padding:20px 18px;font-size:13px;color:#6B8BB0;font-style:italic}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:11px 16px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        td{padding:11px 16px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC;vertical-align:top}
        tr:hover td{background:#FAFCFF}
        .tname{font-weight:500}
        .tsub{font-size:11px;color:#6B8BB0;margin-top:2px}
        .student-chip{font-size:11px;background:#E0ECF8;color:#1A3A7C;padding:2px 8px;border-radius:20px;display:inline-block;margin:1px}
        .amount{font-weight:600;white-space:nowrap}
        .amount.red{color:#C0392B}
        .green{color:#0F6E56}
        .red{color:#C0392B}
        .muted{color:#6B8BB0}
        .btn-ver{padding:6px 12px;background:#0F6E56;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer}
        .btn-ver:hover{background:#0A5040}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#0F6E56;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover{background:#0A5040}
        .spinner{width:24px;height:24px;border:2px solid rgba(15,110,86,.2);border-top-color:#0F6E56;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.two-cols{grid-template-columns:1fr}.summary-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}