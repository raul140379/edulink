'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Users, CheckCircle, AlertCircle, DollarSign, Trash2, ScanLine } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
}

interface Attendance {
  id:       number
  parentId: number
  present:  boolean
  note?:    string
  parent:   Parent
}

interface Meeting {
  id:          number
  title:       string
  date:        string
  attendances: Attendance[]
}

interface AcademicYear {
  id: number; year: number; isActive: boolean
}

interface CourseOption { id: number; level: string; grade: string; parallel: string; shift: string }

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

function courseLabel(c: CourseOption) {
  return `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}" · ${SHIFT_LABELS[c.shift] || c.shift}`
}

export default function JuntaView() {
  const confirm = useConfirm()
  const toast   = useToast()

  const [isPresidente, setIsPresidente] = useState(false)

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  useEffect(() => {
    fetch(`${API_URL}/api/junta/me`, { headers: auth() })
      .then(r => r.ok ? r.json() : null)
      .then(data => setIsPresidente(data?.juntaRole === 'PRESIDENTE'))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Reuniones por curso ----
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [saving, setSaving] = useState(false)

  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ title: '', date: '' })

  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null)
  const [attendanceState, setAttendanceState] = useState<Record<number, boolean>>({})

  const [showChargeModal, setShowChargeModal] = useState(false)
  const [chargeForm, setChargeForm] = useState({ amount: '20', academicYearId: '' })

  useEffect(() => {
    const fetchInit = async () => {
      try {
        const [cRes, yRes] = await Promise.all([
          fetch(`${API_URL}/api/courses`, { headers: auth() }),
          fetch(`${API_URL}/api/academic`, { headers: auth() }),
        ])
        const [cData, yData] = await Promise.all([cRes.json(), yRes.json()])
        if (cRes.ok) setCourses(cData)
        if (yRes.ok) {
          setAcademicYears(yData)
          const active = yData.find((y: AcademicYear) => y.isActive)
          if (active) setChargeForm(f => ({ ...f, academicYearId: String(active.id) }))
        }
      } catch { toast('Error de conexión', 'error') }
    }
    fetchInit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchMeetings = async (courseId: string) => {
    if (!courseId) { setMeetings([]); return }
    setLoadingMeetings(true)
    try {
      const res  = await fetch(`${API_URL}/api/meetings/by-course?courseId=${courseId}`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setMeetings(data)
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoadingMeetings(false) }
  }

  useEffect(() => { fetchMeetings(selectedCourseId) }, [selectedCourseId])

  const handleCreateMeeting = async () => {
    if (!newForm.title || !newForm.date || !selectedCourseId) { toast('Título, fecha y curso son requeridos', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/meetings/by-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ ...newForm, courseId: Number(selectedCourseId) }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast('Reunión creada', 'success')
      setShowNewModal(false)
      setNewForm({ title: '', date: '' })
      fetchMeetings(selectedCourseId)
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const openMeeting = (meeting: Meeting) => {
    setActiveMeeting(meeting)
    const state: Record<number, boolean> = {}
    meeting.attendances.forEach(a => { state[a.parentId] = a.present })
    setAttendanceState(state)
  }

  const handleSaveAttendance = async () => {
    if (!activeMeeting) return
    setSaving(true)
    try {
      const attendances = activeMeeting.attendances.map(a => ({
        parentId: a.parentId,
        present:  attendanceState[a.parentId] ?? false,
      }))
      const res  = await fetch(`${API_URL}/api/meetings/${activeMeeting.id}/attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ attendances }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message || 'Asistencia guardada', 'success')
      fetchMeetings(selectedCourseId)
      setActiveMeeting(null)
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleChargeAbsences = async () => {
    if (!activeMeeting) return
    if (!chargeForm.amount || !chargeForm.academicYearId) { toast('Monto y gestión son requeridos', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/meetings/${activeMeeting.id}/charge-absences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify(chargeForm),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowChargeModal(false)
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleDeleteMeeting = async (id: number) => {
    if (!await confirm('¿Eliminar esta reunión?', { danger: true })) return
    try {
      const res  = await fetch(`${API_URL}/api/meetings/${id}`, { method: 'DELETE', headers: auth() })
      const data = await res.json()
      if (res.ok) { toast(data.message || 'Reunión eliminada', 'success'); fetchMeetings(selectedCourseId) }
      else toast(data.message, 'error')
    } catch { toast('Error de conexión', 'error') }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })

  const presentes = activeMeeting ? activeMeeting.attendances.filter(a => attendanceState[a.parentId]).length : 0
  const ausentes  = activeMeeting ? activeMeeting.attendances.length - presentes : 0

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Asistencia</h1>
          <p className="text-[13px] text-neutral-500">Reuniones por curso</p>
        </div>
        <Link href="/dashboard/padres/asistencia/escanear">
          <Button variant="secondary"><ScanLine size={16}/> Escanear QR</Button>
        </Link>
      </div>

      <Card className="flex gap-2.5 flex-wrap items-center mb-4">
        <Select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)} className="w-auto min-w-[220px]">
          <option value="">Selecciona un curso</option>
          {courses.map(c => <option key={c.id} value={c.id}>{courseLabel(c)}</option>)}
        </Select>
        {isPresidente && (
          <Button onClick={() => setShowNewModal(true)} disabled={!selectedCourseId}>
            <Plus size={16}/> Nueva reunión
          </Button>
        )}
      </Card>

      {!selectedCourseId ? (
        <Card className="text-center py-12 text-neutral-500">Selecciona un curso para ver sus reuniones.</Card>
      ) : loadingMeetings ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : meetings.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-neutral-500">
          <Users size={40} className="text-neutral-300"/>
          <p className="text-[13px]">No hay reuniones registradas para este curso</p>
          {isPresidente && <Button onClick={() => setShowNewModal(true)}><Plus size={14}/> Crear primera reunión</Button>}
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {meetings.map(m => {
            const pres = m.attendances.filter(a => a.present).length
            const aus  = m.attendances.length - pres
            return (
              <Card key={m.id}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="text-[15px] font-bold text-brand-700 mb-1">{m.title}</div>
                    <div className="text-xs text-neutral-500">{fmtDate(m.date)}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge tone="success"><CheckCircle size={12}/> {pres} presentes</Badge>
                    <Badge tone="danger"><AlertCircle size={12}/> {aus} ausentes</Badge>
                  </div>
                </div>
                {isPresidente && (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openMeeting(m)}>
                      <Users size={13}/> Tomar asistencia
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDeleteMeeting(m.id)}>
                      <Trash2 size={13}/>
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal nueva reunión */}
      <Modal
        open={showNewModal} onClose={() => setShowNewModal(false)} title="Nueva Reunión"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNewModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateMeeting} loading={saving}>
              {!saving && <Plus size={14}/>}
              {saving ? 'Creando...' : 'Crear reunión'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Título" required placeholder="Ej: Reunión 1er trimestre, Reunión de padres..."
            value={newForm.title} onChange={e => setNewForm({ ...newForm, title: e.target.value })}
          />
          <Input
            label="Fecha" required type="datetime-local"
            value={newForm.date} onChange={e => setNewForm({ ...newForm, date: e.target.value })}
          />
        </div>
      </Modal>

      {/* Modal tomar asistencia */}
      <Modal
        open={!!activeMeeting} onClose={() => setActiveMeeting(null)}
        title={activeMeeting?.title} maxWidth={560}
        footer={
          <>
            <Button variant="danger" onClick={() => setShowChargeModal(true)}>
              <DollarSign size={14}/> Multar ausentes ({ausentes})
            </Button>
            <Button variant="secondary" onClick={() => setActiveMeeting(null)}>Cancelar</Button>
            <Button onClick={handleSaveAttendance} loading={saving}>
              {!saving && <CheckCircle size={14}/>}
              {saving ? 'Guardando...' : 'Guardar asistencia'}
            </Button>
          </>
        }
      >
        {activeMeeting && (
          <div className="flex flex-col gap-3.5">
            <div className="text-xs text-neutral-500">{fmtDate(activeMeeting.date)}</div>
            <div className="flex gap-2">
              <Badge tone="success"><CheckCircle size={12}/> {presentes} presentes</Badge>
              <Badge tone="danger"><AlertCircle size={12}/> {ausentes} ausentes</Badge>
            </div>
            <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
              {activeMeeting.attendances.map(a => (
                <label
                  key={a.parentId}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${attendanceState[a.parentId] ? 'bg-success-100 border-success-500/40' : 'bg-danger-100 border-danger-500/40'}`}
                >
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-brand-700">{a.parent.lastName} {a.parent.firstName}</div>
                    {a.parent.ci && <div className="text-[11px] text-neutral-500">CI: {a.parent.ci}</div>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xs font-medium ${attendanceState[a.parentId] ? 'text-success-700' : 'text-danger-600'}`}>
                      {attendanceState[a.parentId] ? '✅ Presente' : '❌ Ausente'}
                    </span>
                    <input
                      type="checkbox"
                      className="w-[18px] h-[18px] accent-[var(--color-success-500)] cursor-pointer"
                      checked={attendanceState[a.parentId] ?? false}
                      onChange={e => setAttendanceState(prev => ({ ...prev, [a.parentId]: e.target.checked }))}
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal multar ausentes */}
      <Modal
        open={showChargeModal && !!activeMeeting} onClose={() => setShowChargeModal(false)} title="Multar Ausentes"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowChargeModal(false)}>Cancelar</Button>
            <Button onClick={handleChargeAbsences} loading={saving}>
              {!saving && <DollarSign size={14}/>}
              {saving ? 'Multando...' : `Multar ${ausentes} ausentes`}
            </Button>
          </>
        }
      >
        {activeMeeting && (
          <div className="flex flex-col gap-4">
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-[13px] text-neutral-500 leading-relaxed">
              Se creará una multa de <strong className="text-brand-700">Multa Reunión</strong> para los <strong className="text-brand-700">{ausentes} ausentes</strong> de la reunión <strong className="text-brand-700">{activeMeeting.title}</strong>.
            </div>
            <Input
              label="Monto de la multa (Bs.)" required type="number" step="0.01" min="0"
              value={chargeForm.amount} onChange={e => setChargeForm({ ...chargeForm, amount: e.target.value })}
            />
            <Select
              label="Gestión" required
              value={chargeForm.academicYearId} onChange={e => setChargeForm({ ...chargeForm, academicYearId: e.target.value })}
            >
              <option value="">Selecciona gestión</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.year}{y.isActive ? ' (Activa)' : ''}</option>
              ))}
            </Select>
          </div>
        )}
      </Modal>
    </div>
  )
}
