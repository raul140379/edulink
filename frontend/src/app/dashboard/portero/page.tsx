'use client'

import { useEffect, useState, useRef } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Person {
  id: number; firstName: string; lastName: string
  ci?: string; attendanceCode?: string
  specialty?: string; staffRole?: string
}
interface GateRecord {
  id: number; type: string; action: string; createdAt: string
  teacher?: { firstName: string; lastName: string }
  staff?: { firstName: string; lastName: string }
  visitorName?: string
}
interface Expected {
  id: number; firstName: string; lastName: string
  ci?: string; attendanceCode?: string
  category: string; registered: boolean; isAbsent: boolean
  gateRecord: any; attendance: any
}
interface ScheduleInfo {
  startTime: string; exitTime: string
  windowOpen: boolean; isClosed: boolean
  minutesBeforeExit: number
}
interface ExpectedData {
  teachers: Expected[]
  teachersWithoutPeriods: Expected[]
  staff: Expected[]
  schedule: ScheduleInfo
  summary: any
}

type Mode = 'home' | 'teacher' | 'staff' | 'visitor' | 'expected'
type Step = 'input' | 'confirm'

export default function PorteroPage() {
  const [mode,       setMode]       = useState<Mode>('home')
  const [step,       setStep]       = useState<Step>('input')
  const [code,       setCode]       = useState('')
  const [person,     setPerson]     = useState<Person | null>(null)
  const [nextAction, setNextAction] = useState<'ENTRADA'|'SALIDA'>('ENTRADA')
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState<{type:'ok'|'err'|'warn'; text:string}|null>(null)
  const [recentList, setRecentList] = useState<GateRecord[]>([])
  const [clock,      setClock]      = useState('')
  const [expected,   setExpected]   = useState<ExpectedData|null>(null)
  const [loadingExp, setLoadingExp] = useState(false)
  const [showQR,     setShowQR]     = useState(false)
  const [isClosed,   setIsClosed]   = useState(false)
  const [selectedExpected, setSelectedExpected] = useState<Expected|null>(null)

  const [vName,        setVName]        = useState('')
  const [vCI,          setVCI]          = useState('')
  const [vReason,      setVReason]      = useState('')
  const [vDestination, setVDestination] = useState('')
  const [vAction,      setVAction]      = useState<'ENTRADA'|'SALIDA'>('ENTRADA')

  const codeRef    = useRef<HTMLInputElement>(null)
  const scannerRef = useRef<any>(null)

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const notify = (type: 'ok'|'err'|'warn', text: string) => {
    setToast({type, text}); setTimeout(() => setToast(null), 5000)
  }

  // Reloj + verificar cierre
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

  // Verificar estado de cierre periódicamente
  useEffect(() => {
    const checkClosed = async () => {
      try {
        const res  = await fetch(`${API}/api/gate/expected-today`, { headers: auth() })
        const data = await res.json()
        if (res.ok) setIsClosed(data.schedule?.isClosed || false)
      } catch {}
    }
    checkClosed()
    const i = setInterval(checkClosed, 60000) // cada minuto
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    if ((mode === 'teacher' || mode === 'staff') && step === 'input') {
      setTimeout(() => codeRef.current?.focus(), 100)
    }
  }, [mode, step])

  useEffect(() => {
    if (mode !== 'teacher' && mode !== 'staff') stopQRScanner()
  }, [mode])

  const loadRecent = async () => {
    try {
      const res  = await fetch(`${API}/api/gate/records`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setRecentList(data.records.slice(0, 8))
    } catch {}
  }

  const loadExpected = async () => {
    setLoadingExp(true)
    try {
      const res  = await fetch(`${API}/api/gate/expected-today`, { headers: auth() })
      const data = await res.json()
      if (res.ok) {
        setExpected(data)
        setIsClosed(data.schedule?.isClosed || false)
      }
    } catch { notify('err', 'Error al cargar lista') }
    finally { setLoadingExp(false) }
  }

  useEffect(() => { loadRecent() }, [])

  // ── QR Scanner ────────────────────────────────────
  const startQRScanner = async () => {
    setShowQR(true)
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            const val = decodedText.trim().toUpperCase()
            setCode(val)
            stopQRScanner()
            handleSearchCodeByValue(val)
          },
          () => {}
        )
      } catch {
        notify('err', 'No se pudo acceder a la cámara')
        setShowQR(false)
      }
    }, 300)
  }

  const stopQRScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2 || state === 3) await scannerRef.current.stop()
      } catch {}
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
    setShowQR(false)
  }

  const handleSearchCodeByValue = async (value: string) => {
    if (!value) return
    setLoading(true)
    try {
      const endpoint = mode === 'staff'
        ? `${API}/api/gate/staff/${value}`
        : `${API}/api/gate/teacher/${value}`
      const res  = await fetch(endpoint, { headers: auth() })
      const data = await res.json()
      if (!res.ok) { notify('err', data.message); return }
      setPerson(mode === 'staff' ? data.staff : data.teacher)
      setNextAction(data.nextAction)
      setStep('confirm')
    } catch { notify('err', 'Error de conexión') }
    finally { setLoading(false) }
  }

  const handleSearchCode = async () => {
    if (!code.trim()) return
    setLoading(true)
    try {
      const endpoint = mode === 'staff'
        ? `${API}/api/gate/staff/${code.trim().toUpperCase()}`
        : `${API}/api/gate/teacher/${code.trim().toUpperCase()}`
      const res  = await fetch(endpoint, { headers: auth() })
      const data = await res.json()
      if (!res.ok) { notify('err', data.message); return }
      setPerson(mode === 'staff' ? data.staff : data.teacher)
      setNextAction(data.nextAction)
      setStep('confirm')
    } catch { notify('err', 'Error de conexión') }
    finally { setLoading(false) }
  }

  const handleRegisterByCode = async () => {
    if (!person) return
    setSaving(true)
    try {
      const endpoint = mode === 'staff' ? `${API}/api/gate/staff` : `${API}/api/gate/teacher`
      const body     = mode === 'staff'
        ? { staffId: person.id, action: nextAction }
        : { teacherId: person.id, action: nextAction }
      const res  = await fetch(endpoint, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.blocked) { notify('warn', data.message); resetPerson(); return }
        notify('err', data.message); resetPerson(); return
      }
      // Maestro sin clases → registrado como visitante
      if (data.asVisitor) {
        notify('warn', data.message)
      } else {
        notify('ok', data.message)
      }
      resetPerson()
      loadRecent()
      if (expected) loadExpected()
    } catch { notify('err', 'Error de conexión') }
    finally { setSaving(false) }
  }

  const handleRegisterFromList = async (exp: Expected, action: 'ENTRADA'|'SALIDA') => {
    setSaving(true)
    try {
      const isStaff  = exp.category !== 'MAESTRO' && exp.category !== 'MAESTRO_VISITANTE'
      const isNoClass = exp.category === 'MAESTRO_VISITANTE'

      let endpoint: string
      let body: any

      if (isNoClass) {
        // Registrar como visitante directamente
        endpoint = `${API}/api/gate/visitor`
        body = {
          visitorName: `${exp.lastName} ${exp.firstName}`,
          reason:      'Maestro - Sin clases hoy',
          action,
        }
      } else if (isStaff) {
        endpoint = `${API}/api/gate/staff`
        body = { staffId: exp.id, action }
      } else {
        endpoint = `${API}/api/gate/teacher`
        body = { teacherId: exp.id, action }
      }

      const res  = await fetch(endpoint, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) { notify('err', data.message); return }
      notify('ok', data.message)
      setSelectedExpected(null)
      loadRecent()
      loadExpected()
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

  const resetPerson  = () => { setCode(''); setPerson(null); setStep('input'); setMode('home') }
  const resetVisitor = () => { setVName(''); setVCI(''); setVReason(''); setVDestination(''); setVAction('ENTRADA'); setMode('home') }
  const formatTime   = (iso: string) => new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
  const handleLogout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login' }
  const personLabel  = mode === 'staff' ? 'Personal' : 'Maestro'

  // ── PANTALLA BLOQUEADA ────────────────────────────
  if (isClosed) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#F1F5F9', letterSpacing: 2, marginBottom: 24, fontVariantNumeric: 'tabular-nums' }}>
          {clock}
        </div>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', marginBottom: 8 }}>
          Portería cerrada
        </div>
        <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 32 }}>
          El turno finalizó. El módulo se habilitará nuevamente mañana.
        </div>
        <button onClick={handleLogout} style={{
          background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8,
          padding: '10px 20px', fontSize: 13, color: '#94A3B8', cursor: 'pointer'
        }}>Cerrar sesión</button>
      </div>
    )
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 999, padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
          background: toast.type === 'ok' ? '#0F6E56' : toast.type === 'warn' ? '#BA7517' : '#C0392B',
          color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,.4)', whiteSpace: 'nowrap', maxWidth: '90vw',
        }}>
          {toast.type === 'ok' ? '✅' : toast.type === 'warn' ? '⚠️' : '❌'} {toast.text}
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
        }}>Salir</button>
      </div>

      {/* ── HOME ── */}
      {mode === 'home' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <button onClick={() => { setMode('teacher'); setStep('input'); setCode('') }} style={{
              background: '#1A3A7C', border: 'none', borderRadius: 16, padding: '28px 16px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 40 }}>👨‍🏫</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>Maestro</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Registrar por código</span>
            </button>
            <button onClick={() => { setMode('staff'); setStep('input'); setCode('') }} style={{
              background: '#1A4A2A', border: 'none', borderRadius: 16, padding: '28px 16px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 40 }}>🏢</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>Administrativo</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Registrar por código</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <button onClick={() => setMode('visitor')} style={{
              background: '#2A1A4A', border: 'none', borderRadius: 16, padding: '20px 16px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 32 }}>🧑‍💼</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>Visitante</span>
            </button>
            <button onClick={() => { setMode('expected'); loadExpected() }} style={{
              background: '#2A2A1A', border: 'none', borderRadius: 16, padding: '20px 16px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 32 }}>📋</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>Lista de hoy</span>
            </button>
          </div>

          <a href="/dashboard/asistencia-kiosco" style={{
            display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
            background: '#1E293B', border: '1px dashed #334155', borderRadius: 12,
            padding: '14px 16px', marginBottom: 20,
          }}>
            <span style={{ fontSize: 22 }}>🕐</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>Autoservicio de asistencia — Maestros</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>Pantalla pública para que el maestro marque su propio código</div>
            </div>
          </a>

          {recentList.length > 0 && (
            <div style={{ background: '#1E293B', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
                Registros recientes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentList.map(r => {
                  const name = r.teacher
                    ? `${r.teacher.lastName} ${r.teacher.firstName}`
                    : (r as any).staff
                      ? `${(r as any).staff.lastName} ${(r as any).staff.firstName}`
                      : r.visitorName
                  const icon  = r.type === 'MAESTRO' ? '👨‍🏫' : r.type === 'ADMINISTRATIVO' ? '🏢' : '🧑‍💼'
                  const label = r.type === 'MAESTRO' ? 'Maestro' : r.type === 'ADMINISTRATIVO' ? 'Administrativo' : 'Visitante'
                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
                      background: r.action === 'ENTRADA' ? '#0F2A1A' : '#2A0F0F',
                      border: `1px solid ${r.action === 'ENTRADA' ? '#0F6E56' : '#C0392B'}33`,
                    }}>
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{name}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>{label}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: r.action === 'ENTRADA' ? '#0F6E56' : '#C0392B', color: '#fff',
                        }}>{r.action}</div>
                        <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{formatTime(r.createdAt)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── CÓDIGO ── */}
      {(mode === 'teacher' || mode === 'staff') && step === 'input' && (
        <div style={{ background: '#1E293B', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button onClick={() => { stopQRScanner(); setMode('home') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20 }}>←</button>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>Registrar {personLabel}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>Ingresa o escanea el código</div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <input ref={codeRef} type="text" value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearchCode()}
              placeholder="Ej: JCF-4827" maxLength={12}
              style={{
                width: '100%', padding: '18px', fontSize: 28, fontWeight: 800,
                letterSpacing: 6, textAlign: 'center', border: '2px solid #334155',
                borderRadius: 12, background: '#0F172A', color: '#F1F5F9', outline: 'none',
                fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box',
              }}
            />
          </div>

          {!showQR && (
            <button onClick={startQRScanner} style={{
              width: '100%', padding: '13px', fontSize: 14, fontWeight: 700,
              background: '#1A4A3A', color: '#fff', border: 'none', borderRadius: 12,
              cursor: 'pointer', marginBottom: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              📷 Escanear QR con cámara
            </button>
          )}

          {showQR && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#94A3B8' }}>Apunta al código QR</span>
                <button onClick={stopQRScanner} style={{
                  background: '#C0392B', border: 'none', borderRadius: 6,
                  padding: '4px 10px', fontSize: 12, color: '#fff', cursor: 'pointer'
                }}>✕ Cerrar</button>
              </div>
              <div id="qr-reader" style={{ borderRadius: 12, overflow: 'hidden' }} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
            {['1','2','3','4','5','6','7','8','9','⌫','0','-'].map(k => (
              <button key={k} onClick={() => {
                if (k === '⌫') setCode(p => p.slice(0, -1))
                else setCode(p => (p + k).slice(0, 12))
              }} style={{
                padding: '15px', fontSize: k === '⌫' ? 18 : 20,
                fontWeight: 700, border: 'none', borderRadius: 10, cursor: 'pointer',
                background: k === '⌫' ? '#334155' : '#1E3A5F', color: '#F1F5F9',
              }}>{k}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5, marginBottom: 14 }}>
            {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R'].map(k => (
              <button key={k} onClick={() => setCode(p => (p + k).slice(0, 12))} style={{
                padding: '9px 4px', fontSize: 13, fontWeight: 700, border: 'none',
                borderRadius: 8, cursor: 'pointer', background: '#1E3A5F', color: '#F1F5F9',
              }}>{k}</button>
            ))}
          </div>

          <button onClick={handleSearchCode} disabled={!code.trim() || loading} style={{
            width: '100%', padding: '15px', fontSize: 16, fontWeight: 700,
            background: mode === 'staff' ? '#1A4A2A' : '#1A3A7C',
            color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer',
            opacity: (!code.trim() || loading) ? 0.5 : 1,
          }}>
            {loading ? 'Buscando...' : `🔍 Buscar ${personLabel}`}
          </button>
        </div>
      )}

      {/* ── CONFIRMAR ── */}
      {(mode === 'teacher' || mode === 'staff') && step === 'confirm' && person && (
        <div style={{ background: '#1E293B', borderRadius: 16, padding: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>{mode === 'staff' ? '🏢' : '👨‍🏫'}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', marginBottom: 4 }}>
              {person.lastName} {person.firstName}
            </div>
            {person.specialty && <div style={{ fontSize: 13, color: '#94A3B8' }}>{person.specialty}</div>}
            {person.staffRole && <div style={{ fontSize: 13, color: '#94A3B8' }}>{person.staffRole}</div>}
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Código: {person.attendanceCode}</div>
          </div>

          <div style={{
            padding: '20px', borderRadius: 12, marginBottom: 24, textAlign: 'center',
            background: nextAction === 'ENTRADA' ? '#0F2A1A' : '#2A1A0F',
            border: `2px solid ${nextAction === 'ENTRADA' ? '#0F6E56' : '#BA7517'}`,
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{nextAction === 'ENTRADA' ? '🟢' : '🔴'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: nextAction === 'ENTRADA' ? '#0F6E56' : '#BA7517' }}>
              {nextAction}
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 4 }}>
              {new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={resetPerson} style={{
              padding: '16px', fontSize: 15, fontWeight: 600,
              background: '#334155', color: '#F1F5F9', border: 'none', borderRadius: 12, cursor: 'pointer',
            }}>← Cancelar</button>
            <button onClick={handleRegisterByCode} disabled={saving} style={{
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

      {/* ── LISTA ESPERADOS HOY ── */}
      {mode === 'expected' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button onClick={() => { setMode('home'); setSelectedExpected(null) }} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20
            }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>Lista de hoy</div>
              {expected?.schedule && (
                <div style={{ fontSize: 12, color: expected.schedule.windowOpen ? '#0F6E56' : '#94A3B8' }}>
                  {expected.schedule.windowOpen
                    ? `✅ Ventana abierta — ${expected.schedule.minutesBeforeExit} min para el cierre`
                    : `⏳ Faltan ${expected.schedule.minutesBeforeExit} min para las ${expected.schedule.exitTime}`}
                </div>
              )}
            </div>
            <button onClick={loadExpected} style={{
              background: '#334155', border: 'none', borderRadius: 8,
              padding: '6px 12px', fontSize: 12, color: '#94A3B8', cursor: 'pointer'
            }}>↻</button>
          </div>

          {/* Modal confirmación */}
          {selectedExpected && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20
            }}>
              <div style={{ background: '#1E293B', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>
                    {selectedExpected.category === 'MAESTRO_VISITANTE' ? '👨‍🏫🔸' : selectedExpected.category === 'MAESTRO' ? '👨‍🏫' : '🏢'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9' }}>
                    {selectedExpected.lastName} {selectedExpected.firstName}
                  </div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                    {selectedExpected.category === 'MAESTRO_VISITANTE' ? 'Maestro sin clases hoy' : selectedExpected.category}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <button onClick={() => setSelectedExpected(null)} style={{
                    padding: '14px', fontSize: 13, fontWeight: 600,
                    background: '#334155', color: '#F1F5F9', border: 'none', borderRadius: 10, cursor: 'pointer',
                  }}>← Volver</button>
                  <button onClick={() => handleRegisterFromList(selectedExpected, 'ENTRADA')} disabled={saving} style={{
                    padding: '14px', fontSize: 13, fontWeight: 700,
                    background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}>🟢 Entrada</button>
                  <button onClick={() => handleRegisterFromList(selectedExpected, 'SALIDA')} disabled={saving} style={{
                    padding: '14px', fontSize: 13, fontWeight: 700,
                    background: '#C0392B', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}>🔴 Salida</button>
                </div>
              </div>
            </div>
          )}

          {loadingExp && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Cargando...</div>}

          {expected && !loadingExp && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Maestros esperados',   val: expected.summary?.teachersExpected  ?? 0, color: '#1A3A7C' },
                  { label: 'Maestros registrados',  val: expected.summary?.teachersRegistered ?? 0, color: '#0F6E56' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: s.color + '33', border: `1px solid ${s.color}55`,
                    borderRadius: 10, padding: '12px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#F1F5F9' }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Maestros CON clases */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                Con clases hoy ({expected.teachers.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {expected.teachers.map(t => (
                  <button key={t.id} onClick={() => !t.isAbsent && setSelectedExpected(t)}
                    disabled={t.isAbsent}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderRadius: 10, border: 'none', cursor: t.isAbsent ? 'default' : 'pointer', textAlign: 'left',
                      background: t.isAbsent ? '#1A0F0F' : t.registered ? '#0F2A1A' : '#1E293B',
                      borderLeft: `4px solid ${t.isAbsent ? '#7F1D1D' : t.registered ? '#0F6E56' : '#334155'}`,
                      opacity: t.isAbsent ? 0.6 : 1, width: '100%',
                    }}>
                    <span style={{ fontSize: 22 }}>{t.isAbsent ? '❌' : t.registered ? '✅' : '⏳'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{t.lastName} {t.firstName}</div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        {t.isAbsent ? 'AUSENTE' : t.registered ? `Entró a las ${formatTime(t.gateRecord?.createdAt)}` : 'Sin registro'}
                      </div>
                    </div>
                    {!t.registered && !t.isAbsent && <span style={{ fontSize: 11, color: '#94A3B8' }}>Tap →</span>}
                  </button>
                ))}
              </div>

              {/* Maestros SIN clases */}
              {expected.teachersWithoutPeriods?.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#BA7517', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    Sin clases hoy ({expected.teachersWithoutPeriods.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                    {expected.teachersWithoutPeriods.map(t => (
                      <button key={t.id} onClick={() => setSelectedExpected(t)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                          borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                          background: t.registered ? '#1A2A0F' : '#1E293B',
                          borderLeft: `4px solid ${t.registered ? '#639922' : '#BA7517'}`,
                          width: '100%',
                        }}>
                        <span style={{ fontSize: 22 }}>{t.registered ? '👁️' : '⏳'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{t.lastName} {t.firstName}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            {t.registered ? `Visitante — entró a las ${formatTime(t.gateRecord?.createdAt)}` : 'Sin registro hoy'}
                          </div>
                        </div>
                        {!t.registered && <span style={{ fontSize: 11, color: '#94A3B8' }}>Tap →</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Staff */}
              {expected.staff.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    Personal administrativo ({expected.staff.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {expected.staff.map(s => (
                      <button key={s.id} onClick={() => setSelectedExpected(s)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                          borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                          background: s.registered ? '#0F2A1A' : '#1E293B',
                          borderLeft: `4px solid ${s.registered ? '#0F6E56' : '#334155'}`,
                          width: '100%',
                        }}>
                        <span style={{ fontSize: 22 }}>{s.registered ? '✅' : '⏳'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{s.lastName} {s.firstName}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            {s.category} — {s.registered ? `Entró a las ${formatTime(s.gateRecord?.createdAt)}` : 'Sin registro'}
                          </div>
                        </div>
                        {!s.registered && <span style={{ fontSize: 11, color: '#94A3B8' }}>Tap →</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── VISITANTE ── */}
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

            {[
              { label: 'Nombre completo *',        val: vName,        set: setVName,        ph: 'Nombre del visitante' },
              { label: 'CI (opcional)',             val: vCI,          set: setVCI,          ph: 'Número de CI' },
              { label: 'Motivo de visita',          val: vReason,      set: setVReason,      ph: 'Ej: Reunión, trámite...' },
              { label: 'Destino / A quién visita', val: vDestination, set: setVDestination, ph: 'Ej: Dirección, Secretaría...' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  {f.label}
                </label>
                <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                  style={{ padding: '12px', border: '1.5px solid #334155', borderRadius: 8, fontSize: 14, color: '#F1F5F9', background: '#0F172A', outline: 'none' }} />
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <button onClick={resetVisitor} style={{
                padding: '14px', fontSize: 14, fontWeight: 600,
                background: '#334155', color: '#F1F5F9', border: 'none', borderRadius: 12, cursor: 'pointer',
              }}>← Cancelar</button>
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