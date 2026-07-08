'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, DollarSign, AlertCircle, CheckCircle, CreditCard, X, Users } from 'lucide-react'

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
  createdAt:   string
  student?:    { firstName: string; lastName: string }
  academicYear: { year: number }
  payments:    Payment[]
}

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  charges:   Charge[]
  summary:   { totalDebt: number; totalPaid: number; totalPending: number }
}

interface Course {
  id:          number
  level:       string
  grade:       string
  parallel:    string
  shift:       string
  assignments: {
    student: {
      parents: {
        isTutor:     boolean
        relationType: string
        parent:      Parent
      }[]
    }
  }[]
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
  EFECTIVO:          'Efectivo',
  DEPOSITO_BANCARIO: 'Depósito',
  QR:                'QR',
  TRANSFERENCIA:     'Transferencia',
  OTRO:              'Otro',
}

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

const fmt     = (n: number) => `Bs. ${n.toFixed(2)}`
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

export default function DelegateTesoreriaPage() {
  const router  = useRouter()
  const [course,         setCourse]         = useState<Course | null>(null)
  const [parents,        setParents]        = useState<Parent[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [success,        setSuccess]        = useState('')
  const [showPayModal,   setShowPayModal]   = useState(false)
  const [selectedCharge, setSelectedCharge] = useState<Charge | null>(null)
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [payForm,        setPayForm]        = useState({ amount: '', method: 'EFECTIVO', reference: '', note: '' })
  const [search,         setSearch]         = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }
    else                    { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/delegates/my-course`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!res.ok) { setError(data.message); return }
        setCourse(data)

        // Extraer tutores legales únicos
        const parentMap = new Map<number, any>()
        for (const a of data.assignments) {
          for (const ps of a.student.parents) {
            if (ps.isTutor && !parentMap.has(ps.parent.id)) {
              parentMap.set(ps.parent.id, ps.parent)
            }
          }
        }

        // Obtener estado de cuenta de cada tutor
        const tutorIds = Array.from(parentMap.keys())
        const parentsWithAccount = await Promise.all(
          tutorIds.map(async (parentId) => {
            const r = await fetch(`${API_URL}/api/treasury/parents/${parentId}/account`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            const d = await r.json()
            if (r.ok) return d
            return null
          })
        )

        setParents(parentsWithAccount.filter(Boolean).map((p: any) => ({
          ...p.parent,
          charges: p.charges,
          summary: p.summary,
        })))

      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [])

  const openPayModal = (charge: Charge, parent: Parent) => {
    setSelectedCharge(charge)
    setSelectedParent(parent)
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
      // Recargar
      window.location.reload()
    } catch { notify('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const filtered = search
    ? parents.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (p.ci && p.ci.includes(search))
      )
    : parents

  const totalDebt    = parents.reduce((sum, p) => sum + p.summary.totalDebt, 0)
  const totalPaid    = parents.reduce((sum, p) => sum + p.summary.totalPaid, 0)
  const totalPending = parents.reduce((sum, p) => sum + p.summary.totalPending, 0)
  const withDebt     = parents.filter(p => p.summary.totalPending > 0).length

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err">{error}</p></div>

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div>
          <h1>Estado de Cuentas</h1>
          {course && <p>{LEVEL_LABELS[course.level]} — {GRADE_LABELS[course.grade]} {course.parallel}</p>}
        </div>
      </div>

      {success && <div className="alert suc">{success}</div>}
      {error   && <div className="alert err">{error}</div>}

      {/* Resumen */}
      <div className="summary-grid">
        <div className="sum-card"><div className="sum-icon blue"><DollarSign size={18}/></div>
          <div><div className="sum-label">Total cargado</div><div className="sum-value">{fmt(totalDebt)}</div></div>
        </div>
        <div className="sum-card"><div className="sum-icon green"><CheckCircle size={18}/></div>
          <div><div className="sum-label">Recaudado</div><div className="sum-value">{fmt(totalPaid)}</div></div>
        </div>
        <div className="sum-card"><div className="sum-icon red"><AlertCircle size={18}/></div>
          <div><div className="sum-label">Pendiente</div><div className="sum-value">{fmt(totalPending)}</div></div>
        </div>
        <div className="sum-card"><div className="sum-icon gray"><Users size={18}/></div>
          <div><div className="sum-label">Con deuda</div><div className="sum-value">{withDebt} de {parents.length}</div></div>
        </div>
      </div>

      {/* Buscador */}
      <div className="search-bar">
        <input placeholder="Buscar tutor por nombre o CI..."
          value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* Lista de tutores */}
      {filtered.map(parent => (
        <div key={parent.id} className="parent-card">
          <div className="parent-header">
            <div>
              <div className="parent-name">{parent.lastName} {parent.firstName}</div>
              <div className="parent-meta">
                {parent.ci    && <span>CI: {parent.ci}</span>}
                {parent.phone && <span>📱 {parent.phone}</span>}
              </div>
            </div>
            <div className="parent-summary">
              <div className={`balance ${parent.summary.totalPending > 0 ? 'red' : 'green'}`}>
                {parent.summary.totalPending > 0 ? `Debe: ${fmt(parent.summary.totalPending)}` : '✅ Al día'}
              </div>
            </div>
          </div>

          {parent.charges.filter(c => c.status !== 'ANULADO').length > 0 && (
            <div className="charges-list">
              {parent.charges.filter(c => c.status !== 'ANULADO').map(c => (
                <div key={c.id} className="charge-item">
                  <div className="charge-info">
                    <span className="charge-type">{TYPE_LABELS[c.type] || c.type}</span>
                    <span className="charge-title">{c.title}</span>
                    {c.student && <span className="charge-student">Estudiante: {c.student.lastName} {c.student.firstName}</span>}
                    {c.payments.length > 0 && (
                      <div className="payments">
                        {c.payments.map(p => (
                          <span key={p.id} className="payment-pill">
                            {METHOD_LABELS[p.method]} {fmt(p.amount)} — {fmtDate(p.date)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="charge-amounts">
                    <div className="amount-total">{fmt(c.amount)}</div>
                    <div className="amount-paid">Pagado: {fmt(c.paidAmount)}</div>
                    {(c.status === 'PENDIENTE' || c.status === 'PARCIAL') && (
                      <>
                        <div className="amount-pending">Pendiente: {fmt(c.amount - c.paidAmount)}</div>
                        <button className="btn-pay" onClick={() => openPayModal(c, parent)}>
                          <CreditCard size={12}/> Pago
                        </button>
                      </>
                    )}
                    {c.status === 'PAGADO' && <span className="badge-paid">✅ Pagado</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="center"><p>No se encontraron tutores</p></div>
      )}

      {/* Modal pago */}
      {showPayModal && selectedCharge && (
        <div className="overlay" onClick={() => setShowPayModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead">
              <h2>Registrar Pago</h2>
              <button onClick={() => setShowPayModal(false)}><X size={18}/></button>
            </div>
            <div className="mbody">
              <div className="info-box">
                <strong>{selectedCharge.title}</strong><br/>
                Tutor: {selectedParent?.lastName} {selectedParent?.firstName}<br/>
                Pendiente: <strong style={{color:'#C0392B'}}>{fmt(selectedCharge.amount - selectedCharge.paidAmount)}</strong>
              </div>
              <div className="fg"><label>Monto (Bs.) *</label>
                <input type="number" step="0.01" min="0.01"
                  max={selectedCharge.amount - selectedCharge.paidAmount}
                  value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})}/></div>
              <div className="fg"><label>Método *</label>
                <select value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="DEPOSITO_BANCARIO">Depósito Bancario</option>
                  <option value="QR">QR</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="OTRO">Otro</option>
                </select></div>
              <div className="fg"><label>Referencia</label>
                <input type="text" placeholder="Opcional" value={payForm.reference}
                  onChange={e => setPayForm({...payForm, reference: e.target.value})}/></div>
              <div className="fg"><label>Nota</label>
                <input type="text" placeholder="Opcional" value={payForm.note}
                  onChange={e => setPayForm({...payForm, note: e.target.value})}/></div>
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
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .err{color:#C0392B}
        .page-header{display:flex;align-items:center;gap:16px;margin-bottom:24px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:0}
        .back-btn:hover{color:#1A3A7C}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px}
        .alert.suc{background:#E1F5EE;border:1px solid #9FE1CB;color:#0F6E56}
        .alert.err{background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:14px;display:flex;align-items:center;gap:10px}
        .sum-icon{padding:8px;border-radius:8px;display:flex;align-items:center}
        .sum-icon.blue{background:#E0ECF8;color:#1A3A7C}
        .sum-icon.green{background:#E1F5EE;color:#0F6E56}
        .sum-icon.red{background:#FFF0F0;color:#C0392B}
        .sum-icon.gray{background:#F0F6FC;color:#6B8BB0}
        .sum-label{font-size:10px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
        .sum-value{font-size:16px;font-weight:700;color:#1A3A7C}
        .search-bar{margin-bottom:16px}
        .search-bar input{width:100%;padding:10px 14px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;outline:none;color:#1A3A7C}
        .search-bar input:focus{border-color:#4A9FD4}
        .parent-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;margin-bottom:12px;overflow:hidden}
        .parent-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #F0F6FC;flex-wrap:wrap;gap:8px}
        .parent-name{font-size:15px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .parent-meta{display:flex;gap:12px;font-size:12px;color:#6B8BB0}
        .parent-summary{}
        .balance{font-size:13px;font-weight:600;padding:4px 12px;border-radius:20px}
        .balance.red{background:#FFF0F0;color:#C0392B}
        .balance.green{background:#E1F5EE;color:#0F6E56}
        .charges-list{display:flex;flex-direction:column}
        .charge-item{display:flex;align-items:flex-start;justify-content:space-between;padding:12px 18px;border-top:1px solid #F0F6FC;gap:12px}
        .charge-info{flex:1;display:flex;flex-direction:column;gap:3px}
        .charge-type{font-size:10px;font-weight:600;background:#E0ECF8;color:#1A3A7C;padding:1px 7px;border-radius:10px;width:fit-content;text-transform:uppercase}
        .charge-title{font-size:13px;font-weight:500;color:#1A3A7C}
        .charge-student{font-size:11px;color:#4A9FD4}
        .payments{display:flex;flex-direction:column;gap:3px;margin-top:4px}
        .payment-pill{font-size:11px;color:#0F6E56;background:#E1F5EE;padding:2px 8px;border-radius:10px;width:fit-content}
        .charge-amounts{display:flex;flex-direction:column;align-items:flex-end;gap:3px;min-width:120px}
        .amount-total{font-size:14px;font-weight:700;color:#1A3A7C}
        .amount-paid{font-size:11px;color:#0F6E56}
        .amount-pending{font-size:12px;font-weight:600;color:#C0392B}
        .badge-paid{font-size:11px;color:#0F6E56}
        .btn-pay{display:flex;align-items:center;gap:4px;padding:5px 10px;background:#0F6E56;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;margin-top:4px}
        .btn-pay:hover{background:#0A5040}
        .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
        .modal{background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
        .mhead{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #CBE0F0}
        .mhead h2{font-size:16px;font-weight:600;color:#1A3A7C}
        .mhead button{background:none;border:none;cursor:pointer;color:#6B8BB0;display:flex;padding:4px;border-radius:6px}
        .mhead button:hover{background:#F0F6FC;color:#1A3A7C}
        .mbody{padding:20px;display:flex;flex-direction:column;gap:14px}
        .mfoot{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid #CBE0F0}
        .fg{display:flex;flex-direction:column;gap:6px}
        .fg label{font-size:11px;font-weight:700;color:#1A3A7C;text-transform:uppercase;letter-spacing:.6px}
        .fg input,.fg select{padding:10px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;color:#1A3A7C;outline:none}
        .fg input:focus,.fg select:focus{border-color:#4A9FD4;box-shadow:0 0 0 3px rgba(74,159,212,.12)}
        .info-box{background:#F0F6FC;border:1px solid #CBE0F0;border-radius:8px;padding:12px;font-size:13px;color:#6B8BB0;line-height:1.6}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover:not(:disabled){background:#4A9FD4}
        .btn-primary:disabled{opacity:.6;cursor:not-allowed}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinsm{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.summary-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}