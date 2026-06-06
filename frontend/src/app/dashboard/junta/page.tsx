'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Users, AlertCircle, CheckCircle, TrendingUp, Plus, ArrowRight, RefreshCw, Trash2, Eye, X, Copy, Check } from 'lucide-react'

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

interface Delegate {
  id:             number
  firstName:      string
  lastName:       string
  ci?:            string
  phone?:         string
  delegateUserId?: number
  delegateUser?:  { id: number; email: string; isActive: boolean }
  delegateCourse?: {
    id: number; grade: string; parallel: string; level: string; shift: string
  }
}

interface Credentials {
  accessEmail:     string
  defaultPassword: string
  delegateName:    string
  courseLabel:     string
}

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°'
}
const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche'
}

const TYPE_LABELS: Record<string, string> = {
  CUOTA_INICIAL: 'Cuota Inicial', DEUDA_ANTERIOR: 'Deuda Anterior',
  MULTA_ASAMBLEA: 'Multa Asamblea', MINGA: 'Minga',
  MULTA_REUNION: 'Multa Reunión', ACTIVIDAD: 'Actividad',
  MATERIAL_ESCOLAR: 'Material Escolar', OTRO: 'Otro',
}

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

export default function JuntaDashboard() {
  const router = useRouter()
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [parents,   setParents]   = useState<ParentBalance[]>([])
  const [delegates, setDelegates] = useState<Delegate[]>([])
  const [loading,   setLoading]   = useState(true)
  const [working,   setWorking]   = useState<number | null>(null)
  const [creds,     setCreds]     = useState<Credentials | null>(null)
  const [copied,    setCopied]    = useState(false)
  const [success,   setSuccess]   = useState('')
  const [error,     setError]     = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'ok' | 'err' = 'ok') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else               { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sRes, pRes, dRes] = await Promise.all([
        fetch(`${API_URL}/api/treasury/summary`,                  { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/treasury/parents?status=CON_DEUDA`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/delegates`,                         { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [sData, pData, dData] = await Promise.all([sRes.json(), pRes.json(), dRes.json()])
      if (sRes.ok) setSummary(sData)
      if (pRes.ok) setParents(pData.slice(0, 5))
      if (dRes.ok) {
        // Extraer solo cursos que tienen delegado asignado
        const withDelegate = dData
          .filter((c: any) => c.delegate)
          .map((c: any) => ({
            ...c.delegate,
            delegateCourse: { id: c.id, grade: c.grade, parallel: c.parallel, level: c.level, shift: c.shift }
          }))
        setDelegates(withDelegate)
      }
    } catch { console.error('Error cargando datos') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const handleResetPassword = async (courseId: number, delegate: Delegate) => {
    if (!confirm(`¿Resetear la contraseña de ${delegate.lastName} ${delegate.firstName}?`)) return
    setWorking(delegate.id)
    try {
      const res  = await fetch(`${API_URL}/api/courses/${courseId}/delegate-user/reset`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      setCreds({
        accessEmail:     delegate.delegateUser?.email || '',
        defaultPassword: data.defaultPassword,
        delegateName:    `${delegate.lastName} ${delegate.firstName}`,
        courseLabel:     `${GRADE_LABELS[delegate.delegateCourse?.grade || '']} "${delegate.delegateCourse?.parallel}" ${SHIFT_LABELS[delegate.delegateCourse?.shift || '']}`,
      })
    } catch { notify('Error de conexión', 'err') }
    finally  { setWorking(null) }
  }

  const handleRemoveDelegate = async (courseId: number, name: string) => {
    if (!confirm(`¿Quitar a ${name} como delegado?`)) return
    setWorking(courseId)
    try {
      const res  = await fetch(`${API_URL}/api/delegates/course/${courseId}/remove`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { notify(data.message); fetchData() }
      else notify(data.message, 'err')
    } catch { notify('Error de conexión', 'err') }
    finally  { setWorking(null) }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(`Delegado: ${creds.delegateName}\nCurso: ${creds.courseLabel}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const porcentaje = summary
    ? summary.totalCharged > 0
      ? Math.round((summary.totalCollected / summary.totalCharged) * 100)
      : 0
    : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Panel de Junta Escolar</h1>
          <p>Gestión económica y delegados — U.E. Naciones Unidas</p>
        </div>
        <button className="btn-primary" onClick={() => router.push('/dashboard/junta/cargos/nuevo')}>
          <Plus size={16}/> Nuevo cargo
        </button>
      </div>

      {success && <div className="alert ok">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

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
                  <div className="status-left"><AlertCircle size={16}/><span>Pendientes</span></div>
                  <span className="status-count">{summary?.byStatus.PENDIENTE || 0}</span>
                </div>
                <div className="status-item yellow">
                  <div className="status-left"><TrendingUp size={16}/><span>Parciales</span></div>
                  <span className="status-count">{summary?.byStatus.PARCIAL || 0}</span>
                </div>
                <div className="status-item green">
                  <div className="status-left"><CheckCircle size={16}/><span>Pagados</span></div>
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
                  <tr><th>Tutor</th><th>Estudiantes</th><th>Pendiente</th><th>Acción</th></tr>
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

          {/* ── Delegados ── */}
          <div className="section-card">
            <div className="section-header">
              <div className="section-title"><Users size={15}/> Delegados de curso ({delegates.length})</div>
              <button className="btn-ver-todos" onClick={() => router.push('/dashboard/junta/delegados')}>
                Gestionar <ArrowRight size={13}/>
              </button>
            </div>
            {delegates.length === 0 ? (
              <div className="no-data">No hay delegados asignados aún</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Delegado</th>
                    <th>CI / Teléfono</th>
                    <th>Curso</th>
                    <th>Usuario</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {delegates.map(d => {
                    const isWorking = working === d.id
                    const courseId  = d.delegateCourse?.id
                    const courseLabel = d.delegateCourse
                      ? `${GRADE_LABELS[d.delegateCourse.grade]} "${d.delegateCourse.parallel}" ${SHIFT_LABELS[d.delegateCourse.shift]}`
                      : '—'
                    return (
                      <tr key={d.id}>
                        <td>
                          <div className="tname">{d.lastName} {d.firstName}</div>
                        </td>
                        <td>
                          {d.ci && <div className="tsub">CI: {d.ci}</div>}
                          {d.phone && <div className="tsub">📱 {d.phone}</div>}
                          {!d.ci && !d.phone && <span className="muted">—</span>}
                        </td>
                        <td>
                          <span className="course-chip">{courseLabel}</span>
                        </td>
                        <td>
                          {d.delegateUser ? (
                            <div>
                              <div style={{fontSize:'11px',color:'#0F6E56'}}>✅ Activo</div>
                              <div style={{fontSize:'10px',color:'#6B8BB0',fontFamily:'monospace'}}>{d.delegateUser.email}</div>
                            </div>
                          ) : (
                            <span style={{fontSize:'11px',color:'#C0392B'}}>❌ Sin usuario</span>
                          )}
                        </td>
                        <td>
                          <div className="actions">
                            {d.delegateUser && courseId && (
                              <button className="icon-btn reset" title="Resetear contraseña"
                                disabled={isWorking}
                                onClick={() => handleResetPassword(courseId, d)}>
                                {isWorking ? <span className="spinsm"/> : <RefreshCw size={13}/>}
                              </button>
                            )}
                            {courseId && (
                              <button className="icon-btn del" title="Quitar delegado"
                                disabled={isWorking}
                                onClick={() => handleRemoveDelegate(courseId, `${d.lastName} ${d.firstName}`)}>
                                <Trash2 size={13}/>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Modal credenciales */}
      {creds && (
        <div className="overlay" onClick={() => setCreds(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>✅ Contraseña reseteada</h2>
              <button onClick={() => setCreds(null)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="info-box"><strong>{creds.delegateName}</strong> — {creds.courseLabel}</div>
              <div className="cred-row">
                <span className="cred-label">Email:</span>
                <span className="cred-value">{creds.accessEmail}</span>
              </div>
              <div className="cred-row">
                <span className="cred-label">Contraseña:</span>
                <span className="cred-value">{creds.defaultPassword}</span>
              </div>
              <div className="cred-note">⚠️ Entrega estas credenciales al delegado.</div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={copyCreds}>
                {copied ? <Check size={14}/> : <Copy size={14}/>}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button className="btn-primary" onClick={() => setCreds(null)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px}
        .page-header h1{font-size:20px;font-weight:700;color:#0F6E56;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:14px}
        .alert.ok{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
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
        .type-list{display:flex;flex-direction:column;padding:0 18px 14px}
        .type-item{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F0F6FC}
        .type-item:last-child{border-bottom:none}
        .type-info{display:flex;flex-direction:column;gap:2px}
        .type-name{font-size:13px;font-weight:500;color:#1A3A7C}
        .type-count{font-size:11px;color:#6B8BB0}
        .type-amounts{display:flex;align-items:center;gap:4px;font-size:13px;font-weight:600}
        .slash{color:#CBE0F0}
        .status-list{display:flex;flex-direction:column;padding:0 18px 14px}
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
        td{padding:11px 16px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC;vertical-align:middle}
        tr:hover td{background:#FAFCFF}
        .tname{font-weight:500}
        .tsub{font-size:11px;color:#6B8BB0;margin-top:2px}
        .muted{color:#6B8BB0;font-size:12px}
        .student-chip{font-size:11px;background:#E0ECF8;color:#1A3A7C;padding:2px 8px;border-radius:20px;display:inline-block;margin:1px}
        .course-chip{font-size:11px;background:#E1F5EE;color:#0F6E56;padding:3px 10px;border-radius:20px;font-weight:500}
        .amount{font-weight:600;white-space:nowrap}
        .amount.red{color:#C0392B}
        .green{color:#0F6E56}
        .red{color:#C0392B}
        .actions{display:flex;gap:6px}
        .icon-btn{width:28px;height:28px;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center}
        .icon-btn.reset{background:#E0ECF8;color:#1A3A7C}
        .icon-btn.reset:hover:not(:disabled){background:#4A9FD4;color:#fff}
        .icon-btn.del{background:#FFF0F0;color:#C0392B}
        .icon-btn.del:hover:not(:disabled){background:#FFD5D5}
        .icon-btn:disabled{opacity:.5;cursor:not-allowed}
        .btn-ver{padding:6px 12px;background:#0F6E56;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer}
        .btn-ver:hover{background:#0A5040}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#0F6E56;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover{background:#0A5040}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:420px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C;margin:0}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F0F6FC}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:12px}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:13px;color:#1A3A7C}
        .cred-row{display:flex;align-items:center;gap:10px;background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:10px 14px}
        .cred-label{font-size:12px;font-weight:600;color:#6B8BB0;min-width:80px;text-transform:uppercase;letter-spacing:.5px}
        .cred-value{font-size:13px;font-weight:600;color:#1A3A7C;font-family:monospace;word-break:break-all}
        .cred-note{font-size:12px;color:#BA7517;background:#FFFBEA;border:1px solid #F5C518;border-radius:8px;padding:10px}
        .spinner{width:24px;height:24px;border:2px solid rgba(15,110,86,.2);border-top-color:#0F6E56;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:currentColor;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.two-cols{grid-template-columns:1fr}.summary-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}