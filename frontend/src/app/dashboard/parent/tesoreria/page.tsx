'use client'

import { useEffect, useState } from 'react'
import { DollarSign, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Payment {
  id: number; amount: number; method: string; reference?: string; note?: string; date: string
}

interface Charge {
  id:          number
  title:       string
  description?: string
  amount:      number
  paidAmount:  number
  status:      string
  type:        string
  dueDate?:    string
  tolerance:   boolean
  academicYear?: { year: number }
  student?:    { firstName: string; lastName: string }
  payments:    Payment[]
}

interface Summary {
  totalDebt:    number
  totalPaid:    number
  totalPending: number
}

const TYPE_LABELS: Record<string,string> = {
  CUOTA_INICIAL:    'Cuota Inicial',
  DEUDA_ANTERIOR:   'Deuda Anterior',
  MULTA_ASAMBLEA:   'Multa Asamblea',
  MINGA:            'Minga',
  MULTA_REUNION:    'Multa Reunión',
  ACTIVIDAD:        'Actividad',
  MATERIAL_ESCOLAR: 'Material Escolar',
  OTRO:             'Otro',
}

const METHOD_LABELS: Record<string,string> = {
  EFECTIVO:     'Efectivo',
  TRANSFERENCIA:'Transferencia',
  QR:           'QR',
  OTRO:         'Otro',
}

const STATUS_CONFIG: Record<string,{label:string;bg:string;color:string}> = {
  PENDIENTE: { label:'Pendiente', bg:'#FFF0F0', color:'#C0392B' },
  PARCIAL:   { label:'Parcial',   bg:'#FFFBEA', color:'#BA7517' },
  PAGADO:    { label:'Pagado',    bg:'#E1F5EE', color:'#0F6E56' },
  ANULADO:   { label:'Anulado',   bg:'#F5F5F5', color:'#6B8BB0' },
}

const fmt     = (n: number) => `Bs. ${n.toFixed(2)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'short', year:'numeric' })

export default function ParentTesoreriaPage() {
  const [charges,    setCharges]    = useState<Charge[]>([])
  const [summary,    setSummary]    = useState<Summary | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [expanded,   setExpanded]   = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token')
      if (!token) { setError('No autenticado'); setLoading(false); return }
      setLoading(true)
      try {
        // Primero obtener parentId
        const meRes  = await fetch(`${API_URL}/api/parents/me`, { headers: { Authorization: `Bearer ${token}` } })
        const meData = await meRes.json()
        if (!meRes.ok) { setError(meData.message || 'Error al cargar perfil'); return }

        // Luego obtener estado de cuenta
        const aRes  = await fetch(`${API_URL}/api/treasury/parents/${meData.id}/account`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const aData = await aRes.json()
        if (aRes.ok) {
          setCharges(aData.charges || [])
          setSummary(aData.summary || null)
        } else {
          setError(aData.message || 'Error al cargar estado de cuenta')
        }
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    init()
  }, [])

  const filtered = charges.filter(c => {
    if (filterStatus === 'all') return c.status !== 'ANULADO'
    return c.status === filterStatus
  })

  const pendingCount = charges.filter(c => c.status === 'PENDIENTE' || c.status === 'PARCIAL').length

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p style={{color:'#C0392B'}}>{error}</p></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Estado de Cuenta</h1>
          <p>Historial de cargos y pagos</p>
        </div>
      </div>

      {/* Resumen */}
      {summary && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><DollarSign size={20}/></div>
            <div>
              <div className="stat-label">Total asignado</div>
              <div className="stat-value">{fmt(summary.totalDebt)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><CheckCircle size={20}/></div>
            <div>
              <div className="stat-label">Total pagado</div>
              <div className="stat-value" style={{color:'#0F6E56'}}>{fmt(summary.totalPaid)}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className={`stat-icon ${summary.totalPending > 0 ? 'red' : 'green'}`}>
              <AlertCircle size={20}/>
            </div>
            <div>
              <div className="stat-label">Saldo pendiente</div>
              <div className="stat-value" style={{color: summary.totalPending > 0 ? '#C0392B' : '#0F6E56'}}>
                {fmt(summary.totalPending)}
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className={`stat-icon ${pendingCount > 0 ? 'yellow' : 'green'}`}><Clock size={20}/></div>
            <div>
              <div className="stat-label">Cargos pendientes</div>
              <div className="stat-value" style={{color: pendingCount > 0 ? '#BA7517' : '#0F6E56'}}>
                {pendingCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estado general */}
      {summary && summary.totalPending === 0 && charges.length > 0 ? (
        <div className="alert-ok"><CheckCircle size={14}/> ¡Estás al día con todos los pagos! ✓</div>
      ) : summary && summary.totalPending > 0 ? (
        <div className="alert-warn"><AlertCircle size={14}/> Tienes {fmt(summary.totalPending)} pendiente de pago</div>
      ) : null}

      {/* Filtros */}
      <div className="filter-bar">
        <button className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilterStatus('all')}>
          Activos ({charges.filter(c => c.status !== 'ANULADO').length})
        </button>
        <button className={`filter-btn ${filterStatus === 'PENDIENTE' ? 'active' : ''}`} onClick={() => setFilterStatus('PENDIENTE')}>
          Pendientes ({charges.filter(c => c.status === 'PENDIENTE').length})
        </button>
        <button className={`filter-btn ${filterStatus === 'PARCIAL' ? 'active' : ''}`} onClick={() => setFilterStatus('PARCIAL')}>
          Parciales ({charges.filter(c => c.status === 'PARCIAL').length})
        </button>
        <button className={`filter-btn ${filterStatus === 'PAGADO' ? 'active' : ''}`} onClick={() => setFilterStatus('PAGADO')}>
          Pagados ({charges.filter(c => c.status === 'PAGADO').length})
        </button>
      </div>

      {/* Lista de cargos */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <DollarSign size={40} color="#CBE0F0"/>
          <p>No hay cargos en esta categoría</p>
        </div>
      ) : (
        <div className="charges-list">
          {filtered.map(c => {
            const st  = STATUS_CONFIG[c.status] || STATUS_CONFIG['PENDIENTE']
            const exp = expanded === c.id
            const pending = c.amount - c.paidAmount
            return (
              <div key={c.id} className="charge-card">
                <div className="charge-header" onClick={() => setExpanded(exp ? null : c.id)}>
                  <div className="charge-left">
                    <span className="charge-type-badge">{TYPE_LABELS[c.type] || c.type}</span>
                    <div className="charge-title">{c.title}</div>
                    {c.description && <div className="charge-desc">{c.description}</div>}
                    {c.student && <div className="charge-student">👤 {c.student.lastName} {c.student.firstName}</div>}
                    <div className="charge-meta">
                      {c.dueDate && <span className={`due-date ${new Date(c.dueDate) < new Date() && c.status !== 'PAGADO' ? 'overdue' : ''}`}>
                        📅 Vence: {fmtDate(c.dueDate)}
                      </span>}
                      {c.academicYear && <span className="year-badge">Gestión {c.academicYear.year}</span>}
                      {c.tolerance && <span className="tolerance-badge">⏱ Con tolerancia</span>}
                    </div>
                  </div>
                  <div className="charge-right">
                    <span className="status-badge" style={{background: st.bg, color: st.color}}>{st.label}</span>
                    <div className="charge-amount">{fmt(c.amount)}</div>
                    {c.paidAmount > 0 && <div className="charge-paid">Pagado: {fmt(c.paidAmount)}</div>}
                    {pending > 0 && c.status !== 'ANULADO' && (
                      <div className="charge-pending">Pendiente: {fmt(pending)}</div>
                    )}
                    {c.payments.length > 0 && (
                      <button className="btn-expand">
                        {exp ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                        {c.payments.length} pago{c.payments.length > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                </div>

                {/* Historial de pagos */}
                {exp && c.payments.length > 0 && (
                  <div className="payments-list">
                    <div className="payments-header">Historial de pagos</div>
                    {c.payments.map(p => (
                      <div key={p.id} className="payment-item">
                        <div className="payment-left">
                          <CheckCircle size={13} color="#0F6E56"/>
                          <div>
                            <div className="payment-method">{METHOD_LABELS[p.method] || p.method}</div>
                            {p.reference && <div className="payment-ref">Ref: {p.reference}</div>}
                            {p.note && <div className="payment-ref">{p.note}</div>}
                          </div>
                        </div>
                        <div className="payment-right">
                          <div className="payment-amount">{fmt(p.amount)}</div>
                          <div className="payment-date">{fmtDate(p.date)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .page-header{margin-bottom:24px}
        .page-header h1{font-size:20px;font-weight:700;color:#27500A;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
        .stat-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .stat-icon{padding:10px;border-radius:10px;display:flex}
        .stat-icon.green{background:#E1F5EE;color:#0F6E56}
        .stat-icon.red{background:#FFF0F0;color:#C0392B}
        .stat-icon.blue{background:#E0ECF8;color:#1A3A7C}
        .stat-icon.yellow{background:#FFFBEA;color:#7A6000}
        .stat-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .stat-value{font-size:18px;font-weight:700;color:#1A3A7C}
        .alert-ok{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;font-size:13px;color:#0F6E56;margin-bottom:16px}
        .alert-warn{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#FFF0F0;border:1px solid #FFBBBB;border-radius:8px;font-size:13px;color:#C0392B;margin-bottom:16px}
        .filter-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
        .filter-btn{padding:7px 14px;border:1.5px solid #CBE0F0;border-radius:20px;background:#fff;color:#6B8BB0;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
        .filter-btn:hover{border-color:#27500A;color:#27500A}
        .filter-btn.active{background:#27500A;color:#fff;border-color:#27500A}
        .empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:60px;color:#6B8BB0;font-size:13px;background:#fff;border:1px solid #CBE0F0;border-radius:12px}
        .charges-list{display:flex;flex-direction:column;gap:10px}
        .charge-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        .charge-header{display:flex;align-items:flex-start;justify-content:space-between;padding:16px;gap:16px;cursor:pointer}
        .charge-header:hover{background:#FAFCFF}
        .charge-left{flex:1;display:flex;flex-direction:column;gap:4px}
        .charge-type-badge{font-size:11px;font-weight:600;color:#1A3A7C;background:#E0ECF8;padding:2px 8px;border-radius:20px;width:fit-content}
        .charge-title{font-size:14px;font-weight:600;color:#1A3A7C;margin-top:2px}
        .charge-desc{font-size:12px;color:#6B8BB0}
        .charge-student{font-size:12px;color:#6B8BB0}
        .charge-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
        .due-date{font-size:11px;color:#6B8BB0}
        .due-date.overdue{color:#C0392B;font-weight:600}
        .year-badge{font-size:11px;color:#6B8BB0;background:#F0F6FC;padding:2px 8px;border-radius:20px}
        .tolerance-badge{font-size:11px;color:#BA7517;background:#FFFBEA;padding:2px 8px;border-radius:20px}
        .charge-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
        .status-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .charge-amount{font-size:16px;font-weight:700;color:#1A3A7C}
        .charge-paid{font-size:11px;color:#0F6E56}
        .charge-pending{font-size:12px;font-weight:600;color:#C0392B}
        .btn-expand{display:flex;align-items:center;gap:4px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:11px;padding:0}
        .btn-expand:hover{color:#1A3A7C}
        .payments-list{border-top:1px solid #F0F6FC;background:#F8FBFF}
        .payments-header{padding:8px 16px;font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px}
        .payment-item{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid #F0F6FC;gap:12px}
        .payment-left{display:flex;align-items:center;gap:8px}
        .payment-method{font-size:13px;font-weight:500;color:#1A3A7C}
        .payment-ref{font-size:11px;color:#6B8BB0}
        .payment-right{text-align:right}
        .payment-amount{font-size:13px;font-weight:700;color:#0F6E56}
        .payment-date{font-size:11px;color:#6B8BB0}
        .spinner{width:24px;height:24px;border:2px solid rgba(39,80,10,.2);border-top-color:#27500A;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.stats-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}
