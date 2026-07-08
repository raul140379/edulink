'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, DollarSign, AlertCircle, CheckCircle, Users, MessageCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Charge {
  id:          number
  title:       string
  amount:      number
  paidAmount:  number
  type:        string
  status:      string
  dueDate?:    string
  academicYear: { year: number }
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

const TYPE_LABELS: Record<string, string> = {
  CUOTA_INICIAL: 'Cuota Inicial', DEUDA_ANTERIOR: 'Deuda Anterior',
  MULTA_ASAMBLEA: 'Multa Asamblea', MINGA: 'Minga', MULTA_REUNION: 'Multa Reunión',
  ACTIVIDAD: 'Actividad', MATERIAL_ESCOLAR: 'Material Escolar', OTRO: 'Otro',
}

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

export default function TeacherTesoreriaPage() {
  const router  = useRouter()
  const [parents,  setParents]  = useState<Parent[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/teachers/my-course`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!res.ok) { setError(data.message); return }

        // Extraer tutores únicos con sus cargos
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
            if (r.ok) return { ...d.parent, charges: d.charges, summary: d.summary }
            return null
          })
        )
        setParents(parentsWithAccount.filter(Boolean))
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [])

  const filtered = search
    ? parents.filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (p.ci && p.ci.includes(search))
      )
    : parents

  const totalDebt    = parents.reduce((s, p) => s + p.summary.totalDebt, 0)
  const totalPaid    = parents.reduce((s, p) => s + p.summary.totalPaid, 0)
  const totalPending = parents.reduce((s, p) => s + p.summary.totalPending, 0)
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
          <p>Vista de solo lectura — gestiona pagos desde el panel de Junta Escolar</p>
        </div>
      </div>

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

      {/* Lista */}
      {filtered.map(parent => (
        <div key={parent.id} className="parent-card">
          <div className="parent-header">
            <div>
              <div className="parent-name">{parent.lastName} {parent.firstName}</div>
              <div className="parent-meta">
                {parent.ci    && <span>CI: {parent.ci}</span>}
                {parent.phone && (
                  <a href={`https://wa.me/591${parent.phone.replace(/\D/g,'')}?text=Estimado tutor, le contactamos de la U.E. Naciones Unidas.`}
                    target="_blank" rel="noreferrer" className="wa-btn">
                    <MessageCircle size={11}/> {parent.phone}
                  </a>
                )}
              </div>
            </div>
            <div className={`balance ${parent.summary.totalPending > 0 ? 'red' : 'green'}`}>
              {parent.summary.totalPending > 0 ? `Debe: ${fmt(parent.summary.totalPending)}` : '✅ Al día'}
            </div>
          </div>

          {parent.charges.filter(c => c.status !== 'ANULADO').length > 0 && (
            <div className="charges-list">
              {parent.charges.filter(c => c.status !== 'ANULADO').map(c => (
                <div key={c.id} className="charge-item">
                  <div className="charge-info">
                    <span className="charge-type">{TYPE_LABELS[c.type] || c.type}</span>
                    <span className="charge-title">{c.title}</span>
                    <span className="charge-year">{c.academicYear.year}</span>
                  </div>
                  <div className="charge-amounts">
                    <span className="amount-total">{fmt(c.amount)}</span>
                    <span className={`status-badge ${c.status.toLowerCase()}`}>{c.status}</span>
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

      <div className="readonly-notice">
        🔒 Vista de solo lectura. Para registrar pagos, contacta a la Junta Escolar.
      </div>

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px;color:#6B8BB0}
        .err{color:#C0392B}
        .page-header{display:flex;align-items:center;gap:16px;margin-bottom:24px;flex-wrap:wrap}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .page-header p{font-size:12px;color:#6B8BB0}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8BB0;font-size:13px;padding:0}
        .back-btn:hover{color:#1A3A7C}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:14px;display:flex;align-items:center;gap:10px}
        .sum-icon{padding:8px;border-radius:8px;display:flex}
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
        .parent-meta{display:flex;align-items:center;gap:12px;font-size:12px;color:#6B8BB0;flex-wrap:wrap}
        .wa-btn{display:flex;align-items:center;gap:4px;background:#25D366;color:#fff;padding:3px 8px;border-radius:10px;font-size:11px;text-decoration:none}
        .wa-btn:hover{background:#1DA851}
        .balance{font-size:13px;font-weight:600;padding:4px 12px;border-radius:20px}
        .balance.red{background:#FFF0F0;color:#C0392B}
        .balance.green{background:#E1F5EE;color:#0F6E56}
        .charges-list{display:flex;flex-direction:column}
        .charge-item{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-top:1px solid #F0F6FC;gap:12px}
        .charge-info{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1}
        .charge-type{font-size:10px;font-weight:600;background:#E0ECF8;color:#1A3A7C;padding:1px 7px;border-radius:10px;text-transform:uppercase}
        .charge-title{font-size:13px;font-weight:500;color:#1A3A7C}
        .charge-year{font-size:11px;color:#6B8BB0}
        .charge-amounts{display:flex;align-items:center;gap:8px}
        .amount-total{font-size:13px;font-weight:700;color:#1A3A7C}
        .status-badge{font-size:10px;font-weight:500;padding:2px 7px;border-radius:10px}
        .status-badge.pendiente{background:#FFF0F0;color:#C0392B}
        .status-badge.parcial{background:#FFFBEA;color:#7A6000}
        .status-badge.pagado{background:#E1F5EE;color:#0F6E56}
        .readonly-notice{text-align:center;font-size:12px;color:#6B8BB0;padding:16px;background:#F8FBFF;border:1px solid #CBE0F0;border-radius:8px;margin-top:8px}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.summary-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}