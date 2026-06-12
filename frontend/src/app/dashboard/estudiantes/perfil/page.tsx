'use client'

import { useEffect, useState } from 'react'
import { UserCircle, Lock, Save, Eye, EyeOff, CheckCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface StudentProfile {
  id:           number
  firstName:    string
  lastName:     string
  ci:           string | null
  rude:         string | null
  kardex:       string | null
  birthDate:    string | null
  gender:       string | null
  phone:        string | null
  email:        string | null
  address:      string | null
  course:       { grade: string; parallel: string; level: string; shift: string } | null
  academicYear: { year: number } | null
  tutor:        { firstName: string; lastName: string; phone: string | null } | null
}

const GENDER_LABEL: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMENINO:  'Femenino',
}

const SHIFT_LABEL: Record<string, string> = {
  MORNING:   'Mañana',
  AFTERNOON: 'Tarde',
  NIGHT:     'Noche',
}

const GRADE_LABEL: Record<string, string> = {
  PRIMERO:  '1°',
  SEGUNDO:  '2°',
  TERCERO:  '3°',
  CUARTO:   '4°',
  QUINTO:   '5°',
  SEXTO:    '6°',
}

export default function PerfilPage() {
  const [profile,      setProfile]      = useState<StudentProfile | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState<'info' | 'password'>('info')

  // Password form
  const [currentPwd,   setCurrentPwd]   = useState('')
  const [newPwd,       setNewPwd]       = useState('')
  const [confirmPwd,   setConfirmPwd]   = useState('')
  const [showCurrent,  setShowCurrent]  = useState(false)
  const [showNew,      setShowNew]      = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [pwdLoading,   setPwdLoading]   = useState(false)
  const [pwdError,     setPwdError]     = useState('')
  const [pwdSuccess,   setPwdSuccess]   = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/students/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setProfile(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleChangePassword = async () => {
    setPwdError('')
    setPwdSuccess(false)

    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdError('Completa todos los campos'); return
    }
    if (newPwd.length < 6) {
      setPwdError('La nueva contraseña debe tener al menos 6 caracteres'); return
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Las contraseñas no coinciden'); return
    }

    setPwdLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method:  'POST',
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) { setPwdError(data.message || 'Error al cambiar contraseña'); return }
      setPwdSuccess(true)
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch {
      setPwdError('Error de conexión')
    } finally {
      setPwdLoading(false)
    }
  }

  const formatDate = (d?: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric' })
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:300 }}>
      <div className="spinner"/>
    </div>
  )

  if (!profile) return (
    <div style={{ textAlign:'center', padding:48, color:'#6B8BB0' }}>
      No se pudo cargar el perfil.
    </div>
  )

  return (
    <div style={{ maxWidth:700 }}>
      {/* Header */}
      <div style={{
        background:'linear-gradient(135deg,#1A3A7C,#2756B8)',
        borderRadius:12, padding:'20px 24px', marginBottom:24, color:'#fff',
        display:'flex', alignItems:'center', gap:16,
      }}>
        <div style={{
          width:60, height:60, borderRadius:'50%',
          backgroundColor:'rgba(255,255,255,0.2)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <UserCircle size={36} color="#fff"/>
        </div>
        <div>
          <div style={{ fontSize:20, fontWeight:800 }}>
            {profile.firstName} {profile.lastName}
          </div>
          {profile.course && (
            <div style={{ fontSize:13, opacity:.8, marginTop:4 }}>
              {GRADE_LABEL[profile.course.grade] || profile.course.grade} {profile.course.parallel} ·{' '}
              {profile.course.level} · Turno {SHIFT_LABEL[profile.course.shift] || profile.course.shift}
              {profile.academicYear ? ` · Gestión ${profile.academicYear.year}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20 }}>
        {[
          { key:'info',     label:'Mis Datos',          icon:<UserCircle size={15}/> },
          { key:'password', label:'Cambiar Contraseña', icon:<Lock size={15}/> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'9px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13,
              backgroundColor: tab === t.key ? '#1A3A7C' : '#fff',
              color:           tab === t.key ? '#fff'    : '#6B8BB0',
              fontWeight:      tab === t.key ? 600       : 400,
              boxShadow:'0 1px 4px rgba(26,58,124,.08)',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Mis Datos */}
      {tab === 'info' && (
        <div style={{ backgroundColor:'#fff', borderRadius:10, boxShadow:'0 1px 4px rgba(26,58,124,.08)', overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #F0F6FC' }}>
            <span style={{ fontWeight:700, fontSize:14, color:'#1A3A7C' }}>Información Personal</span>
          </div>
          <div style={{ padding:'20px 24px' }}>
            <div className="info-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              {[
                { label:'Nombres',          value: profile.firstName },
                { label:'Apellidos',        value: profile.lastName },
                { label:'CI',               value: profile.ci        || '—' },
                { label:'RUDE',             value: profile.rude      || '—' },
                { label:'N° Kardex',        value: profile.kardex    || '—' },
                { label:'Fecha Nacimiento', value: formatDate(profile.birthDate) },
                { label:'Género',           value: GENDER_LABEL[profile.gender ?? ''] || '—' },
                { label:'Teléfono',         value: profile.phone     || '—' },
                { label:'Correo',           value: profile.email     || '—' },
                { label:'Dirección',        value: profile.address   || '—' },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ fontSize:11, fontWeight:600, color:'#6B8BB0', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize:14, color:'#1A3A7C', fontWeight:500 }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* Tutor legal */}
            {profile.tutor && (
              <>
                <div style={{ borderTop:'1px solid #F0F6FC', margin:'24px 0 20px' }}/>
                <div style={{ fontSize:13, fontWeight:700, color:'#1A3A7C', marginBottom:16 }}>
                  Tutor Legal
                </div>
                <div className="info-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:'#6B8BB0', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>
                      Nombre Completo
                    </div>
                    <div style={{ fontSize:14, color:'#1A3A7C', fontWeight:500 }}>
                      {profile.tutor.firstName} {profile.tutor.lastName}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:'#6B8BB0', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>
                      Teléfono
                    </div>
                    <div style={{ fontSize:14, color:'#1A3A7C', fontWeight:500 }}>
                      {profile.tutor.phone || '—'}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab: Cambiar Contraseña */}
      {tab === 'password' && (
        <div style={{ backgroundColor:'#fff', borderRadius:10, boxShadow:'0 1px 4px rgba(26,58,124,.08)', overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #F0F6FC' }}>
            <span style={{ fontWeight:700, fontSize:14, color:'#1A3A7C' }}>Cambiar Contraseña</span>
          </div>
          <div style={{ padding:'24px' }}>
            {pwdSuccess && (
              <div style={{
                display:'flex', alignItems:'center', gap:10,
                backgroundColor:'#E8F8F2', border:'1px solid #0F6E56',
                borderRadius:8, padding:'12px 16px', marginBottom:20,
                color:'#0F6E56', fontSize:13, fontWeight:600,
              }}>
                <CheckCircle size={18}/> Contraseña actualizada correctamente
              </div>
            )}

            {pwdError && (
              <div style={{
                backgroundColor:'#FDE8E8', border:'1px solid #c0392b',
                borderRadius:8, padding:'12px 16px', marginBottom:20,
                color:'#c0392b', fontSize:13,
              }}>
                {pwdError}
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:18, maxWidth:400 }}>
              {[
                { label:'Contraseña actual',        value:currentPwd, set:setCurrentPwd, show:showCurrent, toggle:()=>setShowCurrent(!showCurrent) },
                { label:'Nueva contraseña',         value:newPwd,     set:setNewPwd,     show:showNew,     toggle:()=>setShowNew(!showNew) },
                { label:'Confirmar nueva contraseña', value:confirmPwd, set:setConfirmPwd, show:showConfirm, toggle:()=>setShowConfirm(!showConfirm) },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize:12, fontWeight:600, color:'#1A3A7C', display:'block', marginBottom:6 }}>
                    {f.label}
                  </label>
                  <div style={{ position:'relative' }}>
                    <input
                      type={f.show ? 'text' : 'password'}
                      value={f.value}
                      onChange={e => f.set(e.target.value)}
                      style={{
                        width:'100%', padding:'10px 40px 10px 12px',
                        borderRadius:8, border:'1px solid #E0EAF5',
                        fontSize:14, color:'#1A3A7C', outline:'none',
                        boxSizing:'border-box',
                      }}
                    />
                    <button onClick={f.toggle}
                      style={{
                        position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer', color:'#6B8BB0',
                        display:'flex', alignItems:'center',
                      }}>
                      {f.show ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={handleChangePassword}
                disabled={pwdLoading}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  backgroundColor: pwdLoading ? '#6B8BB0' : '#1A3A7C',
                  color:'#fff', border:'none', borderRadius:8,
                  padding:'11px 24px', fontSize:14, fontWeight:600,
                  cursor: pwdLoading ? 'not-allowed' : 'pointer',
                  marginTop:4,
                }}>
                {pwdLoading ? <div className="spinner-sm"/> : <Save size={16}/>}
                {pwdLoading ? 'Guardando...' : 'Actualizar Contraseña'}
              </button>
            </div>

            <div style={{ marginTop:20, padding:'12px 16px', backgroundColor:'#F0F6FC', borderRadius:8, fontSize:12, color:'#6B8BB0' }}>
              💡 La contraseña debe tener al menos 6 caracteres.
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spinner{width:24px;height:24px;border:2px solid rgba(26,58,124,.2);border-top-color:#1A3A7C;border-radius:50%;animation:spin .7s linear infinite}
        .spinner-sm{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:600px){.info-grid{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  )
}