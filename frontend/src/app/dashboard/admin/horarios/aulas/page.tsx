'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, DoorOpen } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Classroom {
  id:       number
  name:     string
  capacity: number | null
  isActive: boolean
}

export default function AulasPage() {
  const router = useRouter()
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState<Classroom | null>(null)
  const [toast,      setToast]      = useState<{type:'ok'|'err'; text:string} | null>(null)
  const [form,       setForm]       = useState({ name: '', capacity: '' })

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const showToast = (type: 'ok'|'err', text: string) => {
    setToast({type, text}); setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/classrooms`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setClassrooms(data)
    } catch { showToast('err', 'Error de conexión') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', capacity: '' })
    setShowModal(true)
  }

  const openEdit = (c: Classroom) => {
    setEditing(c)
    setForm({ name: c.name, capacity: c.capacity ? String(c.capacity) : '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('err', 'El nombre es requerido'); return }
    try {
      const url    = editing ? `${API}/api/classrooms/${editing.id}` : `${API}/api/classrooms`
      const method = editing ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     form.name.trim(),
          capacity: form.capacity ? parseInt(form.capacity) : null,
        })
      })
      const data = await res.json()
      if (!res.ok) { showToast('err', data.message); return }
      showToast('ok', editing ? 'Aula actualizada' : 'Aula creada correctamente')
      setShowModal(false)
      load()
    } catch { showToast('err', 'Error de conexión') }
  }

  const handleDelete = async (c: Classroom) => {
    if (!confirm(`¿Desactivar "${c.name}"?`)) return
    try {
      const res = await fetch(`${API}/api/classrooms/${c.id}`, { method: 'DELETE', headers: auth() })
      if (!res.ok) { showToast('err', 'Error al desactivar'); return }
      showToast('ok', 'Aula desactivada')
      load()
    } catch { showToast('err', 'Error de conexión') }
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', top:16, right:16, zIndex:999, padding:'10px 16px',
          borderRadius:8, fontSize:13,
          background: toast.type==='ok' ? '#E1F5EE' : '#FFF0F0',
          border: `1px solid ${toast.type==='ok' ? '#9FE1CB' : '#FFBBBB'}`,
          color: toast.type==='ok' ? '#0F6E56' : '#C0392B',
          boxShadow:'0 4px 12px rgba(0,0,0,.1)',
        }}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:24, flexWrap:'wrap'}}>
        <button onClick={() => router.push('/dashboard/admin/horarios')}
          style={{display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'#6B8BB0', fontSize:13}}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div style={{flex:1}}>
          <h1 style={{fontSize:20, fontWeight:700, color:'#1A3A7C', margin:0}}>Gestión de Aulas</h1>
          <p style={{fontSize:13, color:'#6B8BB0', margin:0}}>Registra los espacios físicos del colegio</p>
        </div>
        <button onClick={openCreate} style={{
          display:'flex', alignItems:'center', gap:8, padding:'10px 18px',
          background:'#1A3A7C', color:'#fff', border:'none', borderRadius:8,
          fontSize:13, fontWeight:600, cursor:'pointer'
        }}>
          <Plus size={16}/> Nueva Aula
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{display:'flex', justifyContent:'center', padding:48}}>
          <div className="spinner"/>
        </div>
      ) : classrooms.length === 0 ? (
        <div style={{
          background:'#fff', border:'1px dashed #CBE0F0', borderRadius:12,
          padding:48, textAlign:'center', color:'#6B8BB0'
        }}>
          <DoorOpen size={40} style={{marginBottom:12, opacity:.3}}/>
          <p style={{margin:0}}>No hay aulas registradas. Crea la primera.</p>
          <button onClick={openCreate} style={{
            marginTop:16, padding:'8px 16px', background:'#1A3A7C',
            color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13
          }}>
            <Plus size={14}/> Crear aula
          </button>
        </div>
      ) : (
        <div style={{background:'#fff', border:'1px solid #CBE0F0', borderRadius:12, overflow:'hidden'}}>
          <table style={{borderCollapse:'collapse', width:'100%'}}>
            <thead>
              <tr style={{background:'#F0F6FC'}}>
                <th style={th}>Aula</th>
                <th style={th}>Capacidad</th>
                <th style={th}>Estado</th>
                <th style={{...th, textAlign:'right'}}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {classrooms.map((c, i) => (
                <tr key={c.id} style={{background: i%2===0 ? '#fff' : '#FAFCFF'}}>
                  <td style={td}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{
                        width:34, height:34, borderRadius:8,
                        background:'#E8EEF8', display:'flex', alignItems:'center',
                        justifyContent:'center', fontSize:18
                      }}>🚪</div>
                      <span style={{fontWeight:600, color:'#1A3A7C', fontSize:14}}>{c.name}</span>
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{color:'#6B8BB0', fontSize:13}}>
                      {c.capacity ? `${c.capacity} estudiantes` : '—'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{
                      padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                      background: c.isActive ? '#E1F5EE' : '#F5F5F5',
                      color:      c.isActive ? '#0F6E56' : '#999',
                    }}>
                      {c.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style={{...td, textAlign:'right'}}>
                    <div style={{display:'flex', gap:6, justifyContent:'flex-end'}}>
                      <button onClick={() => openEdit(c)} style={{
                        display:'flex', alignItems:'center', gap:4,
                        padding:'6px 12px', background:'#F0F6FC',
                        border:'none', borderRadius:7, cursor:'pointer',
                        color:'#1A3A7C', fontSize:12
                      }}>
                        <Edit2 size={12}/> Editar
                      </button>
                      {c.isActive && (
                        <button onClick={() => handleDelete(c)} style={{
                          display:'flex', alignItems:'center', gap:4,
                          padding:'6px 12px', background:'#FFF0F0',
                          border:'none', borderRadius:7, cursor:'pointer',
                          color:'#C0392B', fontSize:12
                        }}>
                          <Trash2 size={12}/> Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16}}>
          <div style={{background:'#fff', borderRadius:14, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid #CBE0F0'}}>
              <h2 style={{fontSize:16, fontWeight:700, color:'#1A3A7C', margin:0}}>
                {editing ? 'Editar Aula' : 'Nueva Aula'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{background:'none', border:'none', cursor:'pointer', color:'#6B8BB0'}}>
                <X size={18}/>
              </button>
            </div>
            <div style={{padding:20, display:'flex', flexDirection:'column', gap:14}}>
              <div style={{display:'flex', flexDirection:'column', gap:6}}>
                <label style={labelStyle}>Nombre *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  placeholder="Ej: Aula 101, Laboratorio, Patio"
                  style={inputStyle}
                />
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:6}}>
                <label style={labelStyle}>Capacidad (opcional)</label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={e => setForm(p => ({...p, capacity: e.target.value}))}
                  placeholder="Ej: 35"
                  min={1}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{display:'flex', justifyContent:'flex-end', gap:10, padding:'14px 20px', borderTop:'1px solid #CBE0F0'}}>
              <button onClick={() => setShowModal(false)} style={{
                padding:'9px 16px', background:'#fff', border:'1.5px solid #CBE0F0',
                borderRadius:8, fontSize:13, cursor:'pointer', color:'#1A3A7C'
              }}>
                Cancelar
              </button>
              <button onClick={handleSave} style={{
                display:'flex', alignItems:'center', gap:6, padding:'9px 18px',
                background:'#1A3A7C', color:'#fff', border:'none', borderRadius:8,
                fontSize:13, fontWeight:600, cursor:'pointer'
              }}>
                <Save size={14}/> {editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

const th: React.CSSProperties = {
  padding:'10px 16px', fontSize:11, fontWeight:700,
  color:'#1A3A7C', textAlign:'left', letterSpacing:'.5px', textTransform:'uppercase'
}
const td: React.CSSProperties = {
  padding:'12px 16px', borderTop:'1px solid #F0F6FC', fontSize:13, verticalAlign:'middle'
}
const labelStyle: React.CSSProperties = {
  fontSize:11, fontWeight:700, color:'#1A3A7C', textTransform:'uppercase', letterSpacing:'.5px'
}
const inputStyle: React.CSSProperties = {
  padding:'10px 12px', border:'1.5px solid #CBE0F0', borderRadius:8,
  fontSize:13, color:'#1A3A7C', outline:'none', width:'100%', boxSizing:'border-box'
}