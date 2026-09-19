'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, Users, Layers, UserPlus } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const LEVEL_ORDER: Record<string, number> = { INICIAL: 0, PRIMARIA: 1, SECUNDARIA: 2 }
// Orden cronológico real del grado — el nombre del enum (CUARTO, PRIMERO, ...)
// no se puede ordenar alfabéticamente, por eso hace falta este mapa explícito.
const GRADE_ORDER: Record<string, number> = { PRIMERO: 0, SEGUNDO: 1, TERCERO: 2, CUARTO: 3, QUINTO: 4, SEXTO: 5 }

interface Student {
  id: number; firstName: string; lastName: string; ci?: string; rude?: string; isActive: boolean
  assignments: { course: { id: number; level: string; grade: string; parallel: string; shift: string }; academicYear: { isActive: boolean } }[]
  parents: { relationType: string; isTutor: boolean; parent: { id: number; firstName: string; lastName: string; kardex: string | null } }[]
}

interface ParentOption {
  id: number; firstName: string; lastName: string; ci?: string | null; kardex?: string | null
}

interface CourseGroup {
  course: { id: number; level: string; grade: string; parallel: string; shift: string } | null
  students: Student[]
}

// Solo lectura — mismo permiso backend (STUDENT_VIEW_ALL) que ya usa Junta
// Escolar en otras pantallas; sin crear/editar/eliminar (eso sigue siendo
// exclusivo de Admin, vía matrícula). Agrupado por curso de la gestión activa.
export default function EstudiantesPage() {
  const toast = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')

  // Modal "Vincular tutor" — para el estudiante sin tutor seleccionado
  const [linkingStudent, setLinkingStudent] = useState<Student | null>(null)
  const [parentSearch, setParentSearch]     = useState('')
  const [parentOptions, setParentOptions]   = useState<ParentOption[]>([])
  const [searchingParents, setSearchingParents] = useState(false)
  const [assigningId, setAssigningId] = useState<number | null>(null)

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const fetchStudents = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    fetch(`${API_URL}/api/students?${params}`, { headers: auth() })
      .then(r => r.ok ? r.json() : [])
      .then(setStudents)
      .catch(() => toast('Error de conexión', 'error'))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchStudents, [])

  const groups = useMemo<CourseGroup[]>(() => {
    const byCourse = new Map<number, CourseGroup>()
    const sinMatricula: Student[] = []

    for (const s of students) {
      const a = s.assignments.find(x => x.academicYear.isActive)
      if (!a) { sinMatricula.push(s); continue }
      if (!byCourse.has(a.course.id)) byCourse.set(a.course.id, { course: a.course, students: [] })
      byCourse.get(a.course.id)!.students.push(s)
    }

    const result = Array.from(byCourse.values()).sort((a, b) => {
      const c1 = a.course!, c2 = b.course!
      return (LEVEL_ORDER[c1.level] - LEVEL_ORDER[c2.level]) || (GRADE_ORDER[c1.grade] - GRADE_ORDER[c2.grade]) || c1.parallel.localeCompare(c2.parallel)
    })
    for (const g of result) g.students.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es'))

    if (sinMatricula.length > 0) {
      sinMatricula.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es'))
      result.push({ course: null, students: sinMatricula })
    }
    return result
  }, [students])

  const openLinkTutor = (s: Student) => {
    setLinkingStudent(s)
    setParentSearch('')
    setParentOptions([])
  }

  const searchParents = async () => {
    if (!parentSearch.trim()) { setParentOptions([]); return }
    setSearchingParents(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents?search=${encodeURIComponent(parentSearch.trim())}`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setParentOptions(data)
    } catch { toast('Error de conexión', 'error') }
    finally { setSearchingParents(false) }
  }

  const handleAssignTutor = async (parent: ParentOption) => {
    if (!linkingStudent) return

    // Candado: el botón "Vincular tutor" solo aparece si el estudiante no
    // tiene ninguno, pero se revalida acá por si el estado de la tabla quedó
    // desactualizado (ej. otra pestaña ya le asignó uno) — se rechaza en vez
    // de reemplazarlo en silencio vía change-relation (mismo criterio que
    // linkStudents/createParent, ver parent.service.ts).
    const currentTutor = linkingStudent.parents.find(p => p.isTutor)
    if (currentTutor) {
      toast(`${linkingStudent.lastName} ${linkingStudent.firstName} ya tiene un tutor legal (${currentTutor.parent.lastName} ${currentTutor.parent.firstName}) — usá "Cambiar tutor" en su lugar.`, 'error')
      return
    }

    setAssigningId(parent.id)
    try {
      const yaVinculado = linkingStudent.parents.some(p => p.parent.id === parent.id)
      const res = yaVinculado
        ? await fetch(`${API_URL}/api/parents/${parent.id}/change-relation/${linkingStudent.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', ...auth() },
            body: JSON.stringify({ relationType: 'TUTOR_LEGAL', isTutor: true }),
          })
        : await fetch(`${API_URL}/api/parents/${parent.id}/link-students`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
            body: JSON.stringify({ studentIds: [linkingStudent.id], relationType: 'TUTOR_LEGAL', isTutor: true }),
          })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'No se pudo vincular el tutor', 'error'); return }
      toast(`${parent.firstName} ${parent.lastName} vinculado como tutor`, 'success')
      setLinkingStudent(null)
      fetchStudents()
    } catch { toast('Error de conexión', 'error') }
    finally { setAssigningId(null) }
  }

  const columns: Column<Student>[] = [
    { key: 'nombre', header: 'Estudiante', render: s => (
      <div>
        <div className="font-medium text-brand-700">{s.lastName} {s.firstName}</div>
        {s.ci && <div className="text-[11px] text-neutral-500">CI {s.ci}</div>}
      </div>
    ) },
    { key: 'tutor', header: 'Tutor', render: s => {
      const tutor = s.parents.find(p => p.isTutor)
      if (tutor) {
        return (
          <span className="text-[12.5px]">
            {tutor.parent.lastName} {tutor.parent.firstName}
            {tutor.parent.kardex && <span className="text-neutral-400"> · Kardex {tutor.parent.kardex}</span>}
          </span>
        )
      }
      return (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-400 italic">Sin tutor</span>
          <Button size="sm" variant="secondary" onClick={() => openLinkTutor(s)}><UserPlus size={12}/> Vincular tutor</Button>
        </div>
      )
    } },
    { key: 'estado', header: 'Estado', render: s => <Badge tone={s.isActive ? 'success' : 'danger'}>{s.isActive ? 'Activo' : 'Inactivo'}</Badge> },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Estudiantes</h1>
        <p className="text-[13px] text-neutral-500">Estudiantes registrados en el colegio, agrupados por curso</p>
      </div>

      <Card className="flex gap-2.5 flex-wrap items-center mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
          <Input placeholder="Buscar por nombre o CI..." value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchStudents()} className="pl-9" />
        </div>
        <Button variant="secondary" onClick={fetchStudents}>Buscar</Button>
      </Card>

      {loading ? (
        <Card className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></Card>
      ) : students.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-neutral-500">
          <Users size={40} className="text-neutral-300"/>
          <p className="text-[13px]">No se encontraron estudiantes</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(g => (
            <Card key={g.course?.id ?? 'sin-matricula'} padded={false} className="overflow-hidden">
              <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
                <Layers size={15}/>
                {g.course
                  ? <>{LEVEL_LABELS[g.course.level] || g.course.level} — {GRADE_LABELS[g.course.grade] || g.course.grade} &quot;{g.course.parallel}&quot;
                      <Badge tone="neutral">{SHIFT_LABELS[g.course.shift] || g.course.shift}</Badge></>
                  : <span className="text-neutral-500">Sin matrícula esta gestión</span>
                }
                <span className="text-[11px] text-neutral-400 font-normal ml-auto">{g.students.length} estudiante(s)</span>
              </div>
              <div className="p-4">
                <Table columns={columns} rows={g.students} rowKey={s => s.id} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!linkingStudent} onClose={() => setLinkingStudent(null)}
        title={linkingStudent ? `Vincular tutor — ${linkingStudent.lastName} ${linkingStudent.firstName}` : 'Vincular tutor'}
      >
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none"/>
            <Input
              placeholder="Buscar padre/madre por nombre o CI..." value={parentSearch} autoFocus
              onChange={e => setParentSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchParents()}
              className="pl-9"
            />
          </div>
          <Button variant="secondary" onClick={searchParents} loading={searchingParents}>Buscar</Button>

          {parentOptions.length === 0 ? (
            <p className="text-[12px] text-neutral-400 italic py-2">
              {parentSearch ? 'Sin resultados — probá con otro nombre o CI' : 'Escribí un nombre o CI y buscá'}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {parentOptions.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-neutral-200">
                  <div>
                    <div className="text-[13px] font-medium text-brand-700">{p.lastName} {p.firstName}</div>
                    <div className="text-[11px] text-neutral-500">
                      {p.ci ? `CI ${p.ci}` : 'Sin CI'}{p.kardex ? ` · Kardex ${p.kardex}` : ''}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleAssignTutor(p)} loading={assigningId === p.id}>Asignar</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
