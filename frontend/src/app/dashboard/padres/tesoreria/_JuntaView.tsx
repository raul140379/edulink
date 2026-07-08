'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Users, AlertCircle, CheckCircle, Search, Plus, TrendingUp, Filter } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'


interface ParentBalance {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  students:  { student: { id: number; firstName: string; lastName: string } }[]
  summary: {
    totalDebt:    number
    totalPaid:    number
    totalPending: number
    hasDebt:      boolean
    chargesCount: number
  }
}

interface Summary {
  totalCharged:   number
  totalCollected: number
  totalPending:   number
  byStatus: {
    PENDIENTE: number
    PARCIAL:   number
    PAGADO:    number
  }
}

export default function TesoreriaPage() {
  const router = useRouter()
  const [parents,  setParents]  = useState<ParentBalance[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('')
  const [error,    setError]    = useState('')
  const userRole = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').role : ''
  const canEdit  = userRole === 'SUPER_ADMIN' || userRole === 'JUNTA_ESCOLAR'
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filter) params.set('status', filter)

      const [pRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/treasury/parents?${params}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/treasury/summary`,           { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [pData, sData] = await Promise.all([pRes.json(), sRes.json()])
      if (pRes.ok) setParents(pData)
      if (sRes.ok) setSummary(sData)
    } catch { setError('Error de conexión') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

  const deudores    = parents.filter(p => p.summary.hasDebt).length
  const alDia       = parents.filter(p => !p.summary.hasDebt && p.summary.chargesCount > 0).length
  const sinCargos   = parents.filter(p => p.summary.chargesCount === 0).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tesorería</h1>
          <p>Gestión económica de padres y tutores legales</p>
        </div>
       {canEdit && (
            <button className="btn-primary" onClick={() => router.push('/dashboard/padres/cargos/nuevo')}>
            <Plus size={16}/> Nuevo cargo
        </button>
        )}
      </div>

      {error && <div className="alert err">{error}</div>}

      {/* Tarjetas de resumen */}
      {summary && (
        <div className="summary-grid">
          <div className="sum-card blue">
            <div className="sum-icon"><DollarSign size={20}/></div>
            <div>
              <div className="sum-label">Total cobrado</div>
              <div className="sum-value">{fmt(summary.totalCharged)}</div>
            </div>
          </div>
          <div className="sum-card green">
            <div className="sum-icon"><CheckCircle size={20}/></div>
            <div>
              <div className="sum-label">Total recaudado</div>
              <div className="sum-value">{fmt(summary.totalCollected)}</div>
            </div>
          </div>
          <div className="sum-card red">
            <div className="sum-icon"><AlertCircle size={20}/></div>
            <div>
              <div className="sum-label">Total pendiente</div>
              <div className="sum-value">{fmt(summary.totalPending)}</div>
            </div>
          </div>
          <div className="sum-card gray">
            <div className="sum-icon"><Users size={20}/></div>
            <div>
              <div className="sum-label">Tutores con deuda</div>
              <div className="sum-value">{deudores} de {parents.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Mini stats por estado */}
      {summary && (
        <div className="status-row">
          <div className="status-pill red">
            <AlertCircle size={13}/> {summary.byStatus.PENDIENTE} pendientes
          </div>
          <div className="status-pill yellow">
            <TrendingUp size={13}/> {summary.byStatus.PARCIAL} parciales
          </div>
          <div className="status-pill green">
            <CheckCircle size={13}/> {summary.byStatus.PAGADO} pagados
          </div>
          <div className="status-pill gray">
            <Users size={13}/> {sinCargos} sin cargos
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={14} className="sicon"/>
          <input placeholder="Buscar tutor por nombre o CI..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData()}/>
        </div>
        <div className="filter-wrap">
          <Filter size={14} color="#6B8BB0"/>
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">Todos los tutores</option>
            <option value="CON_DEUDA">Con deuda</option>
            <option value="AL_DIA">Al día</option>
          </select>
        </div>
        <button className="btn-outline" onClick={fetchData}>Buscar</button>
      </div>

      {/* Tabla de tutores */}
      <div className="table-card">
        {loading ? (
          <div className="center-state"><div className="spinner"/><p>Cargando...</p></div>
        ) : parents.length === 0 ? (
          <div className="center-state"><p>No se encontraron tutores</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tutor legal</th>
                <th>Estudiantes</th>
                <th>Total cargado</th>
                <th>Pagado</th>
                <th>Pendiente</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p, i) => (
                <tr key={p.id}>
                  <td className="muted">{i + 1}</td>
                  <td>
                    <div className="tname">{p.lastName} {p.firstName}</div>
                    {p.ci && <div className="tsub">CI: {p.ci}</div>}
                    {p.phone && <div className="tsub">{p.phone}</div>}
                  </td>
                  <td>
                    <div className="students-chips">
                      {p.students.length === 0
                        ? <span className="no-students">Sin estudiantes</span>
                        : p.students.map(ps => (
                            <span key={ps.student.id} className="student-chip">
                              {ps.student.lastName} {ps.student.firstName}
                            </span>
                          ))
                      }
                    </div>
                  </td>
                  <td className="amount">{fmt(p.summary.totalDebt)}</td>
                  <td className="amount green">{fmt(p.summary.totalPaid)}</td>
                  <td className={`amount ${p.summary.totalPending > 0 ? 'red' : 'green'}`}>
                    {fmt(p.summary.totalPending)}
                  </td>
                  <td>
                    {p.summary.chargesCount === 0
                      ? <span className="sbadge gray">Sin cargos</span>
                      : p.summary.hasDebt
                      ? <span className="sbadge red">Con deuda</span>
                      : <span className="sbadge green">Al día</span>
                    }
                  </td>
                  <td>
                    <button className="btn-ver" onClick={() => router.push(`/dashboard/padres/tesoreria/${p.id}`)}>
                      Ver cuenta
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="tfooter">
        Total: <strong>{parents.length}</strong> tutores · <strong>{deudores}</strong> con deuda · <strong>{alDia}</strong> al día
      </div>

      <style>{`
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px}
        .page-header h1{font-size:20px;font-weight:700;color:#1A3A7C;margin-bottom:4px}
        .page-header p{font-size:13px;color:#6B8BB0}
        .alert{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:16px;background:#FFF0F0;border:1px solid #FFBBBB;color:#C0392B}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px}
        .sum-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px}
        .sum-card.blue .sum-icon{background:#E0ECF8;color:#1A3A7C;padding:10px;border-radius:10px}
        .sum-card.green .sum-icon{background:#E1F5EE;color:#0F6E56;padding:10px;border-radius:10px}
        .sum-card.red .sum-icon{background:#FFF0F0;color:#C0392B;padding:10px;border-radius:10px}
        .sum-card.gray .sum-icon{background:#F0F6FC;color:#6B8BB0;padding:10px;border-radius:10px}
        .sum-label{font-size:11px;color:#6B8BB0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .sum-value{font-size:18px;font-weight:700;color:#1A3A7C}
        .status-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
        .status-pill{display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:500}
        .status-pill.red{background:#FFF0F0;color:#C0392B}
        .status-pill.yellow{background:#FFFBEA;color:#7A6000}
        .status-pill.green{background:#E1F5EE;color:#0F6E56}
        .status-pill.gray{background:#F0F6FC;color:#6B8BB0}
        .filters-bar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
        .search-wrap{position:relative;flex:1;min-width:200px}
        .sicon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#4A9FD4;pointer-events:none}
        .search-wrap input{width:100%;padding:9px 12px 9px 34px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;outline:none;color:#1A3A7C}
        .search-wrap input:focus{border-color:#4A9FD4}
        .filter-wrap{display:flex;align-items:center;gap:6px}
        .filter-wrap select{padding:9px 12px;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;outline:none;color:#1A3A7C;cursor:pointer}
        .btn-primary{display:flex;align-items:center;gap:6px;padding:9px 16px;background:#1A3A7C;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .btn-primary:hover{background:#4A9FD4}
        .btn-outline{display:flex;align-items:center;gap:6px;padding:9px 14px;background:#fff;color:#1A3A7C;border:1.5px solid #CBE0F0;border-radius:8px;font-size:13px;cursor:pointer}
        .btn-outline:hover{background:#F0F6FC}
        .table-card{background:#fff;border:1px solid #CBE0F0;border-radius:12px;overflow:hidden}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F0F6FC}
        th{padding:11px 14px;text-align:left;font-size:11px;font-weight:600;color:#1A3A7C;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
        td{padding:11px 14px;font-size:13px;color:#1A3A7C;border-top:1px solid #F0F6FC;vertical-align:top}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8BB0;font-size:12px}
        .tname{font-weight:500;color:#1A3A7C}
        .tsub{font-size:11px;color:#6B8BB0;margin-top:2px}
        .students-chips{display:flex;flex-direction:column;gap:3px}
        .student-chip{font-size:11px;background:#E0ECF8;color:#1A3A7C;padding:2px 8px;border-radius:20px;display:inline-block}
        .no-students{font-size:11px;color:#6B8BB0;font-style:italic}
        .amount{font-weight:600;font-size:13px;white-space:nowrap}
        .amount.green{color:#0F6E56}
        .amount.red{color:#C0392B}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.green{background:#E1F5EE;color:#0F6E56}
        .sbadge.red{background:#FFF0F0;color:#C0392B}
        .sbadge.gray{background:#F0F6FC;color:#6B8BB0}
        .btn-ver{padding:6px 12px;background:#1A3A7C;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap}
        .btn-ver:hover{background:#4A9FD4}
        .tfooter{padding:10px 14px;font-size:12px;color:#6B8BB0}
        .center-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px;gap:12px;color:#6B8BB0;font-size:13px}
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:768px){.page-header{flex-direction:column}.summary-grid{grid-template-columns:1fr 1fr}}
      `}</style>
    </div>
  )
}