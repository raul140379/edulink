'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen, CheckCircle2, AlertCircle, Save, X, Plus } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface PlanItem {
  subjectId:    number
  subject:      { id: number; name: string; code: string; campo: string | null }
  hoursPerWeek: number
  teacher:      { id: number; firstName: string; lastName: string } | null
  assignmentId: number | null
}
interface CoursePlan {
  course:        { id: number; grade: string; parallel: string; level: string }
  totalHours:    number
  totalSubjects: number
  assignedCount: number
  pendingCount:  number
  grouped:       Record<string, PlanItem[]>
  campoOrder:    string[]
}
interface Teacher {
  id: number; firstName: string; lastName: string
}
interface Subject {
  id: number; name: string; code?: string; campo?: string; level: string
}

const GRADES = { PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°', CUARTO:'4°', QUINTO:'5°', SEXTO:'6°' } as Record<string,string>
const LEVELS = { INICIAL:'Inicial', PRIMARIA:'Primaria', SECUNDARIA:'Secundaria' } as Record<string,string>
const SHIFTS = { MORNING:'Mañana', AFTERNOON:'Tarde', NIGHT:'Noche' } as Record<string,string>

const CAMPO_LABELS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia, Tecnología y Producción',
  SIN_CAMPO:                     'Sin campo asignado',
}
const CAMPO_TONE: Record<string, 'success' | 'brand' | 'info' | 'warning' | 'neutral'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'brand',
  COSMOS_PENSAMIENTO:            'info',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'warning',
  SIN_CAMPO:                     'neutral',
}
const CAMPO_ICONS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '🌿',
  COMUNIDAD_SOCIEDAD:            '🌐',
  COSMOS_PENSAMIENTO:            '✨',
  CIENCIA_TECNOLOGIA_PRODUCCION: '⚙️',
  SIN_CAMPO:                     '📌',
}

