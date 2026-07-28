'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, DollarSign, CheckCircle, AlertCircle, Clock, CreditCard } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Payment {
  id:        number
  amount:    number
  method:    string
  reference?: string
  note?:     string
  date:      string
}

interface Charge {
  id:          number
  title:       string
  description?: string
  amount:      number
  paidAmount:  number
  type:        string
  target:      string
  status:      string
  dueDate?:    string
  tolerance:   boolean
  toleranceNote?: string
  createdAt:   string
  student?:    { id: number; firstName: string; lastName: string }
  academicYear: { year: number }
  payments:    Payment[]
}

interface Account {
  parent: {
    id: number; firstName: string; lastName: string; ci?: string; phone?: string
    students: { relationType: string; student: { id: number; firstName: string; lastName: string } }[]
  }
  charges: Charge[]
  summary: { totalDebt: number; totalPaid: number; totalPending: number }
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

const METHOD_LABELS: Record<string, string> = {
  EFECTIVO:         'Efectivo',
  DEPOSITO_BANCARIO:'Depósito Bancario',
  QR:               'QR',
  TRANSFERENCIA:    'Transferencia',
  OTRO:             'Otro',
}

const STATUS_COLOR: Record<string, string> = {
  PENDIENTE: 'red',
  PARCIAL:   'yellow',
  PAGADO:    'green',
  ANULADO:   'gray',
}

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL:   'Parcial',
  PAGADO:    'Pagado',
  ANULADO:   'Anulado',
}

