'use client'

import { useEffect, useState, useRef } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Teacher {
  id: number; firstName: string; lastName: string
  specialty?: string; attendanceCode?: string
}

interface GateRecord {
  id: number; type: string; action: string
  createdAt: string
  teacher?: { firstName: string; lastName: string }
  visitorName?: string
}

type Mode = 'home' | 'teacher' | 'visitor'
type Step = 'input' | 'confirm'

export default function PorteroPage() {
  const [mode,        setMode]        = useState<Mode>('home')
  const [step,        setStep]        = useState<Step>('input')
  const [code,        setCode]        = useState('')
  const [teacher,     setTeacher]     = useState<Teacher | null>(null)
  const [nextAction,  setNextAction]  = useState<'ENTRADA' | 'SALIDA'>('ENTRADA')
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState<{type:'ok'|'err'; text:string} | null>(null)
  const [recentList,  setRecentList]  = useState<GateRecord[]>([])
  const [clock,       setClock]       = useState('')

  const [vName,        setVName]        = useState('')
  const [vCI,          setVCI]          = useState('')
  const [vReason,      setVReason]      = useState('')
  const [vDestination, setVDestination] = useState('')
  const [vAction,      setVAction]      = useState<'ENTRADA'|'SALIDA'>('ENTRADA')

  const codeRef = useRef<HTMLInputElement>(null)
  const token   = () => localStorage.getItem('token') || ''
  const auth    = () => ({ Authorization: `Bearer ${token()}` })

  const notify = (type: 'ok'|'err', text: string) => {
    setToast({type, text}); setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  const loadRecent = async () => {
    try {
      const res  = await fetch(`${API}/api/gate/records`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setRecentList(data.records.slice(0, 8))
    } catch { console.error('Error cargando registros') }
  }

  useEffect(() => { loadRecent() }, [])

  useEffect(() => {
    if (mode === 'teacher' && step === 'input') {
      setTimeout(() => codeRef.current?.focus(), 100)
    }
  }, [mode, step])

  const handleSearchCode = async () => {
    if (!code.trim()) return
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/gate/teacher/${code.trim().toUpperCase()}`, { headers: auth() })
      const data = await res.json()
      if (!res.ok) { notify('err', data.message); return }
      setTeacher(data.teacher)
      setNextAction(data.nextAction)
      setStep('confirm')
    } catch { notify('err', 'Error de conexión') }
    finally { setLoading(false) }
  }

  const handleRegisterTeacher = async () => {
    if (!teacher) return
    setSaving(true)
    try {
      const res  = await fetch(`${API}/api/gate/teacher`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: teacher.id, action: nextAction })
      })
      const data = await res.json()
      if (!res.ok) { notify('err', data.message); return }
      notify('ok', data.message)
      resetTeacher()
      loadRecent()
    } catch { notify('err', 'Error de conexión') }
    finally { setSaving(false) }
  }

  const handleRegisterVisitor = async () => {
    if (!vName.trim()) { notify('err', 'El nombre es requerido'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API}/api/gate/visitor`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorName: vName, visitorCI: vCI, reason: vReason, destination: vDestination, action: vAction })
      })
      const data = await res.json()
      if (!res.ok) { notify('err', data.message); return }
      notify('ok', data.message)
      resetVisitor()
      loadRecent()
    } catch { notify('err', 'Error de conexión') }
    finally { setSaving(false) }
  }

  const resetTeacher = () => { setCode(''); setTeacher(null); setStep('input'); setMode('home') }
  const resetVisitor = () => { setVName(''); setVCI(''); setVReason(''); setVDestination(''); setVAction('ENTRADA'); setMode('home') }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
          background: toast.type === 'ok' ? '#0F6E56' : '#C0392B',
          color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,.4)', whiteSpace: 'nowrap',
        }}>
          {toast.type === 'ok' ? '✅' : '❌'} {toast.text}
        </div>
      )}

      {/* Reloj + logout */}
      <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative' }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#F1F5F9', letterSpacing: 2, fontVariantNumeric: 'tabular-nums' }}>
          {clock}
        </div>
        <button onClick={handleLogout} style={{
          position: 'absolute', top: 0, right: 0,
          background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8,
          padding: '6px 12px', fontSize: 12, color: '#94A3B8', cursor: 'pointer'
        }}>
          Salir
        </button>
      </div>

      {/* HOME */}
      {mode === 'home' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <button onClick={() => { setMode('teacher'); setStep('input'); setCode('') }} style={{
              background: '#1A3A7C', border: 'none', borderRadius: 16, padding: '32px 16px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 48 }}>👨‍🏫</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>Maestro</span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>Registrar entrada/salida</span>
            </button>

            <button onClick={() => setMode('visitor')} style={{
              background: '#0F4C2A', border: 'none', borderRadius: 16, padding: '32px 16px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 48 }}>🧑‍💼</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>Visitante</span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>Registrar visita</span>
            </button>
          </div>

          {recentList.length > 0 && (
            <div style={{ background: '#1E293B', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
                Registros recientes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentList.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8,
                    background: r.action === 'ENTRADA' ? '#0F2A1A' : '#2A0F0F',
                    border: `1px solid ${r.action === 'ENTRADA' ? '#0F6E56' : '#C0392B'}33`,
                  }}>
                    <span style={{ fontSize: 20 }}>{r.type === 'MAESTRO' ? '👨‍🏫' : '🧑‍💼'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>
                        {r.teacher ? `${r.teacher.lastName} ${r.teacher.firstName}` : r.visitorName}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        {r.type === 'MAESTRO' ? 'Maestro' : 'Visitante'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: r.action === 'ENTRADA' ? '#0F6E56' : '#C0392B', color: '#fff',
                      }}>
                        {r.action}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                        {formatTime(r.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* MAESTRO — input código */}
      {mode === 'teacher' && step === 'input' && (
        <div style={{ background: '#1E293B', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <button onClick={() => setMode('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20 }}>←</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>Registrar Maestro</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>Ingresa el código de asistencia</div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <input
              ref={codeRef}
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearchCode()}
              placeholder="Ej: ZF4706"
              maxLength={10}
              style={{
                width: '100%', padding: '20px', fontSize: 32, fontWeight: 800,
                letterSpacing: 8, textAlign: 'center', border: '2px solid #334155',
                borderRadius: 12, background: '#0F172A', color: '#F1F5F9', outline: 'none',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {['1','2','3','4','5','6','7','8','9','⌫','0','↵'].map(k => (
              <button key={k} onClick={() => {
                if (k === '⌫') setCode(p => p.slice(0, -1))
                else if (k === '↵') handleSearchCode()
                else setCode(p => (p + k).slice(0, 10))
              }} style={{
                padding: '18px', fontSize: k === '↵' || k === '⌫' ? 20 : 24,
                fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer',
                background: k === '↵' ? '#1A3A7C' : k === '⌫' ? '#334155' : '#1E3A5F',
                color: '#F1F5F9',
              }}>
                {k}
              </button>
            ))}
          </div>

          <button onClick={handleSearchCode} disabled={!code.trim() || loading} style={{
            width: '100%', padding: '16px', fontSize: 16, fontWeight: 700,
            background: '#1A3A7C', color: '#fff', border: 'none', borderRadius: 12,
            cursor: 'pointer', opacity: (!code.trim() || loading) ? 0.5 : 1,
          }}>
            {loading ? 'Buscando...' : '🔍 Buscar Maestro'}
          </button>
        </div>
      )}

      {/* MAESTRO — confirmar */}
      {mode === 'teacher' && step === 'confirm' && teacher && (
        <div style={{ background: '#1E293B', borderRadius: 16, padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>👨‍🏫</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#F1F5F9', marginBottom: 4 }}>
              {teacher.lastName} {teacher.firstName}
            </div>
            {teacher.specialty && (
              <div style={{ fontSize: 13, color: '#94A3B8' }}>{teacher.specialty}</div>
            )}
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
              Código: {teacher.attendanceCode}
            </div>
          </div>

          <div style={{
            padding: '20px', borderRadius: 12, marginBottom: 24, textAlign: 'center',
            background: nextAction === 'ENTRADA' ? '#0F2A1A' : '#2A1A0F',
            border: `2px solid ${nextAction === 'ENTRADA' ? '#0F6E56' : '#BA7517'}`,
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>
              {nextAction === 'ENTRADA' ? '🟢' : '🔴'}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: nextAction === 'ENTRADA' ? '#0F6E56' : '#BA7517' }}>
              {nextAction}
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              {new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={resetTeacher} style={{
              padding: '16px', fontSize: 15, fontWeight: 600,
              background: '#334155', color: '#F1F5F9', border: 'none', borderRadius: 12, cursor: 'pointer',
            }}>
              ← Cancelar
            </button>
            <button onClick={handleRegisterTeacher} disabled={saving} style={{
              padding: '16px', fontSize: 15, fontWeight: 700,
              background: nextAction === 'ENTRADA' ? '#0F6E56' : '#C0392B',
              color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}>
              {saving ? 'Guardando...' : `✅ Confirmar ${nextAction}`}
            </button>
          </div>
        </div>
      )}

      {/* VISITANTE */}
      {mode === 'visitor' && (
        <div style={{ background: '#1E293B', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <button onClick={() => setMode('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20 }}>←</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>Registrar Visitante</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>Datos del visitante</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(['ENTRADA', 'SALIDA'] as const).map(a => (
                <button key={a} onClick={() => setVAction(a)} style={{
                  padding: '14px', fontSize: 15, fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer',
                  background: vAction === a ? (a === 'ENTRADA' ? '#0F6E56' : '#C0392B') : '#334155',
                  color: '#fff',
                }}>
                  {a === 'ENTRADA' ? '🟢' : '🔴'} {a}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                Nombre completo *
              </label>
              <input value={vName} onChange={e => setVName(e.target.value)}
                placeholder="Nombre del visitante"
                style={{ padding: '12px', border: '1.5px solid #334155', borderRadius: 8, fontSize: 14, color: '#F1F5F9', background: '#0F172A', outline: 'none' }}/>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                CI (opcional)
              </label>
              <input value={vCI} onChange={e => setVCI(e.target.value)}
                placeholder="Número de CI"
                style={{ padding: '12px', border: '1.5px solid #334155', borderRadius: 8, fontSize: 14, color: '#F1F5F9', background: '#0F172A', outline: 'none' }}/>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                Motivo de visita
              </label>
              <input value={vReason} onChange={e => setVReason(e.target.value)}
                placeholder="Ej: Reunión, trámite, entrega..."
                style={{ padding: '12px', border: '1.5px solid #334155', borderRadius: 8, fontSize: 14, color: '#F1F5F9', background: '#0F172A', outline: 'none' }}/>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                Destino / A quién visita
              </label>
              <input value={vDestination} onChange={e => setVDestination(e.target.value)}
                placeholder="Ej: Dirección, Secretaría, Curso 3° A..."
                style={{ padding: '12px', border: '1.5px solid #334155', borderRadius: 8, fontSize: 14, color: '#F1F5F9', background: '#0F172A', outline: 'none' }}/>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <button onClick={resetVisitor} style={{
                padding: '14px', fontSize: 14, fontWeight: 600,
                background: '#334155', color: '#F1F5F9', border: 'none', borderRadius: 12, cursor: 'pointer',
              }}>
                ← Cancelar
              </button>
              <button onClick={handleRegisterVisitor} disabled={!vName.trim() || saving} style={{
                padding: '14px', fontSize: 14, fontWeight: 700,
                background: vAction === 'ENTRADA' ? '#0F6E56' : '#C0392B',
                color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer',
                opacity: (!vName.trim() || saving) ? 0.5 : 1,
              }}>
                {saving ? 'Guardando...' : `✅ Registrar ${vAction}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}