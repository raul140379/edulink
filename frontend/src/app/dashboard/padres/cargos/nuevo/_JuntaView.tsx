'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Users } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id: number; firstName: string; lastName: string; ci?: string
  students: { student: { id: number; firstName: string; lastName: string } }[]
}

interface AcademicYear {
  id: number; year: number; isActive: boolean
}

interface CourseOption { id: number; level: string; grade: string; parallel: string; shift: string }

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

const TYPE_OPTIONS = [
  { value: 'CUOTA_INICIAL',    label: 'Cuota Inicial',     target: 'TUTOR' },
  { value: 'DEUDA_ANTERIOR',   label: 'Deuda Anterior',    target: 'TUTOR' },
  { value: 'MULTA_ASAMBLEA',   label: 'Multa Asamblea',    target: 'TUTOR' },
  { value: 'MINGA',            label: 'Minga',             target: 'TUTOR' },
  { value: 'MULTA_REUNION',    label: 'Multa Reunión de Curso', target: 'ESTUDIANTE' },
  { value: 'ACTIVIDAD',        label: 'Actividad',         target: 'ESTUDIANTE' },
  { value: 'MATERIAL_ESCOLAR', label: 'Material Escolar',  target: 'ESTUDIANTE' },
  { value: 'OTRO',             label: 'Otro',              target: 'ESTUDIANTE' },
]

