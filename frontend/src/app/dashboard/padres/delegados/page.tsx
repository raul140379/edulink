'use client'

import { useEffect, useState } from 'react'
import { Users, Check, UserPlus, UserMinus, BookOpen, RefreshCw, Copy } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Select } from '@/components/ui/Input'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Course {
  id:            number
  level:         string
  grade:         string
  parallel:      string
  educationType: string
  shift:         string
  delegateId:    number | null
  delegate: {
    id:             number
    firstName:      string
    lastName:       string
    ci?:            string
    phone?:         string
    delegateUserId?: number
    delegateUser?:  { id: number; email: string; role: string; isActive: boolean }
    user?:          { id: number; email: string; role: string; isActive: boolean }
  } | null
  tutor: {
    teacher: { id: number; firstName: string; lastName: string }
  } | null
  _count: { assignments: number }
}

interface EligibleParent {
  id:           number
  firstName:    string
  lastName:     string
  ci?:          string
  phone?:       string
  relationType: string
  studentName:  string
  delegateUserId?: number
  delegateUser?:   { email: string; role: string }
  user?:           { email: string; role: string }
}

interface Credentials {
  accessEmail:     string
  defaultPassword: string
  delegateName:    string
  courseLabel:     string
}

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°'
}
const LEVEL_LABELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria'
}
const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche'
}
const LEVEL_TONE: Record<string, 'success' | 'brand' | 'warning'> = {
  INICIAL: 'success', PRIMARIA: 'brand', SECUNDARIA: 'warning'
}

