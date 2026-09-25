'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, User, BookOpen, Users, GraduationCap,
  Phone, Mail, MapPin, CreditCard, Calendar, KeyRound, Repeat, X,
  UserPlus, Search, Check, Star
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  birthDate?: string
  phone?:    string
  email?:    string
  address?:  string
  isActive:  boolean
  user?:     { id: number; email: string; role: string; isActive: boolean }
  parents:   {
    relationType: string
    isTutor:      boolean
    parent: {
      id:        number
      firstName: string
      lastName:  string
      ci?:       string
      phone?:    string
      email?:    string
      address?:  string
    }
  }[]
  assignments: {
    id:            number
    year:          number
    educationType: string
    course: {
      id:            number
      level:         string
      grade:         string
      parallel:      string
      shift:         string
      educationType: string
    }
    academicYear: { year: number; isActive: boolean }
  }[]
}

interface CourseOption {
  id:            number
  level:         string
  grade:         string
  parallel:      string
  shift:         string
  educationType: string
}

interface ParentHit {
  id: number; firstName: string; lastName: string; ci?: string; phone?: string
}

interface License {
  id:              number
  startDate:       string
  endDate:         string
  reason:          string | null
  createdAt:       string
  createdByName:   string | null
  cancelledAt:     string | null
  cancelledNote:   string | null
  cancelledByName: string | null
}

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°'
}
const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche'
}
const LEVEL_LABELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria'
}
const REL_LABELS: Record<string, string> = {
  PADRE: 'Padre', MADRE: 'Madre', TUTOR_LEGAL: 'Tutor Legal', OTRO: 'Otro'
}
const REL_COLORS: Record<string, string> = {
  PADRE: '#0A5A45', MADRE: '#0F6E56', TUTOR_LEGAL: '#712B13', OTRO: '#444441'
}
const RELATION_TYPES = [
  { value: 'PADRE', label: 'Padre' },
  { value: 'MADRE', label: 'Madre' },
  { value: 'OTRO',  label: 'Otro (tercero)' },
]
const emptyRegisterForm = {
  firstName: '', lastName: '', ci: '', phone: '', email: '', address: '', kardex: '',
  relationType: 'PADRE', isTutor: true,
}

// timeZone: 'UTC' es obligatorio acá — birthDate y las fechas de licencia son
// fechas de calendario puras ancladas a medianoche UTC, nunca un instante
// real. Sin esto, toLocaleDateString aplica el huso horario local del
// navegador y corre la fecha un día hacia atrás (mismo bug ya corregido en
// admin/licencias/page.tsx).
const formatDate = (d?: string) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const calcAge = (d?: string) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  return `${Math.floor(diff / (1000 * 60 * 60 * 24 * 365))} años`
}