export default function NuevoCargoPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const preParentId  = searchParams.get('parentId')
  const toast = useToast()

  const [parents,       setParents]       = useState<Parent[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [bulk,          setBulk]          = useState(false)
  const [selectedParents, setSelectedParents] = useState<number[]>([])

  // Modo "Por curso": tercera pestaña junto a individual/masivo — auto-resuelve
  // los tutores de un curso elegido (mismo endpoint que ya usa Delegado para
  // asignarse a sí mismo) y reutiliza el envío masivo existente.
  const [courseMode, setCourseMode] = useState(false)
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [courseTutorIds, setCourseTutorIds] = useState<number[]>([])
  const [loadingCourseTutors, setLoadingCourseTutors] = useState(false)

  const [form, setForm] = useState({
    title:         '',
    description:   '',
    amount:        '',
    type:          'CUOTA_INICIAL',
    target:        'TUTOR',
    dueDate:       '',
    parentId:      preParentId || '',
    studentId:     '',
    academicYearId: '',
    tolerance:     false,
    toleranceNote: '',
  })

  const fetchData = async () => {
    const token = localStorage.getItem('token')
    setLoading(true)
    try {
      const [pRes, yRes, cRes] = await Promise.all([
        fetch(`${API_URL}/api/treasury/parents`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/academic`,          { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/courses`,           { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [pData, yData, cData] = await Promise.all([pRes.json(), yRes.json(), cRes.json()])
      if (pRes.ok) setParents(pData)
      if (cRes.ok) setCourses(cData)
      if (yRes.ok) {
        setAcademicYears(yData)
        const active = yData.find((y: AcademicYear) => y.isActive)
        if (active) setForm(f => ({ ...f, academicYearId: String(active.id) }))
      }
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [])

  const handleTypeChange = (type: string) => {
    const option = TYPE_OPTIONS.find(o => o.value === type)
    setForm(f => ({ ...f, type, target: option?.target || 'TUTOR', studentId: '' }))
  }

  const selectedParent = parents.find(p => p.id === parseInt(form.parentId))

  const handleSave = async () => {
    if (!form.title || !form.amount || !form.academicYearId) {
      toast('Título, monto y gestión son requeridos', 'error'); return
    }
    if (!bulk && !form.parentId) {
      toast('Selecciona un tutor', 'error'); return
    }
    if (bulk && selectedParents.length === 0) {
      toast('Selecciona al menos un tutor', 'error'); return
    }

    const token = localStorage.getItem('token')
    setSaving(true)
    try {
      if (bulk) {
        const res  = await fetch(`${API_URL}/api/treasury/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title:         form.title,
            description:   form.description || undefined,
            amount:        parseFloat(form.amount),
            type:          form.type,
            dueDate:       form.dueDate || undefined,
            academicYearId: parseInt(form.academicYearId),
            parentIds:     selectedParents,
          }),
        })
        const data = await res.json()
        if (!res.ok) { toast(data.message, 'error'); return }
        toast(data.message, 'success')
        setTimeout(() => router.push('/dashboard/padres/tesoreria'), 1500)
      } else {
        const res  = await fetch(`${API_URL}/api/treasury`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title:         form.title,
            description:   form.description || undefined,
            amount:        parseFloat(form.amount),
            type:          form.type,
            target:        form.target,
            dueDate:       form.dueDate || undefined,
            parentId:      parseInt(form.parentId),
            studentId:     (form.target === 'ESTUDIANTE' && form.studentId) ? parseInt(form.studentId) : undefined,
            academicYearId: parseInt(form.academicYearId),
            tolerance:     form.tolerance,
            toleranceNote: form.toleranceNote || undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) { toast(data.message, 'error'); return }
        toast('Cargo registrado correctamente', 'success')
        setTimeout(() => {
          if (preParentId) router.push(`/dashboard/padres/tesoreria/${preParentId}`)
          else router.push('/dashboard/padres/tesoreria')
        }, 1500)
      }
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const toggleParent = (id: number) =>
    setSelectedParents(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleSelectCourse = async (courseId: string) => {
    setSelectedCourseId(courseId)
    setSelectedParents([])
    setCourseTutorIds([])
    if (!courseId) return
    const token = localStorage.getItem('token')
    setLoadingCourseTutors(true)
    try {
      const res  = await fetch(`${API_URL}/api/delegates/course/${courseId}/eligible-parents`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        // Los tutores del curso no siempre están en `parents` (ese listado
        // viene de /api/treasury/parents, ya filtrado a isTutor) — se
        // completan acá para que la lista los pueda mostrar.
        setParents(prev => {
          const known = new Set(prev.map(p => p.id))
          const extra = (data as any[]).filter(p => !known.has(p.id)).map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, ci: p.ci, students: [] }))
          return [...prev, ...extra]
        })
        const ids = (data as any[]).map(p => p.id)
        setCourseTutorIds(ids)
        setSelectedParents(ids)
      }
    } catch { toast('Error al cargar tutores del curso', 'error') }
    finally  { setLoadingCourseTutors(false) }
  }

  const currentType = TYPE_OPTIONS.find(o => o.value === form.type)
  const isForStudent = currentType?.target === 'ESTUDIANTE'

  return (
    <div className="max-w-[700px] mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
          <ArrowLeft size={16}/> Volver
        </button>
        <h1 className="text-xl font-bold text-brand-700">Nuevo Cargo</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : (
        <Card className="flex flex-col gap-4.5">
          <div className="flex bg-neutral-100 rounded-[10px] p-1 gap-1">
            <button
              onClick={() => { setBulk(false); setCourseMode(false) }}
              className={`flex-1 py-2 rounded-lg text-[13px] transition-colors ${!bulk && !courseMode ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
            >
              Cargo individual
            </button>
            <button
              onClick={() => { setBulk(true); setCourseMode(false) }}
              className={`flex-1 py-2 rounded-lg text-[13px] flex items-center justify-center gap-1.5 transition-colors ${bulk && !courseMode ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
            >
              <Users size={14}/> Cargo masivo
            </button>
            <button
              onClick={() => { setBulk(true); setCourseMode(true) }}
              className={`flex-1 py-2 rounded-lg text-[13px] flex items-center justify-center gap-1.5 transition-colors ${courseMode ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
            >
              <Users size={14}/> Por curso
            </button>
          </div>

          {bulk && !courseMode && (
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-xs text-neutral-500 leading-relaxed">
              💡 El cargo masivo crea el mismo cargo para múltiples tutores a la vez. Ideal para cuota inicial, mingas y multas de asamblea.
            </div>
          )}
          {courseMode && (
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-xs text-neutral-500 leading-relaxed">
              💡 Elegí un curso y se auto-completan sus tutores — podés deseleccionar los que no correspondan.
            </div>
          )}

          <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-100">Datos del cargo</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input
                label="Título" required placeholder="Ej: Cuota inicial 2026, Minga marzo..."
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Select label="Tipo de cargo" required value={form.type} onChange={e => handleTypeChange(e.target.value)}>
                <optgroup label="Por Tutor Legal">
                  {TYPE_OPTIONS.filter(o => o.target === 'TUTOR').map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Por Estudiante">
                  {TYPE_OPTIONS.filter(o => o.target === 'ESTUDIANTE').map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              </Select>
              <span className="text-[11px] text-neutral-500 mt-1 block">
                {isForStudent ? '📚 Cargo por estudiante — el tutor paga' : '👤 Cargo al tutor legal'}
              </span>
            </div>
            <Input
              label="Monto (Bs.)" required type="number" step="0.01" min="0" placeholder="0.00"
              value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
            />
            <Select label="Gestión" required value={form.academicYearId} onChange={e => setForm({ ...form, academicYearId: e.target.value })}>
              <option value="">Selecciona gestión</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.year}{y.isActive ? ' (Activa)' : ''}</option>
              ))}
            </Select>
            <Input
              label="Fecha de vencimiento" type="date"
              value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
            />
            <div className="col-span-2">
              <Input
                label="Descripción" placeholder="Descripción adicional (opcional)"
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          {!bulk && !courseMode && (
            <>
              <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-100">Asignar a tutor</div>
              <Select label="Tutor legal" required value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value, studentId: '' })}>
                <option value="">Selecciona un tutor</option>
                {parents.map(p => (
                  <option key={p.id} value={p.id}>{p.lastName} {p.firstName}{p.ci ? ` — CI: ${p.ci}` : ''}</option>
                ))}
              </Select>

              {isForStudent && selectedParent && selectedParent.students.length > 0 && (
                <Select label="Estudiante" required value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
                  <option value="">Selecciona el estudiante</option>
                  {selectedParent.students.map(ps => (
                    <option key={ps.student.id} value={ps.student.id}>{ps.student.lastName} {ps.student.firstName}</option>
                  ))}
                </Select>
              )}

              {form.type === 'DEUDA_ANTERIOR' && (
                <div className="bg-warning-100 border border-warning-500 rounded-lg p-3 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[13px] text-[#7A6000] cursor-pointer">
                    <input
                      type="checkbox" className="w-4 h-4 accent-[var(--color-accent-500)] cursor-pointer"
                      checked={form.tolerance} onChange={e => setForm({ ...form, tolerance: e.target.checked })}
                    />
                    <span>⚠️ Aplicar tolerancia (caso especial)</span>
                  </label>
                  {form.tolerance && (
                    <Input
                      label="Nota de tolerancia" placeholder="Ej: Familia con recursos limitados, acuerdo de pago..."
                      value={form.toleranceNote} onChange={e => setForm({ ...form, toleranceNote: e.target.value })}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {courseMode && (
            <>
              <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-100">Elegir curso</div>
              <Select label="Curso" required value={selectedCourseId} onChange={e => handleSelectCourse(e.target.value)}>
                <option value="">Selecciona un curso</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{GRADE_LABELS[c.grade] || c.grade} &quot;{c.parallel}&quot; · {SHIFT_LABELS[c.shift] || c.shift}</option>
                ))}
              </Select>
            </>
          )}

          {bulk && (!courseMode || selectedCourseId) && (
            <>
              <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-100">
                {loadingCourseTutors ? 'Cargando tutores del curso...' : `Tutores (${selectedParents.length} seleccionados)`}
              </div>
              {!courseMode && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedParents(parents.map(p => p.id))}>Seleccionar todos</Button>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedParents([])}>Limpiar selección</Button>
                </div>
              )}
              <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto border border-neutral-300 rounded-lg p-2">
                {(courseMode ? parents.filter(p => courseTutorIds.includes(p.id)) : parents).map(p => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-md cursor-pointer border ${selectedParents.includes(p.id) ? 'bg-brand-100 border-neutral-300' : 'border-transparent hover:bg-neutral-100'}`}
                  >
                    <input
                      type="checkbox" className="w-4 h-4 accent-[var(--color-brand-700)] cursor-pointer shrink-0"
                      checked={selectedParents.includes(p.id)} onChange={() => toggleParent(p.id)}
                    />
                    <div>
                      <div className="text-[13px] font-medium text-brand-700">{p.lastName} {p.firstName}</div>
                      {p.ci && <div className="text-[11px] text-neutral-500">CI: {p.ci}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2.5 pt-2 border-t border-neutral-100">
            <Button variant="secondary" onClick={() => router.back()}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>
              {!saving && <Plus size={14}/>}
              {saving ? 'Registrando...' : bulk ? `Crear ${selectedParents.length} cargos` : 'Registrar cargo'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