export default function DelegadosPage() {
  const confirm = useConfirm()
  const toast   = useToast()
  const [courses,         setCourses]         = useState<Course[]>([])
  const [loading,         setLoading]         = useState(true)
  const [showModal,       setShowModal]       = useState(false)
  const [selectedCourse,  setSelectedCourse]  = useState<Course | null>(null)
  const [eligibleParents, setEligibleParents] = useState<EligibleParent[]>([])
  const [loadingParents,  setLoadingParents]  = useState(false)
  const [selectedParent,  setSelectedParent]  = useState<number | null>(null)
  const [saving,          setSaving]          = useState(false)
  const [filterLevel,     setFilterLevel]     = useState('')
  const [working,         setWorking]         = useState<number | null>(null)
  const [creds,           setCreds]           = useState<Credentials | null>(null)
  const [copied,          setCopied]          = useState(false)
  // Solo el Presidente puede asignar/quitar/resetear — el resto de la
  // directiva puede ver la lista (misma regla que ya aplica el backend en
  // delegateService.assignDelegate/removeDelegate).
  const [isPresidente, setIsPresidente] = useState(false)

  const fetchCourses = async () => {
    const token = localStorage.getItem('token')
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/delegates`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setCourses(data)
      else toast('Error al cargar cursos', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  useEffect(() => {
    fetchCourses()
    const token = localStorage.getItem('token')
    fetch(`${API_URL}/api/junta/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => setIsPresidente(data?.juntaRole === 'PRESIDENTE'))
      .catch(() => {})
  }, [])

  const openAssignModal = async (course: Course) => {
    const token = localStorage.getItem('token')
    setSelectedCourse(course)
    setSelectedParent(null)
    setShowModal(true)
    setLoadingParents(true)
    try {
      const res  = await fetch(`${API_URL}/api/delegates/course/${course.id}/eligible-parents`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setEligibleParents(data)
      else toast('Error al cargar padres elegibles', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoadingParents(false) }
  }

  const handleAssign = async () => {
    if (!selectedParent || !selectedCourse) return
    const token = localStorage.getItem('token')
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/delegates/course/${selectedCourse.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ parentId: selectedParent }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setShowModal(false)
      fetchCourses()
      if (data.accessEmail) {
        setCreds({
          accessEmail:     data.accessEmail,
          defaultPassword: data.defaultPassword,
          delegateName:    data.delegateName,
          courseLabel:     `${GRADE_LABELS[selectedCourse.grade]} "${selectedCourse.parallel}" ${SHIFT_LABELS[selectedCourse.shift]}`,
        })
      } else {
        toast(data.message, 'success')
      }
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleRemove = async (course: Course) => {
    if (!await confirm(`¿Quitar al delegado de ${GRADE_LABELS[course.grade]} "${course.parallel}"?`, { danger: true })) return
    const token = localStorage.getItem('token')
    try {
      const res  = await fetch(`${API_URL}/api/delegates/course/${course.id}/remove`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchCourses() }
      else toast(data.message, 'error')
    } catch { toast('Error al remover delegado', 'error') }
  }

  const handleResetPassword = async (course: Course) => {
    if (!await confirm(`¿Resetear la contraseña del delegado de ${GRADE_LABELS[course.grade]} "${course.parallel}"?`)) return
    const token = localStorage.getItem('token')
    setWorking(course.id)
    try {
      const res  = await fetch(`${API_URL}/api/courses/${course.id}/delegate-user/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      setCreds({
        accessEmail:     course.delegate?.delegateUser?.email || '',
        defaultPassword: data.defaultPassword,
        delegateName:    data.delegateName,
        courseLabel:     `${GRADE_LABELS[course.grade]} "${course.parallel}" ${SHIFT_LABELS[course.shift]}`,
      })
    } catch { toast('Error de conexión', 'error') }
    finally  { setWorking(null) }
  }

  const copyCreds = () => {
    if (!creds) return
    navigator.clipboard.writeText(
      `Delegado: ${creds.delegateName}\nCurso: ${creds.courseLabel}\nEmail: ${creds.accessEmail}\nContraseña: ${creds.defaultPassword}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filtered = filterLevel ? courses.filter(c => c.level === filterLevel) : courses
  const grouped  = filtered.reduce((acc, c) => {
    if (!acc[c.level]) acc[c.level] = []
    acc[c.level].push(c)
    return acc
  }, {} as Record<string, Course[]>)

  const withDelegate    = courses.filter(c => c.delegateId).length
  const withoutDelegate = courses.filter(c => !c.delegateId).length

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Delegados de Curso</h1>
          <p className="text-[13px] text-neutral-500">Asignación y gestión de usuarios para delegados</p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge tone="success"><Check size={12}/> {withDelegate} asignados</Badge>
          <Badge tone="danger"><Users size={12}/> {withoutDelegate} sin delegado</Badge>
        </div>
      </div>

      <div className="mb-4">
        <Select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="w-auto">
          <option value="">Todos los niveles</option>
          <option value="INICIAL">Inicial</option>
          <option value="PRIMARIA">Primaria</option>
          <option value="SECUNDARIA">Secundaria</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : courses.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-neutral-500">
          <BookOpen size={40} className="text-neutral-300"/>
          <p className="text-[13px]">No hay cursos registrados</p>
        </Card>
      ) : (
        Object.entries(grouped).map(([level, list]) => (
          <div key={level} className="mb-5">
            <Card className="flex items-center justify-between mb-3">
              <Badge tone={LEVEL_TONE[level] || 'neutral'}>{LEVEL_LABELS[level]}</Badge>
              <span className="text-xs text-neutral-500">{list.length} cursos</span>
            </Card>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {list.map(c => {
                const isWorking   = working === c.id
                const hasDelegate = !!c.delegateId

                return (
                  <Card key={c.id} className={`flex flex-col gap-2.5 ${hasDelegate ? '!border-success-500/40' : '!border-danger-500/40'}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-extrabold text-brand-700">{GRADE_LABELS[c.grade]} {c.parallel}</div>
                      <div className="flex gap-1">
                        <Badge tone="brand">{SHIFT_LABELS[c.shift]}</Badge>
                        {c.educationType === 'BTH' && <Badge tone="warning">BTH</Badge>}
                      </div>
                    </div>

                    <div className="text-[11px] text-neutral-500 flex items-center gap-1"><Users size={11}/> {c._count.assignments} estudiantes</div>

                    <div className="bg-neutral-100/60 border border-neutral-300 rounded-lg p-2.5">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1">Delegado:</div>
                      {c.delegate ? (
                        <div>
                          <div className="text-[13px] font-semibold text-brand-700">{c.delegate.lastName} {c.delegate.firstName}</div>
                          {c.delegate.ci && <div className="text-[11px] text-neutral-500 mt-0.5">CI: {c.delegate.ci}</div>}
                          {c.delegate.phone && <div className="text-[11px] text-neutral-500 mt-0.5">📱 {c.delegate.phone}</div>}
                          {c.delegate.delegateUser ? (
                            <div className="mt-1 flex flex-col gap-0.5">
                              <span className="text-[10px] text-success-700">✅ Usuario delegado activo</span>
                              <div className="text-[10px] text-neutral-500 font-mono">{c.delegate.delegateUser.email}</div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-danger-600">❌ Sin usuario delegado</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-danger-600 italic">Sin delegado asignado</div>
                      )}
                    </div>

                    {c.tutor && (
                      <div className="bg-warning-100 border border-warning-500 rounded-lg p-2">
                        <div className="text-[10px] font-bold text-[#7A6000] uppercase tracking-wide mb-0.5">Maestro tutor:</div>
                        <div className="text-xs font-medium text-[#7A6000]">{c.tutor.teacher.lastName} {c.tutor.teacher.firstName}</div>
                      </div>
                    )}

                    {isPresidente && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        {hasDelegate ? (
                          <>
                            {c.delegate?.delegateUserId && (
                              <Button variant="secondary" size="sm" onClick={() => handleResetPassword(c)} loading={isWorking} className="justify-center">
                                {!isWorking && <RefreshCw size={13}/>} Resetear password
                              </Button>
                            )}
                            <Button variant="danger" size="sm" onClick={() => handleRemove(c)} className="justify-center">
                              <UserMinus size={13}/> Quitar delegado
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => openAssignModal(c)} className="justify-center">
                            <UserPlus size={13}/> Asignar delegado
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal asignar delegado */}
      <Modal
        open={showModal && !!selectedCourse} onClose={() => setShowModal(false)} title="Asignar Delegado"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selectedParent} loading={saving}>
              {!saving && <UserPlus size={14}/>}
              {saving ? 'Asignando...' : 'Confirmar asignación'}
            </Button>
          </>
        }
      >
        {selectedCourse && (
          <div className="flex flex-col gap-3.5">
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-[13px] text-neutral-500">
              Curso: <strong className="text-brand-700">{LEVEL_LABELS[selectedCourse.level]} — {GRADE_LABELS[selectedCourse.grade]} {selectedCourse.parallel} · {SHIFT_LABELS[selectedCourse.shift]}</strong>
            </div>
            <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-100">Selecciona un padre del curso</div>
            {loadingParents ? (
              <div className="flex justify-center py-8"><p className="text-sm text-neutral-500">Cargando...</p></div>
            ) : eligibleParents.length === 0 ? (
              <p className="text-[13px] text-neutral-500 italic py-2">No hay padres registrados en este curso para la gestión activa.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                {eligibleParents.map(p => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-2.5 p-3 border-2 rounded-lg cursor-pointer transition-colors ${selectedParent === p.id ? 'border-success-500 bg-success-100' : 'border-neutral-300 hover:bg-neutral-100'}`}
                  >
                    <input
                      type="radio" name="parent" value={p.id} className="mt-1 shrink-0 accent-[var(--color-success-500)]"
                      checked={selectedParent === p.id} onChange={() => setSelectedParent(p.id)}
                    />
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[13px] font-semibold text-brand-700">{p.lastName} {p.firstName}</div>
                      <div className="flex gap-2.5 text-[11px] text-neutral-500 flex-wrap">
                        {p.ci && <span>CI: {p.ci}</span>}
                        {p.phone && <span>📱 {p.phone}</span>}
                        <span className="text-info-500 font-medium">Hijo/a: {p.studentName}</span>
                      </div>
                      {p.delegateUser && <div className="text-[11px] text-[#BA7517] font-medium">⚠️ Ya tiene usuario delegado</div>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal credenciales */}
      <Modal
        open={!!creds} onClose={() => setCreds(null)} title="✅ Credenciales de acceso"
        footer={
          <>
            <Button variant="secondary" onClick={copyCreds}>
              {copied ? <Check size={14}/> : <Copy size={14}/>}
              {copied ? 'Copiado' : 'Copiar credenciales'}
            </Button>
            <Button onClick={() => setCreds(null)}>Entendido</Button>
          </>
        }
      >
        {creds && (
          <div className="flex flex-col gap-3">
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-sm text-brand-700">
              <strong>{creds.delegateName}</strong> — {creds.courseLabel}
            </div>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono break-all">{creds.accessEmail}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono break-all">{creds.defaultPassword}</span>
            </div>
            <div className="text-xs text-[#BA7517] bg-warning-100 border border-warning-500 rounded-lg p-2.5 leading-relaxed">
              ⚠️ Anota estas credenciales. El delegado puede cambiar su contraseña desde su perfil.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
