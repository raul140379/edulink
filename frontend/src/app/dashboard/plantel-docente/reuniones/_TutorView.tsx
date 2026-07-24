'use client'

import { useEffect, useState } from 'react'
import { Plus, Users, Bell, Send, ClipboardList, Check, UserCheck, UserX, Lock, Edit, Trash2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id: number; firstName: string; lastName: string; phone?: string; ci?: string
}

interface Attendance {
  present:   boolean
  parentId?: number
  parent:    { id?: number; firstName: string; lastName: string; phone?: string; ci?: string }
}

interface Meeting {
  id:          number
  title:       string
  date:        string
  attendances: Attendance[]
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', {
  day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

const toInputDate = (d: string) => {
  const dt = new Date(d)
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset())
  return dt.toISOString().slice(0, 16)
}

const getDefaultDate = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

const isAttendanceClosed = (m: Meeting) => m.attendances.some(a => a.present === true)

export default function TeacherReunionesPage() {
  const confirm = useConfirm()
  const toast   = useToast()
  const [meetings,      setMeetings]      = useState<Meeting[]>([])
  const [tutors,        setTutors]        = useState<Parent[]>([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [savingAtt,     setSavingAtt]     = useState(false)
  const [showModal,     setShowModal]     = useState(false)
  const [showAttModal,  setShowAttModal]  = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selMeeting,    setSelMeeting]    = useState<Meeting | null>(null)
  const [attendance,    setAttendance]    = useState<Record<number, boolean>>({})
  const [form,          setForm]          = useState({ title: '', date: getDefaultDate() })
  const [editForm,      setEditForm]      = useState({ title: '', date: '' })
  const [notifyAll,     setNotifyAll]     = useState(false)

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

  const openModal = () => {
    setForm({ title: '', date: getDefaultDate() })
    setNotifyAll(false)
    setShowModal(true)
  }

  const openEdit = (m: Meeting) => {
    setSelMeeting(m)
    setEditForm({ title: m.title, date: toInputDate(m.date) })
    setShowEditModal(true)
  }

  const openAttendance = (m: Meeting) => {
    setSelMeeting(m)
    const map: Record<number, boolean> = {}
    m.attendances.forEach(a => {
      const pid = a.parent?.id ?? (a as any).parentId
      if (pid !== undefined) map[pid] = a.present
    })
    setAttendance(map)
    setShowAttModal(true)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cRes, mRes] = await Promise.all([
        fetch(`${API_URL}/api/teachers/my-course`, { headers: auth() }),
        fetch(`${API_URL}/api/meetings/my-course`, { headers: auth() }),
      ])
      const [cData, mData] = await Promise.all([cRes.json(), mRes.json()])
      if (cRes.ok) {
        const tutorMap = new Map<number, Parent>()
        cData.assignments?.forEach((a: any) => {
          a.student.parents?.forEach((ps: any) => {
            if (ps.isTutor && !tutorMap.has(ps.parent.id)) tutorMap.set(ps.parent.id, ps.parent)
          })
        })
        setTutors(Array.from(tutorMap.values()))
      }
      if (mRes.ok) setMeetings(mData)
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async () => {
    if (!form.title || !form.date) { toast('Título y fecha son requeridos', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/meetings/my-course`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      if (notifyAll && tutors.length > 0) {
        await fetch(`${API_URL}/api/notifications/send-bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
          body: JSON.stringify({
            parentIds: tutors.map(t => t.id),
            title:   `[Maestro Tutor] Convocatoria: ${form.title}`,
            message: `El maestro tutor le convoca a la reunión "${form.title}" programada para el ${new Date(form.date).toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}.`,
            type: 'REUNION',
          }),
        })
        toast(`Reunión creada y notificación enviada a ${tutors.length} tutores`, 'success')
      } else { toast(data.message, 'success') }
      setShowModal(false)
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleEdit = async () => {
    if (!selMeeting || !editForm.title || !editForm.date) { toast('Título y fecha son requeridos', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/meetings/${selMeeting.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ title: editForm.title, date: editForm.date }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      if (tutors.length > 0) {
        await fetch(`${API_URL}/api/notifications/send-bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
          body: JSON.stringify({
            parentIds: tutors.map(t => t.id),
            title:   `[Maestro Tutor] Reunión reprogramada: ${editForm.title}`,
            message: `La reunión "${editForm.title}" ha sido reprogramada para el ${new Date(editForm.date).toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}.`,
            type: 'REUNION',
          }),
        })
      }
      toast('Reunión actualizada y tutores notificados', 'success')
      setShowEditModal(false)
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleDelete = async (m: Meeting) => {
    if (!await confirm(`¿Cancelar la reunión "${m.title}"? Esta acción no se puede deshacer.`, { danger: true })) return
    try {
      const res  = await fetch(`${API_URL}/api/meetings/${m.id}`, { method: 'DELETE', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      if (tutors.length > 0) {
        await fetch(`${API_URL}/api/notifications/send-bulk`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
          body: JSON.stringify({
            parentIds: tutors.map(t => t.id),
            title:   `[Maestro Tutor] Reunión cancelada: ${m.title}`,
            message: `La reunión "${m.title}" programada para el ${fmtDate(m.date)} ha sido cancelada.`,
            type: 'REUNION',
          }),
        })
      }
      toast('Reunión cancelada y tutores notificados', 'success')
      fetchData()
    } catch { toast('Error de conexión', 'error') }
  }

  const handleSaveAttendance = async () => {
    if (!selMeeting) return
    setSavingAtt(true)
    try {
      const attendances = Object.entries(attendance).map(([parentId, present]) => ({
        parentId: parseInt(parentId), present,
      }))
      const res  = await fetch(`${API_URL}/api/meetings/${selMeeting.id}/attendance`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ attendances }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }

      const ausentes = selMeeting.attendances
        .map(a => ({ ...a, pid: a.parent?.id ?? (a as any).parentId }))
        .filter(a => !attendance[a.pid])

      if (ausentes.length > 0) {
        const jRes  = await fetch(`${API_URL}/api/users/junta-parents`, { headers: auth() })
        const jData = await jRes.json()
        if (jRes.ok && jData.length > 0) {
          const ausentesNombres = ausentes.map(a => `• ${a.parent.lastName} ${a.parent.firstName}`).join(', ')
          await fetch(`${API_URL}/api/notifications/send-bulk`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
            body: JSON.stringify({
              parentIds: jData.map((p: any) => p.id),
              title:   `[Maestro Tutor] Ausentes en reunión: ${selMeeting.title}`,
              message: `Se registraron ${ausentes.length} ausente(s) en la reunión "${selMeeting.title}" del ${fmtDate(selMeeting.date)}. Tutores ausentes: ${ausentesNombres}. Por favor determine si corresponde aplicar multa.`,
              type: 'REUNION',
            }),
          })
          toast(`Asistencia guardada — Junta notificada con ${ausentes.length} ausente(s)`, 'success')
        } else { toast('Asistencia guardada correctamente', 'success') }
      } else { toast('Asistencia guardada — todos presentes ✅', 'success') }

      setShowAttModal(false)
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSavingAtt(false) }
  }

  const toggleAll = (present: boolean) => {
    const map: Record<number, boolean> = {}
    selMeeting?.attendances.forEach(a => {
      const pid = a.parent?.id ?? (a as any).parentId
      if (pid !== undefined) map[pid] = present
    })
    setAttendance(map)
  }

  const presentCount = Object.values(attendance).filter(Boolean).length
  const absentCount  = Object.values(attendance).filter(v => !v).length

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Reuniones</h1>
          <p className="text-[13px] text-neutral-500">Convoca y gestiona reuniones de tu curso</p>
        </div>
        <Button onClick={openModal}><Plus size={16}/> Convocar reunión</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : meetings.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-neutral-500">
          <Users size={40} className="text-neutral-300"/>
          <p>No hay reuniones registradas</p>
          <Button onClick={openModal}><Plus size={14}/> Convocar primera reunión</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {meetings.map(m => {
            const pres   = m.attendances.filter(a => a.present).length
            const aus    = m.attendances.length - pres
            const closed = isAttendanceClosed(m)
            return (
              <Card key={m.id} className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex-1">
                  <div className="text-[15px] font-bold text-brand-700 mb-1">{m.title}</div>
                  <div className="text-xs text-neutral-500">{fmtDate(m.date)}</div>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex gap-2 flex-wrap">
                    {m.attendances.length > 0 ? (
                      <>
                        <Badge tone="success">✅ {pres} presentes</Badge>
                        <Badge tone="danger">❌ {aus} ausentes</Badge>
                      </>
                    ) : <Badge tone="neutral">Sin asistencia</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!closed && (
                      <>
                        <button title="Modificar fecha/hora" onClick={() => openEdit(m)} className="w-[30px] h-[30px] rounded-md bg-warning-100 text-[#7A4A0A] hover:bg-brand-700 hover:text-white transition-colors flex items-center justify-center"><Edit size={13}/></button>
                        <button title="Cancelar reunión" onClick={() => handleDelete(m)} className="w-[30px] h-[30px] rounded-md bg-danger-100 text-danger-600 hover:bg-danger-500 hover:text-white transition-colors flex items-center justify-center"><Trash2 size={13}/></button>
                      </>
                    )}
                    {closed ? (
                      <div className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-100 text-neutral-500 border border-neutral-300 rounded-lg text-xs font-medium whitespace-nowrap"><Lock size={13}/> Asistencia cerrada</div>
                    ) : (
                      <Button size="sm" onClick={() => openAttendance(m)}><ClipboardList size={14}/> Marcar asistencia</Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal nueva reunión */}
      <Modal
        open={showModal} onClose={() => setShowModal(false)} title="Convocar Reunión"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>
              {!saving && (notifyAll ? <Send size={14}/> : <Plus size={14}/>)}
              {saving ? 'Creando...' : notifyAll ? 'Crear y notificar' : 'Crear reunión'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Título" required placeholder="Ej: Reunión de padres 1er trimestre..."
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          />
          <Input
            label="Fecha y hora" required type="datetime-local"
            value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
            hint="Pre-rellena con la fecha y hora actual"
          />
          <div className="bg-success-100 border border-success-500/40 rounded-lg p-3 flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-[13px] text-success-700 font-medium cursor-pointer">
              <input type="checkbox" checked={notifyAll} onChange={e => setNotifyAll(e.target.checked)} className="w-4 h-4 accent-[var(--color-success-500)] cursor-pointer"/>
              <span className="flex items-center gap-1"><Bell size={13}/> Notificar a los {tutors.length} tutores del curso</span>
            </label>
            {notifyAll && <div className="text-[11px] text-success-700 leading-relaxed">La notificación llegará como <strong>[Maestro Tutor]</strong>.</div>}
          </div>
        </div>
      </Modal>

      {/* Modal editar reunión */}
      <Modal
        open={showEditModal && !!selMeeting} onClose={() => setShowEditModal(false)} title="Modificar Reunión"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleEdit} loading={saving}>
              {!saving && <Check size={14}/>}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Título" required value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
          <Input label="Fecha y hora" required type="datetime-local" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
          <div className="bg-warning-100 border border-warning-500 rounded-lg p-3 flex items-center gap-2 text-xs text-[#7A6000]">
            <Bell size={13}/> Se notificará automáticamente a los tutores sobre la reprogramación.
          </div>
        </div>
      </Modal>

      {/* Modal asistencia */}
      <Modal
        open={showAttModal && !!selMeeting} onClose={() => setShowAttModal(false)}
        title="Registro de Asistencia" maxWidth={520}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-neutral-500">{presentCount} de {selMeeting?.attendances.length ?? 0} presentes</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowAttModal(false)}>Cancelar</Button>
              <Button onClick={handleSaveAttendance} loading={savingAtt}>
                {!savingAtt && <Check size={14}/>}
                {savingAtt ? 'Guardando...' : 'Guardar y cerrar asistencia'}
              </Button>
            </div>
          </div>
        }
      >
        {selMeeting && (
          <div className="flex flex-col gap-3.5">
            <p className="text-xs text-neutral-500 -mt-2">{selMeeting.title} · {fmtDate(selMeeting.date)}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => toggleAll(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-success-100 text-success-700 border border-success-500/40 rounded-md text-xs font-medium hover:bg-success-500 hover:text-white transition-colors"><UserCheck size={13}/> Todos presentes</button>
              <button onClick={() => toggleAll(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-danger-100 text-danger-600 border border-danger-500/40 rounded-md text-xs font-medium hover:bg-danger-500 hover:text-white transition-colors"><UserX size={13}/> Todos ausentes</button>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs bg-success-100 text-success-700"><strong>{presentCount}</strong> presentes</div>
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs bg-danger-100 text-danger-600"><strong>{absentCount}</strong> ausentes</div>
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs bg-neutral-100 text-neutral-500"><strong>{selMeeting.attendances.length}</strong> total</div>
            </div>
            <div className="flex flex-col gap-0.5">
              {selMeeting.attendances.map((a, i) => {
                const pid     = a.parent?.id ?? (a as any).parentId
                const present = attendance[pid] ?? a.present
                return (
                  <div
                    key={i}
                    onClick={() => setAttendance(prev => ({ ...prev, [pid]: !present }))}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border-[1.5px] transition-opacity hover:opacity-85 ${present ? 'bg-success-100 border-success-500/40' : 'bg-danger-100/60 border-danger-500/30'}`}
                  >
                    <div className="text-[11px] text-neutral-500 min-w-[22px]">{i + 1}</div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-brand-700">{a.parent.lastName} {a.parent.firstName}</span>
                      {(a.parent as any).ci && <span className="text-[11px] text-neutral-500">CI: {(a.parent as any).ci}</span>}
                    </div>
                    <Badge tone={present ? 'success' : 'danger'}>{present ? <><Check size={11}/> Presente</> : <>✕ Ausente</>}</Badge>
                  </div>
                )
              })}
            </div>
            {absentCount > 0 && (
              <div className="bg-warning-100 border border-warning-500 rounded-lg p-3 flex items-start gap-2 text-xs text-[#7A6000]">
                <Bell size={13}/> Al guardar se notificará a la <strong>Junta Escolar</strong> con la lista de ausentes.
              </div>
            )}
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Lock size={12}/> Una vez guardada la asistencia quedará cerrada. Solo la Junta puede modificarla.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
