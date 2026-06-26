'use client'

import { useEffect, useState, useRef } from 'react'
import { RefreshCw, Download, Search } from 'lucide-react'
import QRCode from 'qrcode'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface PersonCode {
  id: number
  firstName: string
  lastName: string
  ci?: string
  attendanceCode?: string
  staffRole?: string
  specialty?: string
  type: 'MAESTRO' | 'STAFF'
}

export default function CodigosPage() {
  const [teachers,    setTeachers]    = useState<PersonCode[]>([])
  const [staff,       setStaff]       = useState<PersonCode[]>([])
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState<'ALL'|'MAESTRO'|'STAFF'>('ALL')
  const [selected,    setSelected]    = useState<PersonCode|null>(null)
  const [qrDataUrl,   setQrDataUrl]   = useState<string>('')
  const [success,     setSuccess]     = useState('')
  const [error,       setError]       = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const notify = (msg: string, type: 'ok'|'err' = 'ok') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
    else               { setError(msg);   setTimeout(() => setError(''),   4000) }
  }

  const loadCodes = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/gate/attendance-codes`, { headers: auth() })
      const data = await res.json()
      if (!res.ok) { notify('Error al cargar códigos', 'err'); return }
      setTeachers(data.teachers.map((t: any) => ({ ...t, type: 'MAESTRO' })))
      setStaff(data.staff.map((s: any) => ({ ...s, type: 'STAFF' })))
    } catch { notify('Error de conexión', 'err') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadCodes() }, [])

  // Generar QR al seleccionar persona
  useEffect(() => {
    if (selected?.attendanceCode) {
      QRCode.toDataURL(selected.attendanceCode, {
        width: 300, margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      }).then(setQrDataUrl).catch(() => setQrDataUrl(''))
    } else {
      setQrDataUrl('')
    }
  }, [selected])

  // Generar códigos masivo
  const handleGenerateAll = async () => {
    if (!confirm('¿Generar códigos para todos los que no tienen? Los existentes no se modifican.')) return
    setGenerating(true)
    try {
      const res  = await fetch(`${API}/api/gate/generate-codes`, {
        method: 'POST', headers: auth()
      })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify(`✅ ${data.message}`)
      loadCodes()
    } catch { notify('Error de conexión', 'err') }
    finally { setGenerating(false) }
  }

  // Regenerar código individual
  const handleRegenerate = async (person: PersonCode) => {
    if (!confirm(`¿Regenerar código de ${person.firstName} ${person.lastName}? El código anterior dejará de funcionar.`)) return
    try {
      const endpoint = person.type === 'STAFF'
        ? `${API}/api/gate/regenerate-code/staff/${person.id}`
        : `${API}/api/gate/regenerate-code/teacher/${person.id}`
      const res  = await fetch(endpoint, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { notify(data.message, 'err'); return }
      notify(`✅ Código regenerado: ${data.attendanceCode}`)
      loadCodes()
      if (selected?.id === person.id && selected?.type === person.type) {
        setSelected({ ...person, attendanceCode: data.attendanceCode })
      }
    } catch { notify('Error de conexión', 'err') }
  }

  // Imprimir QR individual
  const handlePrint = () => {
    if (!selected || !qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>QR - ${selected.lastName} ${selected.firstName}</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px; }
        .card { border: 2px solid #1A3A7C; border-radius: 12px; padding: 24px; text-align: center; max-width: 280px; }
        .name { font-size: 16px; font-weight: 700; color: #1A3A7C; margin: 12px 0 4px; }
        .role { font-size: 12px; color: #6B8BB0; margin-bottom: 8px; }
        .code { font-size: 20px; font-weight: 800; letter-spacing: 4px; color: #0F172A; font-family: monospace; }
        .school { font-size: 11px; color: #94A3B8; margin-top: 12px; }
        img { width: 220px; height: 220px; }
      </style></head><body>
      <div class="card">
        <div class="school">U.E. Naciones Unidas — El Torno</div>
        <img src="${qrDataUrl}" alt="QR"/>
        <div class="name">${selected.lastName} ${selected.firstName}</div>
        <div class="role">${selected.type === 'STAFF' ? selected.staffRole : 'MAESTRO'}</div>
        <div class="code">${selected.attendanceCode}</div>
      </div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `)
    win.document.close()
  }

  // Imprimir todos
  const handlePrintAll = async () => {
    const all = [...teachers, ...staff].filter(p => p.attendanceCode)
    if (all.length === 0) { notify('No hay códigos generados', 'err'); return }

    const cards = await Promise.all(all.map(async p => {
      const url = await QRCode.toDataURL(p.attendanceCode!, {
        width: 200, margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      })
      return `
        <div class="card">
          <div class="school">U.E. Naciones Unidas</div>
          <img src="${url}" alt="QR"/>
          <div class="name">${p.lastName} ${p.firstName}</div>
          <div class="role">${p.type === 'STAFF' ? p.staffRole : 'MAESTRO'}</div>
          <div class="code">${p.attendanceCode}</div>
        </div>
      `
    }))

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>Códigos QR — SGJE</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 16px; color: #1A3A7C; text-align: center; margin-bottom: 20px; }
        .grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
        .card { border: 1.5px solid #1A3A7C; border-radius: 10px; padding: 14px; text-align: center; width: 180px; page-break-inside: avoid; }
        .name { font-size: 11px; font-weight: 700; color: #1A3A7C; margin: 8px 0 2px; }
        .role { font-size: 9px; color: #6B8BB0; margin-bottom: 4px; }
        .code { font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #0F172A; font-family: monospace; }
        .school { font-size: 9px; color: #94A3B8; }
        img { width: 150px; height: 150px; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <h1>Códigos QR de Asistencia — U.E. Naciones Unidas</h1>
      <div class="grid">${cards.join('')}</div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `)
    win.document.close()
  }

  // Filtrar lista
  const allPersons = [
    ...teachers.map(t => ({ ...t, type: 'MAESTRO' as const })),
    ...staff.map(s => ({ ...s, type: 'STAFF' as const }))
  ]
  const filtered = allPersons.filter(p => {
    const matchFilter = filter === 'ALL' || p.type === filter
    const matchSearch = search === '' ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      p.attendanceCode?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const withCode    = allPersons.filter(p => p.attendanceCode).length
  const withoutCode = allPersons.filter(p => !p.attendanceCode).length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A3A7C', marginBottom: 4 }}>Códigos QR de Asistencia</h1>
          <p style={{ fontSize: 13, color: '#6B8BB0' }}>Genera y distribuye los códigos de registro para maestros y personal</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handlePrintAll} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
            background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>
            <Download size={14} /> Imprimir todos
          </button>
          <button onClick={handleGenerateAll} disabled={generating} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
            background: '#1A3A7C', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: generating ? 0.6 : 1
          }}>
            <RefreshCw size={14} /> {generating ? 'Generando...' : 'Generar faltantes'}
          </button>
        </div>
      </div>

      {success && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14, background: '#E1F5EE', border: '1px solid #9FE1CB', color: '#0F6E56' }}>{success}</div>}
      {error   && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14, background: '#FFF0F0', border: '1px solid #FFBBBB', color: '#C0392B' }}>{error}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total personas', val: allPersons.length, color: '#1A3A7C', bg: '#E6F1FB' },
          { label: 'Con código QR',  val: withCode,          color: '#0F6E56', bg: '#E1F5EE' },
          { label: 'Sin código QR',  val: withoutCode,       color: '#C0392B', bg: '#FCEBEB' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 10, padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: s.color, opacity: 0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Lista */}
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6B8BB0' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código..."
                style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1.5px solid #CBE0F0', borderRadius: 8, fontSize: 13, color: '#1A3A7C', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {(['ALL', 'MAESTRO', 'STAFF'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filter === f ? '#1A3A7C' : '#F0F6FC',
                color: filter === f ? '#fff' : '#1A3A7C',
              }}>
                {f === 'ALL' ? 'Todos' : f === 'MAESTRO' ? 'Maestros' : 'Personal'}
              </button>
            ))}
          </div>

          {/* Tabla */}
          <div style={{ background: '#fff', border: '1px solid #CBE0F0', borderRadius: 12, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: '#6B8BB0' }}>Cargando...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F0F6FC' }}>
                    <th style={th}>Persona</th>
                    <th style={th}>Tipo</th>
                    <th style={th}>Código QR</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={`${p.type}-${p.id}`}
                      onClick={() => setSelected(p)}
                      style={{
                        borderTop: '1px solid #F0F6FC', cursor: 'pointer',
                        background: selected?.id === p.id && selected?.type === p.type ? '#E6F1FB' : 'transparent',
                      }}>
                      <td style={td}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3A7C' }}>
                          {p.lastName} {p.firstName}
                        </div>
                        {p.ci && <div style={{ fontSize: 11, color: '#6B8BB0' }}>CI: {p.ci}</div>}
                      </td>
                      <td style={td}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: p.type === 'MAESTRO' ? '#EEEDFE' : '#E1F5EE',
                          color: p.type === 'MAESTRO' ? '#534AB7' : '#0F6E56',
                        }}>
                          {p.type === 'STAFF' ? p.staffRole : 'MAESTRO'}
                        </span>
                      </td>
                      <td style={td}>
                        {p.attendanceCode ? (
                          <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#1A3A7C', letterSpacing: 2 }}>
                            {p.attendanceCode}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#C0392B' }}>Sin código</span>
                        )}
                      </td>
                      <td style={td} onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleRegenerate(p)} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '5px 10px', borderRadius: 6, border: '1px solid #CBE0F0',
                          cursor: 'pointer', fontSize: 11, background: '#fff', color: '#1A3A7C',
                        }}>
                          <RefreshCw size={11} /> Regenerar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel QR */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #CBE0F0', borderRadius: 12, padding: 20, position: 'sticky', top: 20 }}>
            {!selected ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6B8BB0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👆</div>
                <div style={{ fontSize: 13 }}>Selecciona una persona para ver su QR</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#6B8BB0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  U.E. Naciones Unidas — El Torno
                </div>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR" style={{ width: 220, height: 220, borderRadius: 8 }} />
                ) : (
                  <div style={{ width: 220, height: 220, background: '#F0F6FC', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', color: '#6B8BB0', fontSize: 13 }}>
                    Sin código generado
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1A3A7C', marginTop: 12 }}>
                  {selected.lastName} {selected.firstName}
                </div>
                <div style={{ fontSize: 12, color: '#6B8BB0', marginBottom: 8 }}>
                  {selected.type === 'STAFF' ? selected.staffRole : 'MAESTRO'}
                </div>
                {selected.attendanceCode && (
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 4, color: '#0F172A', fontFamily: 'monospace', marginBottom: 16 }}>
                    {selected.attendanceCode}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleRegenerate(selected)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px', border: '1.5px solid #CBE0F0', borderRadius: 8,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#1A3A7C',
                  }}>
                    <RefreshCw size={13} /> Regenerar
                  </button>
                  {selected.attendanceCode && (
                    <button onClick={handlePrint} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px', border: 'none', borderRadius: 8,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#1A3A7C', color: '#fff',
                    }}>
                      <Download size={13} /> Imprimir
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: '#1A3A7C', textTransform: 'uppercase', letterSpacing: '.5px'
}
const td: React.CSSProperties = {
  padding: '10px 14px', fontSize: 13, color: '#1A3A7C', verticalAlign: 'middle'
}