export default function StudentDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string

  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [changeOpen,    setChangeOpen]    = useState(false)
  const [courseOptions, setCourseOptions] = useState<CourseOption[]>([])
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [changeSaving, setChangeSaving] = useState(false)
  const [changeError,  setChangeError]  = useState('')

  const [withdrawOpen,    setWithdrawOpen]    = useState(false)
  const [withdrawReason,  setWithdrawReason]  = useState('')
  const [withdrawNote,    setWithdrawNote]    = useState('')
  const [withdrawSaving,  setWithdrawSaving]  = useState(false)
  const [withdrawError,   setWithdrawError]   = useState('')

  const [licenses,        setLicenses]        = useState<License[]>([])
  const [licensesLoading, setLicensesLoading] = useState(true)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [cancelOpen,      setCancelOpen]      = useState(false)
  const [cancelLicenseId, setCancelLicenseId] = useState<number | null>(null)
  const [cancelNote,      setCancelNote]      = useState('')
  const [cancelSaving,    setCancelSaving]    = useState(false)
  const [cancelError,     setCancelError]     = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const currentRole = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}').role : ''
  // PARENT_CREATE: hoy permanente para SUPER_ADMIN, temporal para DIRECTOR
  // (ver DIRECTOR_TEMP_CAN_REGISTER_PARENTS en backend/src/config/permissions.ts).
  const canRegisterParent = currentRole === 'SUPER_ADMIN' || currentRole === 'DIRECTOR'
  // PARENT_ASSIGN_TUTOR: permiso permanente para los 3 (nunca dependió del
  // interruptor temporal) — cubre vincular padre existente y cambiar tutor.
  const canAssignTutor = ['SUPER_ADMIN', 'DIRECTOR', 'REGENTE', 'SECRETARY'].includes(currentRole)

  // ---- Registrar padre/tutor nuevo (solo cuando el estudiante no tiene ninguno) ----
  const [registerOpen,    setRegisterOpen]    = useState(false)
  const [registerForm,    setRegisterForm]    = useState(emptyRegisterForm)
  const [registerSaving,  setRegisterSaving]  = useState(false)
  const [registerError,   setRegisterError]   = useState('')
  const [registerCreds,   setRegisterCreds]   = useState<{ email: string; password: string } | null>(null)
  const [showRegisterCreds, setShowRegisterCreds] = useState(false)

  // ---- Vincular padre/tutor ya existente en el sistema (hermano, etc.) ----
  const [linkOpen,        setLinkOpen]        = useState(false)
  const [linkSearch,      setLinkSearch]      = useState('')
  const [linkResults,     setLinkResults]     = useState<ParentHit[]>([])
  const [linkSearching,   setLinkSearching]   = useState(false)
  const [linkSelectedId,  setLinkSelectedId]  = useState<number | null>(null)
  const [linkRelType,     setLinkRelType]     = useState('PADRE')
  const [linkSaving,      setLinkSaving]      = useState(false)
  const [linkError,       setLinkError]       = useState('')

  // ---- Cambiar tutor legal (promover a otro padre/tutor YA vinculado) ----
  const [tutorChangeTarget,  setTutorChangeTarget]  = useState<{ id: number; name: string } | null>(null)
  const [tutorChangeSaving,  setTutorChangeSaving]  = useState(false)
  const [tutorChangeError,   setTutorChangeError]   = useState('')

  const fetchStudent = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/students/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setStudent(data)
      else setError('Estudiante no encontrado')
    } catch { setError('Error de conexión') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchStudent() }, [id])

  const fetchLicenses = async () => {
    setLicensesLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/student-licenses/student/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setLicenses(data)
    } catch { /* silencioso — la tarjeta muestra "sin licencias" si queda vacío */ }
    finally { setLicensesLoading(false) }
  }

  useEffect(() => { fetchLicenses() }, [id])

  const fetchPendingRequests = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/student-license-requests/student/${id}/pending-count`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setPendingRequests(data.count)
    } catch { /* silencioso — el aviso simplemente no aparece */ }
  }

  useEffect(() => { fetchPendingRequests() }, [id])

  if (loading) return <div className="center"><div className="spinner"/></div>
  if (error)   return <div className="center"><p className="err-msg">{error}</p></div>
  if (!student) return null

  const activeCourse = student.assignments.find(a => a.academicYear.isActive)

  const openChangeCourse = async () => {
    if (!activeCourse) return
    setChangeError('')
    setSelectedCourseId('')
    setChangeOpen(true)
    setCoursesLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/courses`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const list: CourseOption[] = Array.isArray(data) ? data : (data.data || [])
      const c = activeCourse.course
      setCourseOptions(list.filter(opt =>
        opt.id !== c.id && opt.level === c.level && opt.grade === c.grade
        && opt.educationType === c.educationType && opt.shift === c.shift
      ))
    } catch { setChangeError('No se pudo cargar la lista de paralelos') }
    finally { setCoursesLoading(false) }
  }

  const submitChangeCourse = async () => {
    if (!selectedCourseId) return
    setChangeSaving(true)
    setChangeError('')
    try {
      const res  = await fetch(`${API_URL}/api/students/${id}/course`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ courseId: Number(selectedCourseId) }),
      })
      const data = await res.json()
      if (!res.ok) { setChangeError(data.message || 'No se pudo cambiar de curso'); return }
      setChangeOpen(false)
      await fetchStudent()
    } catch { setChangeError('Error de conexión') }
    finally { setChangeSaving(false) }
  }

  const openWithdraw = () => {
    setWithdrawReason(''); setWithdrawNote(''); setWithdrawError('')
    setWithdrawOpen(true)
  }

  const submitWithdraw = async () => {
    if (!withdrawReason) { setWithdrawError('Seleccioná un motivo'); return }
    setWithdrawSaving(true)
    setWithdrawError('')
    try {
      const res  = await fetch(`${API_URL}/api/students/${id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: withdrawReason, note: withdrawNote || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setWithdrawError(data.message || 'No se pudo dar de baja al estudiante'); return }
      setWithdrawOpen(false)
      await fetchStudent()
    } catch { setWithdrawError('Error de conexión') }
    finally { setWithdrawSaving(false) }
  }

  const openCancelLicense = (licenseId: number) => {
    setCancelLicenseId(licenseId); setCancelNote(''); setCancelError('')
    setCancelOpen(true)
  }

  const submitCancelLicense = async () => {
    if (!cancelNote.trim()) { setCancelError('La nota de anulación es requerida'); return }
    setCancelSaving(true)
    setCancelError('')
    try {
      const res  = await fetch(`${API_URL}/api/student-licenses/${cancelLicenseId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: cancelNote }),
      })
      const data = await res.json()
      if (!res.ok) { setCancelError(data.message || 'No se pudo anular la licencia'); return }
      setCancelOpen(false)
      await fetchLicenses()
    } catch { setCancelError('Error de conexión') }
    finally { setCancelSaving(false) }
  }

  const openRegister = () => {
    setRegisterForm(emptyRegisterForm); setRegisterError('')
    setRegisterOpen(true)
  }

  const submitRegister = async () => {
    if (!registerForm.firstName || !registerForm.lastName) { setRegisterError('Nombre y apellido son requeridos'); return }
    setRegisterError(''); setRegisterSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...registerForm,
          ci: registerForm.ci || undefined, phone: registerForm.phone || undefined,
          email: registerForm.email || undefined, address: registerForm.address || undefined,
          kardex: registerForm.kardex || undefined,
          studentIds: [Number(id)],
        }),
      })
      const data = await res.json()
      if (!res.ok) { setRegisterError(data.message || 'No se pudo registrar'); return }
      setRegisterOpen(false)
      await fetchStudent()
      if (data.accessEmail) {
        setRegisterCreds({ email: data.accessEmail, password: data.defaultPassword })
        setShowRegisterCreds(true)
      }
    } catch { setRegisterError('Error de conexión') }
    finally { setRegisterSaving(false) }
  }

  const openLinkExisting = () => {
    setLinkSearch(''); setLinkResults([]); setLinkSelectedId(null); setLinkRelType('PADRE'); setLinkError('')
    setLinkOpen(true)
  }

  const handleSearchParents = async () => {
    if (!linkSearch.trim()) return
    setLinkSearching(true)
    try {
      const params = new URLSearchParams({ search: linkSearch, page: '1', pageSize: '20' })
      const res  = await fetch(`${API_URL}/api/parents?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      const alreadyLinked = new Set(student?.parents.map(ps => ps.parent.id))
      setLinkResults(res.ok ? (data.data || []).filter((p: ParentHit) => !alreadyLinked.has(p.id)) : [])
    } catch { setLinkResults([]) }
    finally { setLinkSearching(false) }
  }

  const submitLinkExisting = async () => {
    if (!linkSelectedId) { setLinkError('Selecciona un padre/tutor'); return }
    setLinkError(''); setLinkSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/${linkSelectedId}/link-students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentIds: [Number(id)], relationType: linkRelType }),
      })
      const data = await res.json()
      if (!res.ok) { setLinkError(data.message || 'No se pudo vincular'); return }
      setLinkOpen(false)
      await fetchStudent()
    } catch { setLinkError('Error de conexión') }
    finally { setLinkSaving(false) }
  }

  const openChangeTutor = (parentId: number, name: string) => {
    setTutorChangeTarget({ id: parentId, name }); setTutorChangeError('')
  }

  const submitChangeTutor = async () => {
    if (!tutorChangeTarget) return
    setTutorChangeError(''); setTutorChangeSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents/student/${id}/change-tutor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newTutorId: tutorChangeTarget.id }),
      })
      const data = await res.json()
      if (!res.ok) { setTutorChangeError(data.message || 'No se pudo cambiar el tutor'); return }
      setTutorChangeTarget(null)
      await fetchStudent()
    } catch { setTutorChangeError('Error de conexión') }
    finally { setTutorChangeSaving(false) }
  }

  return (
    <div>
      <div className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="student-header">
          <div className="avatar">{student.firstName[0]}{student.lastName[0]}</div>
          <div>
            <h1>{student.lastName} {student.firstName}</h1>
            <div className="header-meta">
              <span className={`status-badge ${student.isActive ? 'act' : 'ina'}`}>
                {student.isActive ? 'Activo' : 'Inactivo'}
              </span>
              {activeCourse && (
                <span className="course-pill">
                  {LEVEL_LABELS[activeCourse.course.level]} {GRADE_LABELS[activeCourse.course.grade]} {activeCourse.course.parallel} · {SHIFT_LABELS[activeCourse.course.shift]}
                </span>
              )}
              {student.user && (
                <span className="access-pill">
                  <KeyRound size={11}/> Tiene acceso al sistema
                </span>
              )}
              {student.isActive && (
                <button className="withdraw-btn" onClick={openWithdraw}>Dar de baja</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-layout">
        <div className="card">
          <div className="card-title"><User size={15}/> Datos personales</div>
          <div className="data-grid">
            <div className="data-item">
              <span className="data-label"><CreditCard size={12}/> CI</span>
              <span className="data-value">{student.ci || '—'}</span>
            </div>
            <div className="data-item">
              <span className="data-label"><CreditCard size={12}/> RUDE</span>
              <span className="data-value">{student.rude || '—'}</span>
            </div>
            <div className="data-item">
              <span className="data-label"><Calendar size={12}/> Nacimiento</span>
              <span className="data-value">{formatDate(student.birthDate)} {calcAge(student.birthDate) && `(${calcAge(student.birthDate)})`}</span>
            </div>
            <div className="data-item">
              <span className="data-label"><Phone size={12}/> Teléfono</span>
              <span className="data-value">{student.phone || '—'}</span>
            </div>
            <div className="data-item">
              <span className="data-label"><Mail size={12}/> Correo personal</span>
              <span className="data-value">{student.email || '—'}</span>
            </div>
            <div className="data-item">
              <span className="data-label"><MapPin size={12}/> Dirección</span>
              <span className="data-value">{student.address || '—'}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><KeyRound size={15}/> Acceso al sistema</div>
          {student.user ? (
            <div className="access-box">
              <div className="access-row">
                <span className="data-label">Email de acceso</span>
                <span className="access-email">{student.user.email}</span>
              </div>
              <div className="access-row">
                <span className="data-label">Estado</span>
                <span className={`sbadge ${student.user.isActive ? 'act' : 'ina'}`}>
                  {student.user.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="access-hint">
                💡 Contraseña = RUDE del estudiante{student.rude ? ` (${student.rude})` : ' o primeras 4 letras del apellido + año'}
              </div>
            </div>
          ) : (
            <div className="no-access">
              <KeyRound size={24} color="#DCEEE6"/>
              <p>El estudiante no tiene acceso al sistema</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title"><GraduationCap size={15}/> Gestión actual</div>
          {activeCourse ? (
            <div className="course-box">
              <div className="course-big">
                {GRADE_LABELS[activeCourse.course.grade]} {activeCourse.course.parallel}
              </div>
              <div className="course-details">
                <span>{LEVEL_LABELS[activeCourse.course.level]}</span>
                <span>Turno {SHIFT_LABELS[activeCourse.course.shift]}</span>
                <span>{activeCourse.course.educationType}</span>
                <span>Gestión {activeCourse.year}</span>
              </div>
              <button className="change-course-btn" onClick={openChangeCourse}>
                <Repeat size={14}/> Cambiar de curso
              </button>
            </div>
          ) : (
            <div className="no-data">No inscrito en la gestión actual</div>
          )}
        </div>

        <div className="card card-full">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Users size={15}/> Padres y Tutores</span>
            {canAssignTutor && (
              <button className="link-parent-btn" onClick={openLinkExisting}>
                <UserPlus size={13}/> Vincular padre/tutor existente
              </button>
            )}
          </div>
          {student.parents.length === 0 ? (
            <div className="no-data">
              No hay padres/tutores registrados
              {canRegisterParent && (
                <button className="register-parent-btn" onClick={openRegister}>
                  <UserPlus size={14}/> Registrar padre/tutor
                </button>
              )}
            </div>
          ) : (
            <div className="parents-grid">
              {student.parents.map((ps, i) => (
                <div key={i} className={`parent-card ${ps.isTutor ? 'tutor' : ''}`}>
                  <div className="parent-top">
                    <span className="rel-badge" style={{ background: REL_COLORS[ps.relationType]+'18', color: REL_COLORS[ps.relationType] }}>
                      {REL_LABELS[ps.relationType]}
                    </span>
                    {ps.isTutor && <span className="tutor-icon">🔑 Tutor Legal</span>}
                  </div>
                  <div className="parent-name">{ps.parent.lastName} {ps.parent.firstName}</div>
                  <div className="parent-info">
                    {ps.parent.ci    && <span><CreditCard size={11}/> {ps.parent.ci}</span>}
                    {ps.parent.phone && <span><Phone size={11}/> {ps.parent.phone}</span>}
                    {ps.parent.email && <span><Mail size={11}/> {ps.parent.email}</span>}
                  </div>
                  {!ps.isTutor && canAssignTutor && (
                    <button
                      className="make-tutor-btn"
                      onClick={() => openChangeTutor(ps.parent.id, `${ps.parent.lastName} ${ps.parent.firstName}`)}
                    >
                      <Star size={11}/> Hacer tutor legal
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-full">
          <div className="card-title"><BookOpen size={15}/> Historial académico</div>
          {student.assignments.length === 0 ? (
            <div className="no-data">Sin historial de inscripciones</div>
          ) : (
            <table>
              <thead>
                <tr><th>Gestión</th><th>Nivel</th><th>Curso</th><th>Turno</th><th>Tipo</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {student.assignments.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.year}</strong></td>
                    <td className="muted">{LEVEL_LABELS[a.course.level]}</td>
                    <td><strong>{GRADE_LABELS[a.course.grade]} {a.course.parallel}</strong></td>
                    <td className="muted">{SHIFT_LABELS[a.course.shift]}</td>
                    <td className="muted">{a.educationType}</td>
                    <td>
                      {a.academicYear.isActive
                        ? <span className="sbadge act">Activa</span>
                        : <span className="sbadge ina">Anterior</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card card-full">
          <div className="card-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={15}/> Licencias</span>
            {pendingRequests > 0 && (
              <Link href="/dashboard/admin/licencias" className="pending-request-pill">
                {pendingRequests} solicitud{pendingRequests > 1 ? 'es' : ''} pendiente{pendingRequests > 1 ? 's' : ''}
              </Link>
            )}
          </div>
          {licensesLoading ? (
            <div className="center" style={{ padding: 16 }}><div className="spinner"/></div>
          ) : licenses.length === 0 ? (
            <div className="no-data">Sin licencias registradas</div>
          ) : (
            <table>
              <thead>
                <tr><th>Inicio</th><th>Fin</th><th>Motivo</th><th>Registrada por</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {licenses.map(l => {
                  const today = new Date().toISOString().slice(0, 10)
                  const start = l.startDate.slice(0, 10)
                  const end = l.endDate.slice(0, 10)
                  const status = l.cancelledAt ? 'CANCELADA' : end < today ? 'FINALIZADA' : 'ACTIVA'
                  return (
                    <tr key={l.id}>
                      <td>{formatDate(start)}</td>
                      <td>{formatDate(end)}</td>
                      <td className="muted">{l.reason || '—'}</td>
                      <td className="muted">{l.createdByName || '—'}</td>
                      <td>
                        {status === 'ACTIVA' && <span className="sbadge act">Activa</span>}
                        {status === 'FINALIZADA' && <span className="sbadge ina">Finalizada</span>}
                        {status === 'CANCELADA' && <span className="sbadge cancelada" title={l.cancelledNote ? `${l.cancelledByName}: ${l.cancelledNote}` : undefined}>Cancelada</span>}
                      </td>
                      <td>
                        {!l.cancelledAt && (
                          <button className="cancel-license-btn" onClick={() => openCancelLicense(l.id)}>Anular</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {changeOpen && activeCourse && (
        <div className="modal-backdrop" onClick={() => !changeSaving && setChangeOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Cambiar de curso</h3>
              <button className="modal-close" onClick={() => setChangeOpen(false)} disabled={changeSaving}><X size={16}/></button>
            </div>
            <p className="modal-sub">
              Curso actual: <strong>{GRADE_LABELS[activeCourse.course.grade]} {activeCourse.course.parallel}</strong> ({LEVEL_LABELS[activeCourse.course.level]}, {SHIFT_LABELS[activeCourse.course.shift]})
            </p>
            <p className="modal-hint">
              El historial de asistencia y notas ya registrado queda intacto en el curso actual. Desde el momento del cambio, todo lo nuevo se registra en el curso elegido.
            </p>

            {coursesLoading ? (
              <div className="center" style={{ padding: 16 }}><div className="spinner"/></div>
            ) : courseOptions.length === 0 ? (
              <div className="no-data">No hay otros paralelos del mismo grado, nivel y turno en este colegio.</div>
            ) : (
              <select className="course-select" value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}>
                <option value="">Seleccioná el curso nuevo…</option>
                {courseOptions.map(c => (
                  <option key={c.id} value={c.id}>{GRADE_LABELS[c.grade]} {c.parallel}</option>
                ))}
              </select>
            )}

            {changeError && <p className="modal-error">{changeError}</p>}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setChangeOpen(false)} disabled={changeSaving}>Cancelar</button>
              <button className="modal-confirm" onClick={submitChangeCourse} disabled={!selectedCourseId || changeSaving}>
                {changeSaving ? 'Guardando…' : 'Confirmar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {withdrawOpen && (
        <div className="modal-backdrop" onClick={() => !withdrawSaving && setWithdrawOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Dar de baja</h3>
              <button className="modal-close" onClick={() => setWithdrawOpen(false)} disabled={withdrawSaving}><X size={16}/></button>
            </div>
            <p className="modal-sub">
              Estudiante: <strong>{student.lastName} {student.firstName}</strong>
            </p>
            <p className="modal-hint">
              El historial de asistencia y notas ya registrado queda intacto. El estudiante sale de su curso actual y, si tiene acceso al sistema, se le bloquea el ingreso.
            </p>

            <select className="course-select" value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)}>
              <option value="">Motivo de la baja…</option>
              <option value="TRASLADO">Traslado a otra Unidad Educativa</option>
              <option value="RETIRO_VOLUNTARIO">Retiro voluntario</option>
              <option value="OTRO">Otro</option>
            </select>
            <textarea
              className="withdraw-note" value={withdrawNote} onChange={e => setWithdrawNote(e.target.value)}
              rows={3} placeholder="Nota adicional (opcional)"
            />

            {withdrawError && <p className="modal-error">{withdrawError}</p>}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setWithdrawOpen(false)} disabled={withdrawSaving}>Cancelar</button>
              <button className="modal-confirm danger" onClick={submitWithdraw} disabled={!withdrawReason || withdrawSaving}>
                {withdrawSaving ? 'Guardando…' : 'Confirmar baja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelOpen && (
        <div className="modal-backdrop" onClick={() => !cancelSaving && setCancelOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Anular licencia</h3>
              <button className="modal-close" onClick={() => setCancelOpen(false)} disabled={cancelSaving}><X size={16}/></button>
            </div>
            <p className="modal-hint">
              El registro no se borra — queda marcado como cancelado, con quién y cuándo lo anuló. Si tapaba el estado real de algún día, el maestro vuelve a ver el estado real (o "sin registrar") de inmediato.
            </p>
            <textarea
              className="withdraw-note" value={cancelNote} onChange={e => setCancelNote(e.target.value)}
              rows={3} placeholder="Motivo de la anulación (requerido)"
            />
            {cancelError && <p className="modal-error">{cancelError}</p>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setCancelOpen(false)} disabled={cancelSaving}>Cerrar</button>
              <button className="modal-confirm danger" onClick={submitCancelLicense} disabled={!cancelNote.trim() || cancelSaving}>
                {cancelSaving ? 'Guardando…' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {registerOpen && (
        <div className="modal-backdrop" onClick={() => !registerSaving && setRegisterOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Registrar padre/tutor</h3>
              <button className="modal-close" onClick={() => setRegisterOpen(false)} disabled={registerSaving}><X size={16}/></button>
            </div>
            <p className="modal-sub">
              Para: <strong>{student.lastName} {student.firstName}</strong>
            </p>

            {registerError && <p className="modal-error">{registerError}</p>}

            <div className="form-row-2">
              <input className="text-input" placeholder="Nombres *" value={registerForm.firstName} onChange={e => setRegisterForm({ ...registerForm, firstName: e.target.value })} />
              <input className="text-input" placeholder="Apellidos *" value={registerForm.lastName} onChange={e => setRegisterForm({ ...registerForm, lastName: e.target.value })} />
            </div>
            <div className="form-row-2">
              <input className="text-input" placeholder="CI" value={registerForm.ci} onChange={e => setRegisterForm({ ...registerForm, ci: e.target.value })} />
              <input className="text-input" placeholder="Teléfono" value={registerForm.phone} onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })} />
            </div>
            <input className="text-input" placeholder="Correo (opcional, para acceso propio)" type="email" value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} />
            <input className="text-input" placeholder="N° Kardex (opcional, se asigna solo si se deja vacío)" value={registerForm.kardex} onChange={e => setRegisterForm({ ...registerForm, kardex: e.target.value })} />

            <select className="course-select" value={registerForm.relationType} onChange={e => setRegisterForm({ ...registerForm, relationType: e.target.value })}>
              {RELATION_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <label className="checkbox-row">
              <input type="checkbox" checked={registerForm.isTutor} onChange={e => setRegisterForm({ ...registerForm, isTutor: e.target.checked })} />
              Marcar como tutor legal
            </label>
            {registerForm.isTutor && (
              <p className="modal-hint">Como Tutor legal, se le genera automáticamente una cuenta de acceso al sistema.</p>
            )}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setRegisterOpen(false)} disabled={registerSaving}>Cancelar</button>
              <button className="modal-confirm" onClick={submitRegister} disabled={registerSaving}>
                {registerSaving ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegisterCreds && registerCreds && (
        <div className="modal-backdrop" onClick={() => setShowRegisterCreds(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>✅ Padre/tutor registrado</h3>
              <button className="modal-close" onClick={() => setShowRegisterCreds(false)}><X size={16}/></button>
            </div>
            <p className="modal-hint">
              <Check size={13} style={{ verticalAlign: 'middle', marginRight: 4 }}/>
              Se generó una cuenta de acceso. Anota estas credenciales — es la única vez que se muestran.
            </p>
            <div className="creds-row"><span>Email</span><strong>{registerCreds.email}</strong></div>
            <div className="creds-row"><span>Contraseña</span><strong>{registerCreds.password}</strong></div>
            <div className="modal-actions">
              <button className="modal-confirm" onClick={() => setShowRegisterCreds(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {linkOpen && (
        <div className="modal-backdrop" onClick={() => !linkSaving && setLinkOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Vincular padre/tutor existente</h3>
              <button className="modal-close" onClick={() => setLinkOpen(false)} disabled={linkSaving}><X size={16}/></button>
            </div>
            <p className="modal-sub">
              Para: <strong>{student.lastName} {student.firstName}</strong>
            </p>
            <p className="modal-hint">Usá esto cuando el padre/tutor ya está registrado en el sistema (por ejemplo, ya tiene otro hijo inscrito) — no crea una persona nueva.</p>

            {linkError && <p className="modal-error">{linkError}</p>}

            <div className="search-row">
              <input
                className="text-input" placeholder="Buscar por nombre o CI…" value={linkSearch}
                onChange={e => setLinkSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchParents() } }}
              />
              <button className="search-btn" onClick={handleSearchParents} disabled={linkSearching}><Search size={14}/></button>
            </div>

            <div className="search-results">
              {linkResults.map(p => (
                <label key={p.id} className={`search-item ${linkSelectedId === p.id ? 'selected' : ''}`}>
                  <input type="radio" name="linkParent" checked={linkSelectedId === p.id} onChange={() => setLinkSelectedId(p.id)} />
                  <span className="parent-name">{p.lastName} {p.firstName}</span>
                  {p.ci && <span className="muted">CI: {p.ci}</span>}
                </label>
              ))}
              {linkResults.length === 0 && (
                <p className="no-data">Buscá un padre/tutor para vincularlo</p>
              )}
            </div>

            <select className="course-select" value={linkRelType} onChange={e => setLinkRelType(e.target.value)}>
              {RELATION_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setLinkOpen(false)} disabled={linkSaving}>Cancelar</button>
              <button className="modal-confirm" onClick={submitLinkExisting} disabled={!linkSelectedId || linkSaving}>
                {linkSaving ? 'Vinculando…' : 'Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tutorChangeTarget && (
        <div className="modal-backdrop" onClick={() => !tutorChangeSaving && setTutorChangeTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Cambiar tutor legal</h3>
              <button className="modal-close" onClick={() => setTutorChangeTarget(null)} disabled={tutorChangeSaving}><X size={16}/></button>
            </div>
            <p className="modal-sub">
              ¿Confirmás que <strong>{tutorChangeTarget.name}</strong> pase a ser el Tutor Legal de {student.lastName} {student.firstName}?
            </p>
            <p className="modal-hint">El tutor legal actual deja de serlo (conserva su relación real — Padre/Madre/Otro — solo cambia quién tiene la responsabilidad de tutor).</p>

            {tutorChangeError && <p className="modal-error">{tutorChangeError}</p>}

            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setTutorChangeTarget(null)} disabled={tutorChangeSaving}>Cancelar</button>
              <button className="modal-confirm" onClick={submitChangeTutor} disabled={tutorChangeSaving}>
                {tutorChangeSaving ? 'Guardando…' : 'Confirmar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .center{display:flex;justify-content:center;align-items:center;padding:48px}
        .err-msg{color:#C0392B;font-size:14px}
        .page-header{margin-bottom:24px;display:flex;flex-direction:column;gap:12px}
        .back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6B8F7F;font-size:13px;padding:0;width:fit-content}
        .back-btn:hover{color:#0A5A45}
        .student-header{display:flex;align-items:center;gap:16px}
        .avatar{width:56px;height:56px;border-radius:50%;background:#0A5A45;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;flex-shrink:0}
        .student-header h1{font-size:22px;font-weight:800;color:#0A5A45;margin-bottom:6px}
        .header-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .status-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
        .status-badge.act{background:#E1F5EE;color:#0F6E56}
        .status-badge.ina{background:#FFF0F0;color:#C0392B}
        .course-pill{background:#E0ECF8;color:#0A5A45;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500}
        .access-pill{background:#E1F5EE;color:#0F6E56;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;display:flex;align-items:center;gap:4px}
        .grid-layout{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .card{background:#fff;border:1px solid #DCEEE6;border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:14px}
        .card-full{grid-column:1/-1}
        .card-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#0A5A45;padding-bottom:10px;border-bottom:1px solid #F5FAF7}
        .data-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .data-item{display:flex;flex-direction:column;gap:3px}
        .data-label{display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:#6B8F7F;text-transform:uppercase;letter-spacing:.5px}
        .data-value{font-size:13px;color:#0A5A45;font-weight:500}
        .access-box{display:flex;flex-direction:column;gap:10px}
        .access-row{display:flex;flex-direction:column;gap:3px}
        .access-email{font-size:13px;font-weight:600;color:#0A5A45;font-family:monospace;word-break:break-all}
        .access-hint{font-size:11px;color:#0F6E56;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:8px;padding:8px;line-height:1.5}
        .no-access{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;color:#6B8F7F;font-size:12px;text-align:center}
        .course-box{display:flex;flex-direction:column;gap:8px}
        .course-big{font-size:36px;font-weight:800;color:#0A5A45}
        .course-details{display:flex;flex-wrap:wrap;gap:8px}
        .course-details span{background:#F5FAF7;color:#0A5A45;padding:3px 10px;border-radius:20px;font-size:12px}
        .no-data{color:#6B8F7F;font-size:13px;padding:12px 0;font-style:italic;display:flex;flex-direction:column;align-items:flex-start;gap:10px}
        .link-parent-btn{display:flex;align-items:center;gap:6px;background:#F5FAF7;border:1px solid #DCEEE6;color:#0A5A45;font-size:11px;font-weight:600;padding:6px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}
        .link-parent-btn:hover{background:#E1F5EE}
        .register-parent-btn{display:flex;align-items:center;gap:6px;background:#0A5A45;border:none;color:#fff;font-size:12px;font-weight:600;padding:8px 14px;border-radius:8px;cursor:pointer;font-style:normal}
        .register-parent-btn:hover{background:#0F6E56}
        .make-tutor-btn{display:flex;align-items:center;gap:5px;background:#FFFDF0;border:1px solid #F5E1A0;color:#7A6000;font-size:10.5px;font-weight:600;padding:5px 9px;border-radius:8px;cursor:pointer;width:fit-content}
        .make-tutor-btn:hover{background:#FFF7E0}
        .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .text-input{width:100%;padding:10px 12px;border:1px solid #DCEEE6;border-radius:8px;font-size:13px;color:#0A5A45;background:#fff;font-family:inherit}
        .checkbox-row{display:flex;align-items:center;gap:8px;font-size:13px;color:#0A5A45;cursor:pointer}
        .creds-row{display:flex;align-items:center;gap:10px;background:#F5FAF7;border:1px solid #DCEEE6;border-radius:8px;padding:10px 12px;font-size:12px}
        .creds-row span{color:#6B8F7F;min-width:80px;text-transform:uppercase;font-size:10px;font-weight:700}
        .creds-row strong{color:#0A5A45;font-family:monospace;word-break:break-all}
        .search-row{display:flex;gap:8px}
        .search-btn{background:#0A5A45;border:none;color:#fff;padding:0 14px;border-radius:8px;cursor:pointer;display:flex;align-items:center}
        .search-results{display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto}
        .search-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:#F5FAF7;font-size:13px;color:#0A5A45;cursor:pointer}
        .search-item.selected{background:#E1F5EE;outline:1px solid #9FE1CB}
        .search-item .muted{color:#6B8F7F;font-size:11px}
        .change-course-btn{display:flex;align-items:center;gap:6px;justify-content:center;background:#F5FAF7;border:1px solid #DCEEE6;color:#0A5A45;font-size:12px;font-weight:600;padding:8px 12px;border-radius:8px;cursor:pointer;width:fit-content}
        .change-course-btn:hover{background:#E1F5EE}
        .modal-backdrop{position:fixed;inset:0;background:rgba(10,30,25,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px}
        .modal-box{background:#fff;border-radius:14px;padding:22px;width:100%;max-width:420px;display:flex;flex-direction:column;gap:14px;max-height:90vh;overflow-y:auto}
        .modal-head{display:flex;align-items:center;justify-content:space-between}
        .modal-head h3{font-size:16px;font-weight:700;color:#0A5A45}
        .modal-close{background:none;border:none;cursor:pointer;color:#6B8F7F;padding:4px}
        .modal-close:hover{color:#0A5A45}
        .modal-sub{font-size:13px;color:#0A5A45}
        .modal-hint{font-size:12px;color:#6B8F7F;background:#F5FAF7;border-radius:8px;padding:10px;line-height:1.5}
        .course-select{width:100%;padding:10px 12px;border:1px solid #DCEEE6;border-radius:8px;font-size:13px;color:#0A5A45;background:#fff}
        .modal-error{color:#C0392B;font-size:12px;background:#FFF0F0;border-radius:8px;padding:8px 10px}
        .modal-actions{display:flex;justify-content:flex-end;gap:10px}
        .modal-cancel{background:none;border:1px solid #DCEEE6;color:#6B8F7F;font-size:13px;font-weight:600;padding:9px 16px;border-radius:8px;cursor:pointer}
        .modal-confirm{background:#0A5A45;border:none;color:#fff;font-size:13px;font-weight:600;padding:9px 16px;border-radius:8px;cursor:pointer}
        .modal-confirm:disabled{opacity:.5;cursor:not-allowed}
        .modal-confirm.danger{background:#C0392B}
        .withdraw-btn{background:#FFF0F0;color:#C0392B;border:1px solid #F5C6C6;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;cursor:pointer}
        .withdraw-btn:hover{background:#FFE1E1}
        .withdraw-note{width:100%;padding:10px 12px;border:1px solid #DCEEE6;border-radius:8px;font-size:13px;color:#0A5A45;background:#fff;resize:none;font-family:inherit}
        .parents-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
        .parent-card{background:#F8FBFF;border:1px solid #DCEEE6;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:8px}
        .parent-card.tutor{border-color:#F5C518;background:#FFFDF0}
        .parent-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px}
        .rel-badge{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
        .tutor-icon{font-size:11px;color:#7A6000}
        .parent-name{font-size:14px;font-weight:700;color:#0A5A45}
        .parent-info{display:flex;flex-direction:column;gap:4px}
        .parent-info span{display:flex;align-items:center;gap:5px;font-size:11px;color:#6B8F7F}
        table{width:100%;border-collapse:collapse}
        thead tr{background:#F5FAF7}
        th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#0A5A45;text-transform:uppercase;letter-spacing:.5px}
        td{padding:11px 14px;font-size:13px;color:#0A5A45;border-top:1px solid #F5FAF7}
        tr:hover td{background:#FAFCFF}
        .muted{color:#6B8F7F}
        .sbadge{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:500}
        .sbadge.act{background:#E1F5EE;color:#0F6E56}
        .sbadge.ina{background:#F5FAF7;color:#6B8F7F}
        .sbadge.cancelada{background:#FFF0F0;color:#C0392B;cursor:help}
        .cancel-license-btn{background:#FFF0F0;color:#C0392B;border:1px solid #F5C6C6;font-size:11px;font-weight:600;padding:4px 10px;border-radius:8px;cursor:pointer}
        .cancel-license-btn:hover{background:#FFE1E1}
        .pending-request-pill{background:#FFF7E0;color:#7A6000;border:1px solid #F5E1A0;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;text-decoration:none;white-space:nowrap}
        .pending-request-pill:hover{background:#FFF0C6}
        .spinner{width:24px;height:24px;border:2px solid rgba(10,90,69,.2);border-top-color:#0A5A45;border-radius:50%;animation:spin .7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:700px){.grid-layout{grid-template-columns:1fr}.data-grid{grid-template-columns:1fr}}
      `}</style>
    </div>
  )
}