const fmt     = (n: number) => `Bs. ${n.toFixed(2)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

export default function TutorAccountPage() {
  const params = useParams()
  const router = useRouter()
  const parentId = params.parentId as string
  const userRole = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').role : ''
  const canEdit  = userRole === 'SUPER_ADMIN' || userRole === 'JUNTA_ESCOLAR'
  const [account,      setAccount]      = useState<Account | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [payForm,      setPayForm]      = useState({ amount: '', method: 'EFECTIVO', reference: '', note: '' })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const fetchAccount = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/parents/${parentId}/account`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setAccount(data)
      else notify('Error al cargar estado de cuenta', 'error')
    } catch { notify('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAccount() }, [parentId])

  const openPayModal = (charge: Charge) => {
    setSelectedCharge(charge)
    setPayForm({ amount: (charge.amount - charge.paidAmount).toFixed(2), method: 'EFECTIVO', reference: '', note: '' })
    setShowPayModal(true)
  }

  const handlePay = async () => {
    if (!selectedCharge) return
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/treasury/${selectedCharge.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payForm),
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'error'); return }
      notify(data.message)
      setShowPayModal(false)
      fetchAccount()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (!account) return <div className="center"><p>No se encontró el estado de cuenta</p></div>

  const { parent, charges, summary } = account
  const pending = charges.filter(c => c.status === 'PENDIENTE' || c.status === 'PARCIAL')
  const paid    = charges.filter(c => c.status === 'PAGADO')
  const annulled = charges.filter(c => c.status === 'ANULADO')

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="tutor-header">
          <div className="avatar">{parent.firstName[0]}{parent.lastName[0]}</div>
          <div>
            <h1>{parent.lastName} {parent.firstName}</h1>
            <div className="tutor-meta">
              {parent.ci    && <span>CI: {parent.ci}</span>}
              {parent.phone && <span>📱 {parent.phone}</span>}
            </div>
            <div className="students-list">
              {parent.students.map(ps => (
                <span key={ps.student.id} className="student-chip">
                  {ps.student.lastName} {ps.student.firstName}
                </span>
              ))}
            </div>
          </div>
        </div>
        {canEdit && (
        <button className="btn-primary" onClick={() => router.push(`/dashboard/admin/tesoreria/nuevo-cargo?parentId=${parentId}`)}>
         <Plus size={16}/> Nuevo cargo
         </button>
            )}
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && !showPayModal && <div className="alert err">{error}</div>}

      {/* Resumen económico */}
      <div className="summary-grid">
        <div className="sum-card blue">
          <DollarSign size={20} color="#0A5A45"/>
          <div>
            <div className="sum-label">Total cargado</div>
            <div className="sum-value">{fmt(summary.totalDebt)}</div>
          </div>
        </div>
        <div className="sum-card green">
          <CheckCircle size={20} color="#0F6E56"/>
          <div>
            <div className="sum-label">Total pagado</div>
            <div className="sum-value">{fmt(summary.totalPaid)}</div>
          </div>
        </div>
        <div className={`sum-card ${summary.totalPending > 0 ? 'red' : 'green'}`}>
          <AlertCircle size={20} color={summary.totalPending > 0 ? '#C0392B' : '#0F6E56'}/>
          <div>
            <div className="sum-label">Saldo pendiente</div>
            <div className="sum-value">{fmt(summary.totalPending)}</div>
          </div>
        </div>
      </div>

      {/* Cargos pendientes */}
      {pending.length > 0 && (
        <div className="section-card">
          <div className="section-title"><AlertCircle size={15} color="#C0392B"/> Cargos pendientes</div>
          <div className="charges-list">
            {pending.map(c => (
              <div key={c.id} className="charge-item">
                <div className="charge-left">
                  <div className="charge-top">
                    <span className={`type-badge ${c.target === 'TUTOR' ? 'blue' : 'purple'}`}>
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                    <span className={`sbadge ${STATUS_COLOR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                    {c.tolerance && <span className="tolerance-badge">⚠️ Tolerancia</span>}
                  </div>
                  <div className="charge-title">{c.title}</div>
                  {c.student && <div className="charge-student">Estudiante: {c.student.lastName} {c.student.firstName}</div>}
                  {c.description && <div className="charge-desc">{c.description}</div>}
                  {c.toleranceNote && <div className="charge-tolerance">{c.toleranceNote}</div>}
                  <div className="charge-meta">
                    <span>{c.academicYear.year}</span>
                    {c.dueDate && <span><Clock size={11}/> Vence: {fmtDate(c.dueDate)}</span>}
                  </div>
                </div>
                <div className="charge-right">
                  <div className="charge-amount">
                    <div className="amount-total">{fmt(c.amount)}</div>
                    <div className="amount-paid">Pagado: {fmt(c.paidAmount)}</div>
                    <div className="amount-pending">Pendiente: {fmt(c.amount - c.paidAmount)}</div>
                  </div>
                  {canEdit && (
                    <button className="btn-pay" onClick={() => openPayModal(c)}>
                        <CreditCard size={13}/> Registrar pago
                        </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cargos pagados */}
      {paid.length > 0 && (
        <div className="section-card">
          <div className="section-title"><CheckCircle size={15} color="#0F6E56"/> Cargos pagados</div>
          <div className="charges-list">
            {paid.map(c => (
              <div key={c.id} className="charge-item paid">
                <div className="charge-left">
                  <div className="charge-top">
                    <span className={`type-badge ${c.target === 'TUTOR' ? 'blue' : 'purple'}`}>
                      {TYPE_LABELS[c.type] || c.type}
                    </span>
                    <span className="sbadge green">Pagado</span>
                  </div>
                  <div className="charge-title">{c.title}</div>
                  {c.student && <div className="charge-student">Estudiante: {c.student.lastName} {c.student.firstName}</div>}
                  <div className="charge-meta"><span>{c.academicYear.year}</span></div>
                  {/* Pagos realizados */}
                  {c.payments.length > 0 && (
                    <div className="payments-list">
                      {c.payments.map(p => (
                        <div key={p.id} className="payment-item">
                          <span className="pay-method">{METHOD_LABELS[p.method] || p.method}</span>
                          <span className="pay-amount">{fmt(p.amount)}</span>
                          <span className="pay-date">{fmtDate(p.date)}</span>
                          {p.reference && <span className="pay-ref">Ref: {p.reference}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="charge-right">
                  <div className="amount-total paid-total">{fmt(c.amount)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {charges.length === 0 && (
        <div className="empty-card">
          <DollarSign size={40} color="#DCEEE6"/>
          <p>No hay cargos registrados para este tutor</p>
          <button className="btn-primary" onClick={() => router.push(`/dashboard/admin/tesoreria/nuevo-cargo?parentId=${parentId}`)}>
            <Plus size={14}/> Crear primer cargo
          </button>
        </div>
      )}

      {/* Modal registrar pago */}
      {showPayModal && selectedCharge && (
        <div className="overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>Registrar Pago</h2>
              <button onClick={() => setShowPayModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              {error && <div className="alert err">{error}</div>}
              <div className="info-box">
                <strong>{selectedCharge.title}</strong><br/>
                Saldo pendiente: <strong style={{color:'#C0392B'}}>{fmt(selectedCharge.amount - selectedCharge.paidAmount)}</strong>
              </div>
              <div className="fg">
                <label>Monto a pagar (Bs.) *</label>
                <input type="number" step="0.01" min="0.01"
                  max={selectedCharge.amount - selectedCharge.paidAmount}
                  value={payForm.amount}
                  onChange={e => setPayForm({...payForm, amount: e.target.value})}/>
              </div>
              <div className="fg">
                <label>Método de pago *</label>
                <select value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="DEPOSITO_BANCARIO">Depósito Bancario</option>
                  <option value="QR">QR</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div className="fg">
                <label>N° de comprobante / referencia</label>
                <input type="text" placeholder="Opcional" value={payForm.reference}
                  onChange={e => setPayForm({...payForm, reference: e.target.value})}/>
              </div>
              <div className="fg">
                <label>Nota adicional</label>
                <input type="text" placeholder="Opcional" value={payForm.note}
                  onChange={e => setPayForm({...payForm, note: e.target.value})}/>
              </div>
            </div>
            <div className="mfoot">
              <button className="btn-outline" onClick={() => setShowPayModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handlePay} disabled={saving}>
                {saving ? <span className="spinsm"/> : <CreditCard size={14}/>}
                {saving ? 'Registrando...' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8F7F}
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px;flex-wrap:wrap}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8F7F;font-size:13px;padding:0}
        .back-btn:hover{color:#0A5A45}
        .tutor-header{display:flex;align-items:center;gap:14px;flex:1}
        .avatar{width:52px;height:52px;border-radius:50%;background:#0A5A45;color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0}
        .tutor-header h1{font-size:20px;font-weight:800;color:#0A5A45;margin-bottom:4px}
        .tutor-meta{display:flex;gap:12px;font-size:12px;color:#6B8F7F;margin-bottom:6px}
        .students-list{display:flex;gap:6px;flex-wrap:wrap}
        .student-chip{font-size:11px;background:#E0ECF8;color:#0A5A45;padding:2px 8px;border-radius:20px}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
        .sum-card{background:#fff;border:1px solid #DCEEE6;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .sum-label{font-size:11px;color:#6B8F7F;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .sum-value{font-size:18px;font-weight:700;color:#0A5A45}
        .section-card{background:#fff;border:1px solid #DCEEE6;border-radius:12px;overflow:hidden;margin-bottom:16px}
        .section-title{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid #F5FAF7;font-size:13px;font-weight:700;color:#0A5A45}
        .charges-list{display:flex;flex-direction:column}
        .charge-item{display:flex;justify-content:space-between;align-items:flex-start;padding:16px 18px;border-bottom:1px solid #F5FAF7;gap:16px}
        .charge-item.paid{background:#FAFCFF}
        .charge-item:last-child{border-bottom:none}
        .charge-left{flex:1;display:flex;flex-direction:column;gap:6px}
        .charge-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .type-badge{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
        .type-badge.blue{background:#E0ECF8;color:#0A5A45}
        .type-badge.purple{background:#EEE8FD;color:#3C3489}
        .tolerance-badge{background:#FFFBEA;color:#7A6000;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500}
        .charge-title{font-size:14px;font-weight:600;color:#0A5A45}
        .charge-student{font-size:12px;color:#4A9FD4}
        .charge-desc{font-size:12px;color:#6B8F7F}
        .charge-tolerance{font-size:11px;color:#7A6000;background:#FFFBEA;border-radius:6px;padding:4px 8px}
        .charge-meta{display:flex;align-items:center;gap:10px;font-size:11px;color:#6B8F7F}
        .payments-list{display:flex;flex-direction:column;gap:4px;margin-top:4px}
        .payment-item{display:flex;align-items:center;gap:8px;background:#F5FAF7;border-radius:6px;padding:6px 10px;font-size:11px}
        .pay-method{background:#E0ECF8;color:#0A5A45;padding:1px 6px;border-radius:10px;font-weight:500}
        .pay-amount{font-weight:600;color:#0F6E56}
        .pay-date{color:#6B8F7F}
        .pay-ref{color:#6B8F7F;font-style:italic}
        .charge-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:140px}
        .charge-amount{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
        .amount-total{font-size:16px;font-weight:700;color:#0A5A45}
        .amount-paid{font-size:11px;color:#0F6E56}
        .amount-pending{font-size:12px;font-weight:600;color:#C0392B}
        .paid-total{color:#0F6E56}
        .btn-pay{display:flex;align-items:center;gap:5px;padding:7px 12px;background:#0F6E56;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap}
        .btn-pay:hover{background:#0A5040}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.green{background:#E1F5EE;color:#0F6E56}
        .sbadge.red{background:#FFF0F0;color:#C0392B}
        .sbadge.yellow{background:#FFFBEA;color:#7A6000}
        .sbadge.gray{background:#F5FAF7;color:#6B8F7F}
        .empty-card{background:#fff;border:1px solid #DCEEE6;border-radius:12px;padding:48px;display:flex;flex-direction:column;align-items:center;gap:12px;color:#6B8F7F;font-size:13px}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #DCEEE6}
        .mhead h2{font-size:16px;font-weight:600;color:#0A5A45}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8F7F;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F5FAF7;color:#0A5A45}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #DCEEE6}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#0A5A45;text-transform:uppercase;letter-spacing:.6px}
        .fg input,.fg select{padding:10px 12px;border:1.5px solid #DCEEE6;border-radius:8px;font-size:13px;color:#0A5A45;outline:none}
        .fg input:focus,.fg select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .info-box{background:#F5FAF7;border:1px solid #DCEEE6;border-radius:8px;padding:12px;font-size:13px;color:#6B8F7F;line-height:1.6}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#0A5A45;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#0A5A45;border:1.5px solid #DCEEE6;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F5FAF7}
        .spinner{width:24px;height:24px;border:2px solid rgba(10,90,69,.2);border-top-color:#0A5A45;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.summary-grid{grid-template-columns:1fr}.charge-item{flex-direction:column}.charge-right{align-items:flex-start}}
      `}</style>
    </div>
  )
}