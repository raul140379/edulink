'use client'

import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface GateRecord {
  id: number; type: string; action: string; createdAt: string
  teacher?:     { firstName: string; lastName: string; specialty?: string }
  visitorName?: string; visitorCI?: string; reason?: string; destination?: string; note?: string
}

interface Summary {
  total: number; totalMaestros: number; totalVisitantes: number
  entradas: number; salidas: number
}

export default function ReporteAccesosPage() {
  const [records,  setRecords]  = useState<GateRecord[]>([])
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [date,     setDate]     = useState(() => new Date().toISOString().split('T')[0])
  const [type,     setType]     = useState('')
  const [action,   setAction]   = useState('')

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const loadRecords = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (date)   params.set('date',   date)
      if (type)   params.set('type',   type)
      if (action) params.set('action', action)

      const res  = await fetch(`${API}/api/gate/records?${params}`, { headers: auth() })
      const data = await res.json()
      if (res.ok) { setRecords(data.records); setSummary(data.summary) }
    } catch { console.error('Error cargando registros') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadRecords() }, [date, type, action])

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:20,fontWeight:700,color:'#0A5A45',marginBottom:4}}>Reporte de Accesos</h1>
        <p style={{fontSize:13,color:'#6B8F7F'}}>Historial de entradas y salidas registradas por el portero</p>
      </div>

      {/* Filtros */}
      <div style={{background:'#fff',border:'1px solid #DCEEE6',borderRadius:12,padding:'14px 18px',marginBottom:20,display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          <label style={{fontSize:11,fontWeight:600,color:'#0A5A45',textTransform:'uppercase',letterSpacing:'.5px'}}>Fecha</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{padding:'8px 12px',border:'1.5px solid #DCEEE6',borderRadius:8,fontSize:13,color:'#0A5A45',outline:'none'}}/>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          <label style={{fontSize:11,fontWeight:600,color:'#0A5A45',textTransform:'uppercase',letterSpacing:'.5px'}}>Tipo</label>
          <select value={type} onChange={e=>setType(e.target.value)}
            style={{padding:'8px 12px',border:'1.5px solid #DCEEE6',borderRadius:8,fontSize:13,color:'#0A5A45',outline:'none'}}>
            <option value="">Todos</option>
            <option value="MAESTRO">Maestros</option>
            <option value="VISITANTE">Visitantes</option>
          </select>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          <label style={{fontSize:11,fontWeight:600,color:'#0A5A45',textTransform:'uppercase',letterSpacing:'.5px'}}>Acción</label>
          <select value={action} onChange={e=>setAction(e.target.value)}
            style={{padding:'8px 12px',border:'1.5px solid #DCEEE6',borderRadius:8,fontSize:13,color:'#0A5A45',outline:'none'}}>
            <option value="">Todas</option>
            <option value="ENTRADA">Entradas</option>
            <option value="SALIDA">Salidas</option>
          </select>
        </div>
        <button onClick={loadRecords} style={{
          marginTop:18,padding:'8px 16px',background:'#0A5A45',color:'#fff',
          border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontWeight:600
        }}>
          🔄 Actualizar
        </button>
      </div>

      {/* Resumen */}
      {summary && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:20}}>
          {[
            {label:'Total registros', value:summary.total,          color:'#0A5A45', bg:'#E0ECF8'},
            {label:'Maestros',        value:summary.totalMaestros,  color:'#633806', bg:'#FDF0E6'},
            {label:'Visitantes',      value:summary.totalVisitantes,color:'#0F6E56', bg:'#E1F5EE'},
            {label:'Entradas',        value:summary.entradas,       color:'#0F6E56', bg:'#E1F5EE'},
            {label:'Salidas',         value:summary.salidas,        color:'#C0392B', bg:'#FFF0F0'},
          ].map(s=>(
            <div key={s.label} style={{background:s.bg,borderRadius:10,padding:'12px 16px',border:`1px solid ${s.color}22`}}>
              <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.value}</div>
              <div style={{fontSize:11,color:s.color,fontWeight:600,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div style={{background:'#fff',border:'1px solid #DCEEE6',borderRadius:12,overflow:'hidden'}}>
        {loading ? (
          <div style={{display:'flex',justifyContent:'center',padding:48}}><div className="spinner"/></div>
        ) : records.length === 0 ? (
          <div style={{padding:48,textAlign:'center',color:'#6B8F7F'}}>
            <div style={{fontSize:40,marginBottom:12}}>📋</div>
            <p>No hay registros para esta fecha.</p>
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#F5FAF7'}}>
                <th style={th}>Hora</th>
                <th style={th}>Tipo</th>
                <th style={th}>Persona</th>
                <th style={th}>Acción</th>
                <th style={th}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} style={{borderTop:'1px solid #F5FAF7'}}>
                  <td style={{...td,fontWeight:700,color:'#0A5A45',whiteSpace:'nowrap'}}>
                    {formatTime(r.createdAt)}
                  </td>
                  <td style={td}>
                    <span style={{
                      padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,
                      background:r.type==='MAESTRO'?'#E0ECF8':'#E1F5EE',
                      color:r.type==='MAESTRO'?'#0A5A45':'#0F6E56',
                    }}>
                      {r.type==='MAESTRO'?'👨‍🏫 Maestro':'🧑‍💼 Visitante'}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{fontWeight:600,fontSize:13,color:'#0A5A45'}}>
                      {r.teacher ? `${r.teacher.lastName} ${r.teacher.firstName}` : r.visitorName}
                    </div>
                    {r.teacher?.specialty && (
                      <div style={{fontSize:11,color:'#6B8F7F'}}>{r.teacher.specialty}</div>
                    )}
                    {r.visitorCI && (
                      <div style={{fontSize:11,color:'#6B8F7F'}}>CI: {r.visitorCI}</div>
                    )}
                  </td>
                  <td style={td}>
                    <span style={{
                      padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
                      background:r.action==='ENTRADA'?'#0F6E56':'#C0392B',
                      color:'#fff',
                    }}>
                      {r.action==='ENTRADA'?'🟢':'🔴'} {r.action}
                    </span>
                  </td>
                  <td style={{...td,fontSize:12,color:'#6B8F7F'}}>
                    {r.reason      && <div>Motivo: {r.reason}</div>}
                    {r.destination && <div>Destino: {r.destination}</div>}
                    {r.note        && <div>Nota: {r.note}</div>}
                    {!r.reason && !r.destination && !r.note && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(10,90,69,.2);border-top-color:#0A5A45;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

const th: React.CSSProperties = {
  padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,
  color:'#0A5A45',textTransform:'uppercase',letterSpacing:'.5px'
}
const td: React.CSSProperties = {
  padding:'10px 14px',fontSize:13,color:'#0A5A45',verticalAlign:'middle'
}