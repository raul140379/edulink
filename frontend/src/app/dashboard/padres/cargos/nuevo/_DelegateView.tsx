'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

interface Course {
  id: number; level: string; grade: string; parallel: string; shift: string
  assignments: { student: { id: number; firstName: string; lastName: string; parents: { isTutor: boolean; parent: Parent }[] } }[]
}

const TYPE_OPTIONS = [
  { value: 'MULTA_REUNION',    label: 'Multa Reunión de Curso' },
  { value: 'ACTIVIDAD',        label: 'Actividad' },
  { value: 'MATERIAL_ESCOLAR', label: 'Material Escolar' },
  { value: 'OTRO',             label: 'Otro' },
]

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }

export default function DelegateNuevoCargoPage() {
  const router = useRouter()
  const toast  = useToast()

  const [course,        setCourse]        = useState<Course | null>(null)
  const [parents,       setParents]       = useState<Parent[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [bulk,          setBulk]          = useState(false)
  const [selectedParents, setSelectedParents] = useState<number[]>([])

  const [form, setForm] = useState({
    title:          '',
    description:    '',
    amount:         '',
    type:           'MULTA_REUNION',
    dueDate:        '',
    parentId:       '',
    studentId:      '',
    academicYearId: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token')
      setLoading(true)
      try {
        const [cRes, yRes] = await Promise.all([
          fetch(`${API_URL}/api/delegates/my-course`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/academic`,             { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [cData, yData] = await Promise.all([cRes.json(), yRes.json()])

        if (cRes.ok) {
          setCourse(cData)
          const parentMap = new Map<number, Parent>()
          for (const a of cData.assignments) {
            for (const ps of a.student.parents) {
              if (ps.isTutor && !parentMap.has(ps.parent.id)) {
                parentMap.set(ps.parent.id, {
                  ...ps.parent,
                  students: a.student ? [{ student: a.student }] : []
                })
              }
            }
          }
          setParents(Array.from(parentMap.values()))
        }

        if (yRes.ok) {
          setAcademicYears(yData)
          const active = yData.find((y: AcademicYear) => y.isActive)
          if (active) setForm(f => ({ ...f, academicYearId: String(active.id) }))
        }
      } catch { toast('Error de conexión', 'error') }
      finally  { setLoading(false) }
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
            title:          form.title,
            description:    form.description || undefined,
            amount:         parseFloat(form.amount),
            type:           form.type,
            dueDate:        form.dueDate || undefined,
            academicYearId: parseInt(form.academicYearId),
            parentIds:      selectedParents,
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
            title:          form.title,
            description:    form.description || undefined,
            amount:         parseFloat(form.amount),
            type:           form.type,
            target:         'TUTOR',
            dueDate:        form.dueDate || undefined,
            parentId:       parseInt(form.parentId),
            academicYearId: parseInt(form.academicYearId),
          }),
        })
        const data = await res.json()
        if (!res.ok) { toast(data.message, 'error'); return }
        toast('Cargo registrado correctamente', 'success')
        setTimeout(() => router.push('/dashboard/padres/tesoreria'), 1500)
      }
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const toggleParent = (id: number) =>
    setSelectedParents(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  return (
    <div className="max-w-[700px] mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
          <ArrowLeft size={16}/> Volver
        </button>
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Nuevo Cargo</h1>
          {course && <p className="text-[13px] text-neutral-500">{LEVEL_LABELS[course.level]} — {GRADE_LABELS[course.grade]} {course.parallel}</p>}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : (
        <Card className="flex flex-col gap-4.5">
          <div className="flex bg-neutral-100 rounded-[10px] p-1 gap-1">
            <button
              onClick={() => setBulk(false)}
              className={`flex-1 py-2 rounded-lg text-[13px] transition-colors ${!bulk ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
            >
              Cargo individual
            </button>
            <button
              onClick={() => setBulk(true)}
              className={`flex-1 py-2 rounded-lg text-[13px] flex items-center justify-center gap-1.5 transition-colors ${bulk ? 'bg-white text-brand-700 font-semibold shadow-sm' : 'text-neutral-500'}`}
            >
              <Users size={14}/> Cargo a todo el curso
            </button>
          </div>

          {bulk && (
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-xs text-neutral-500 leading-relaxed">
              💡 Se creará el mismo cargo para todos los tutores seleccionados del curso.
            </div>
          )}

          <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-100">Datos del cargo</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input
                label="Título" required placeholder="Ej: Multa reunión marzo, Material didáctico..."
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <Select label="Tipo de cargo" required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
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

          {!bulk && (
            <Select label="Tutor legal" required value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })}>
              <option value="">Selecciona un tutor</option>
              {parents.map(p => (
                <option key={p.id} value={p.id}>{p.lastName} {p.firstName}{p.ci ? ` — CI: ${p.ci}` : ''}</option>
              ))}
            </Select>
          )}

          {bulk && (
            <>
              <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-100">
                Seleccionar tutores ({selectedParents.length} seleccionados)
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedParents(parents.map(p => p.id))}>Seleccionar todos</Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedParents([])}>Limpiar</Button>
              </div>
              <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto border border-neutral-300 rounded-lg p-2">
                {parents.map(p => (
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