export default function AsignarMateriaPage() {
  const params  = useParams()
  const router  = useRouter()
  const confirm = useConfirm()
  const toast   = useToast()
  const id      = params.id as string

  const [plan,       setPlan]       = useState<CoursePlan | null>(null)
  const [teachersBySubject, setTeachersBySubject] = useState<Record<number, Teacher[]>>({})
  const [loadingTeachers, setLoadingTeachers]     = useState<Record<number, boolean>>({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState<number | null>(null)
  const [selections, setSelections] = useState<Record<number, string>>({})
  const [courseInfo, setCourseInfo] = useState<{level:string;grade:string;parallel:string;shift:string;educationType?:string} | null>(null)

  const [showAddPlan, setShowAddPlan] = useState(false)
  const [allSubjects,  setAllSubjects] = useState<Subject[]>([])
  const [planForm,     setPlanForm]    = useState({ subjectId: '', hoursPerWeek: '4' })
  const [savingPlan,   setSavingPlan]  = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`${API_URL}/api/courses/${id}`,       { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/subjects/plan/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [cData, pData] = await Promise.all([cRes.json(), pRes.json()])
      if (cRes.ok) setCourseInfo(cData)
      if (pRes.ok) setPlan(pData)
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  const loadTeachersForSubject = async (subjectId: number, campo: string | null) => {
    if (teachersBySubject[subjectId] !== undefined) return
    setLoadingTeachers(prev => ({...prev, [subjectId]: true}))
    try {
      let res  = await fetch(`${API_URL}/api/teachers?subjectId=${subjectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      let data = await res.json()
      if (res.ok && Array.isArray(data) && data.length === 0 && campo) {
        res  = await fetch(`${API_URL}/api/teachers?campo=${campo}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        data = await res.json()
      }
      setTeachersBySubject(prev => ({...prev, [subjectId]: res.ok ? data : []}))
    } catch {
      setTeachersBySubject(prev => ({...prev, [subjectId]: []}))
    } finally {
      setLoadingTeachers(prev => ({...prev, [subjectId]: false}))
    }
  }

  const fetchAllSubjects = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/subjects?level=SECUNDARIA`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setAllSubjects(data)
    } catch { console.error('Error cargando materias') }
  }

  useEffect(() => { fetchData() }, [id])

  useEffect(() => {
    if (!plan) return
    const pre: Record<number, string> = {}
    for (const items of Object.values(plan.grouped)) {
      for (const item of items) {
        if (item.teacher) pre[item.subjectId] = String(item.teacher.id)
      }
    }
    setSelections(pre)
  }, [plan])

  const handleAssign = async (subjectId: number) => {
    const teacherId = selections[subjectId]
    if (!teacherId) { toast('Selecciona un maestro', 'error'); return }
    setSaving(subjectId)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/assign`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ subjectId, teacherId: parseInt(teacherId), courseId: parseInt(id) }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(null) }
  }

  const handleAddToPlan = async () => {
    if (!planForm.subjectId) { toast('Selecciona una materia', 'error'); return }
    setSavingPlan(true)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/grade-config`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subjectId:     parseInt(planForm.subjectId),
          grade:         courseInfo!.grade,
          educationType: courseInfo!.educationType ?? 'REGULAR',
          hoursPerWeek:  parseInt(planForm.hoursPerWeek) || 4,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowAddPlan(false)
      setPlanForm({ subjectId: '', hoursPerWeek: '4' })
      fetchData()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSavingPlan(false) }
  }

  const handleRemove = async (assignmentId: number, subjectId: number) => {
    if (!await confirm('¿Quitar el maestro de esta materia?', { danger: true })) return
    setSaving(subjectId)
    try {
      const res = await fetch(`${API_URL}/api/subjects/assign/${assignmentId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        toast(data.message, 'success')
        setSelections(prev => { const n = {...prev}; delete n[subjectId]; return n })
        fetchData()
      } else toast(data.message, 'error')
    } catch { toast('Error al quitar', 'error') }
    finally  { setSaving(null) }
  }

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (!plan || !courseInfo) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">No se pudo cargar el plan</p></div>

  const camposOrden = [...plan.campoOrder, 'SIN_CAMPO'].filter(c => plan.grouped[c]?.length > 0)

  return (
    <div>
      <div className="flex items-start gap-4 mb-5 flex-wrap">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px] shrink-0">
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-bold text-brand-700 mb-1">Asignar Maestros · {GRADES[courseInfo.grade]} {courseInfo.parallel}</h1>
          <p className="text-[13px] text-neutral-500">{LEVELS[courseInfo.level]} · {SHIFTS[courseInfo.shift]}</p>
        </div>
        <Button size="sm" onClick={() => { setShowAddPlan(true); fetchAllSubjects() }}>
          <Plus size={14}/> Agregar materia al plan
        </Button>
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <Card className="flex items-center gap-3">
          <BookOpen size={18} className="text-info-500"/>
          <div><div className="text-xl font-bold text-brand-700">{plan.totalSubjects}</div><div className="text-[11px] text-neutral-500">Materias del grado</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <CheckCircle2 size={18} className="text-success-700"/>
          <div><div className="text-xl font-bold text-success-700">{plan.assignedCount}</div><div className="text-[11px] text-neutral-500">Con maestro</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <AlertCircle size={18} className={plan.pendingCount > 0 ? 'text-[#BA7517]' : 'text-success-700'}/>
          <div>
            <div className={`text-xl font-bold ${plan.pendingCount > 0 ? 'text-[#BA7517]' : 'text-success-700'}`}>{plan.pendingCount}</div>
            <div className="text-[11px] text-neutral-500">Sin maestro</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="text-xl font-bold text-brand-700">{plan.totalHours}</span>
          <div className="text-[11px] text-neutral-500">Hrs/semana</div>
        </Card>
      </div>

      {camposOrden.map(campo => {
        const items = plan.grouped[campo] || []
        const icon  = CAMPO_ICONS[campo]  || '📌'
        const label = CAMPO_LABELS[campo] || campo
        const horas = items.reduce((s, i) => s + i.hoursPerWeek, 0)

        return (
          <Card key={campo} padded={false} className="overflow-hidden mb-4">
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-neutral-100 flex-wrap">
              <Badge tone={CAMPO_TONE[campo] || 'neutral'}>{icon} {label}</Badge>
              <span className="ml-auto text-xs text-neutral-500 font-medium">{horas} hrs/sem · {items.length} {items.length === 1 ? 'materia' : 'materias'}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-neutral-100">
                    <th className="px-3.5 py-2 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Materia</th>
                    <th className="px-3.5 py-2 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide w-[70px]">Hrs/sem</th>
                    <th className="px-3.5 py-2 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Maestro asignado / Seleccionar</th>
                    <th className="px-3.5 py-2 w-[130px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const isSaving   = saving === item.subjectId
                    const selected   = selections[item.subjectId] || ''
                    const hasTeacher = !!item.teacher

                    return (
                      <tr key={item.subjectId} className={`border-t border-neutral-100 ${hasTeacher ? 'bg-success-100/30' : 'bg-warning-100/30'}`}>
                        <td className="px-3.5 py-2.5">
                          <div className="font-medium text-brand-700 text-[13px]">{item.subject.name}</div>
                          {item.subject.code && <div className="text-[11px] text-neutral-500">{item.subject.code}</div>}
                        </td>
                        <td className="px-3.5 py-2.5 text-center"><Badge tone="brand">{item.hoursPerWeek}</Badge></td>
                        <td className="px-3.5 py-2.5">
                          <select
                            value={selected}
                            onFocus={() => loadTeachersForSubject(item.subjectId, item.subject.campo)}
                            onChange={e => setSelections(prev => ({...prev, [item.subjectId]: e.target.value}))}
                            disabled={isSaving}
                            className={`w-full px-2.5 py-2 border rounded-md text-[13px] text-brand-700 outline-none bg-white ${hasTeacher ? 'border-success-500/50' : 'border-warning-500'}`}
                          >
                            <option value="">
                              {loadingTeachers[item.subjectId] ? 'Cargando maestros...' : '— Seleccionar maestro —'}
                            </option>
                            {(teachersBySubject[item.subjectId] || []).length === 0 &&
                             !loadingTeachers[item.subjectId] &&
                             teachersBySubject[item.subjectId] !== undefined && (
                              <option disabled value="">Sin maestros con esta especialidad</option>
                            )}
                            {(teachersBySubject[item.subjectId] || []).map(t => (
                              <option key={t.id} value={t.id}>{t.lastName} {t.firstName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex gap-1.5 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleAssign(item.subjectId)}
                              disabled={isSaving || !selected}
                              loading={isSaving}
                            >
                              {!isSaving && <Save size={12}/>} {hasTeacher ? 'Cambiar' : 'Asignar'}
                            </Button>
                            {hasTeacher && item.assignmentId && (
                              <button
                                title="Quitar maestro" disabled={isSaving}
                                onClick={() => handleRemove(item.assignmentId!, item.subjectId)}
                                className="w-7 h-7 rounded-md bg-danger-100 text-danger-600 border border-danger-500/40 flex items-center justify-center hover:opacity-75 disabled:opacity-40 transition-opacity"
                              >
                                <X size={13}/>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}

      <Modal
        open={showAddPlan && !!courseInfo} onClose={() => setShowAddPlan(false)} title="Agregar materia al plan"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddPlan(false)}>Cancelar</Button>
            <Button onClick={handleAddToPlan} disabled={savingPlan || !planForm.subjectId} loading={savingPlan}>
              {!savingPlan && <Plus size={12}/>} {savingPlan ? 'Guardando...' : 'Agregar al plan'}
            </Button>
          </>
        }
      >
        {courseInfo && (
          <div className="flex flex-col gap-3.5">
            <p className="text-xs text-neutral-500 -mt-1">{GRADES[courseInfo.grade]} · {courseInfo.educationType ?? 'REGULAR'}</p>
            <Select
              label="Materia" required
              value={planForm.subjectId}
              onChange={e => setPlanForm({...planForm, subjectId: e.target.value})}
            >
              <option value="">— Seleccionar materia —</option>
              {allSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.campo ? ` · ${CAMPO_LABELS[s.campo] || s.campo}` : ''}
                </option>
              ))}
            </Select>
            <Input
              label="Horas por semana" required type="number" min={1} max={40}
              value={planForm.hoursPerWeek}
              onChange={e => setPlanForm({...planForm, hoursPerWeek: e.target.value})}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
