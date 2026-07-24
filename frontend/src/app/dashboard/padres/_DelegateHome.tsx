'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, DollarSign, AlertCircle, CheckCircle, BookOpen, Phone, CreditCard, UserCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Table, { Column } from '@/components/ui/Table'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string
  charges:   { amount: number; paidAmount: number; status: string }[]
}

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  isActive:  boolean
  parents:   { relationType: string; isTutor: boolean; parent: Parent }[]
}

interface Assignment {
  id:      number
  year:    number
  student: Student
}

interface CourseTutor {
  teacher: { firstName: string; lastName: string }
}

interface Delegate {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string | null
  ci?:       string | null
}

interface Course {
  id:            number
  level:         string
  grade:         string
  parallel:      string
  educationType: string
  shift:         string
  assignments:   Assignment[]
  tutor?:        CourseTutor
  delegate?:     Delegate
}

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }
const LEVEL_LABELS: Record<string, string> = { INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria' }
const SHIFT_LABELS: Record<string, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

const fmt = (n: number) => `Bs. ${n.toFixed(2)}`

export default function DelegateDashboard() {
  const router  = useRouter()
  const [course,  setCourse]  = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const fetchCourse = async () => {
      const token = localStorage.getItem('token')
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/delegates/my-course`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok) setCourse(data)
        else setError(data.message)
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchCourse()
  }, [])

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>
  if (!course) return null

  const allParents = new Map<number, Parent>()
  course.assignments.forEach(a => {
    a.student.parents.forEach(ps => {
      if (ps.isTutor && !allParents.has(ps.parent.id)) {
        allParents.set(ps.parent.id, ps.parent)
      }
    })
  })

  const parents      = Array.from(allParents.values())
  const totalDebt    = parents.reduce((sum, p) => sum + p.charges.reduce((s, c) => s + c.amount, 0), 0)
  const totalPaid    = parents.reduce((sum, p) => sum + p.charges.reduce((s, c) => s + c.paidAmount, 0), 0)
  const totalPending = totalDebt - totalPaid
  const withDebt     = parents.filter(p => p.charges.some(c => c.status === 'PENDIENTE' || c.status === 'PARCIAL')).length

  const columns: Column<Assignment>[] = [
    { key: 'num', header: '#', render: (a) => <span className="text-xs text-neutral-500">{course.assignments.indexOf(a) + 1}</span> },
    {
      key: 'estudiante', header: 'Estudiante', render: a => (
        <div>
          <div className="font-medium text-brand-700">{a.student.lastName} {a.student.firstName}</div>
          {a.student.rude && <div className="text-[11px] text-neutral-500 mt-0.5">RUDE: {a.student.rude}</div>}
        </div>
      )
    },
    { key: 'ci', header: 'CI', render: a => <span className="text-xs text-neutral-500">{a.student.ci || '—'}</span> },
    {
      key: 'tutor', header: 'Tutor Legal', render: a => {
        const tutor = a.student.parents.find(ps => ps.isTutor)
        return tutor ? (
          <div>
            <div className="font-medium text-brand-700">{tutor.parent.lastName} {tutor.parent.firstName}</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">{tutor.relationType}</div>
          </div>
        ) : <span className="text-[11px] text-neutral-500 italic">Sin tutor</span>
      }
    },
    {
      key: 'telefono', header: 'Teléfono', render: a => {
        const tutor = a.student.parents.find(ps => ps.isTutor)
        return tutor?.parent.phone
          ? <span className="flex items-center gap-1 text-xs text-neutral-500"><Phone size={11}/> {tutor.parent.phone}</span>
          : <span className="text-xs text-neutral-500">—</span>
      }
    },
    {
      key: 'estado', header: 'Estado', render: a => {
        const tutor = a.student.parents.find(ps => ps.isTutor)
        const pendiente = tutor
          ? tutor.parent.charges.reduce((sum, c) => sum + (c.amount - c.paidAmount), 0)
          : 0
        return pendiente > 0
          ? <Badge tone="danger">{fmt(pendiente)}</Badge>
          : <Badge tone="success">Al día</Badge>
      }
    },
  ]

  return (
    <div>
      {/* Header del curso */}
      <Card className="flex items-start gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-brand-700 text-white flex items-center justify-center text-lg font-extrabold shrink-0">
          {GRADE_LABELS[course.grade]}{course.parallel}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-brand-700 mb-2">
            {LEVEL_LABELS[course.level]} — {GRADE_LABELS[course.grade]} &quot;{course.parallel}&quot;
          </h1>
          <div className="flex gap-2 flex-wrap mb-2">
            <Badge tone="brand">{SHIFT_LABELS[course.shift]}</Badge>
            {course.educationType === 'BTH' && <Badge tone="warning">BTH</Badge>}
            {course.tutor && <Badge tone="success">Tutor: {course.tutor.teacher.lastName} {course.tutor.teacher.firstName}</Badge>}
          </div>
          {course.delegate && (
            <div className="flex items-center gap-1.5 text-xs text-brand-700 bg-neutral-100 rounded-lg px-2.5 py-1.5 w-fit flex-wrap">
              <UserCircle size={14} className="text-brand-700"/>
              <span className="text-neutral-500">Delegado/a:</span>
              <strong className="font-bold">{course.delegate.lastName} {course.delegate.firstName}</strong>
              {course.delegate.phone && (
                <span className="flex items-center gap-1"><Phone size={11}/> {course.delegate.phone}</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Resumen */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-brand-100 text-brand-700"><Users size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Estudiantes</div><div className="text-lg font-bold text-brand-700">{course.assignments.length}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-danger-100 text-danger-600"><AlertCircle size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Con deuda</div><div className="text-lg font-bold text-brand-700">{withDebt}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-success-100 text-success-700"><CheckCircle size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Recaudado</div><div className="text-lg font-bold text-brand-700">{fmt(totalPaid)}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2.5 rounded-[10px] bg-danger-100 text-danger-600"><DollarSign size={20} /></div>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Pendiente</div><div className="text-lg font-bold text-brand-700">{fmt(totalPending)}</div></div>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <button
          className="flex items-center gap-2 px-4.5 py-2.5 bg-brand-700 text-white rounded-[10px] text-[13px] font-semibold hover:bg-brand-500 transition-colors"
          onClick={() => router.push('/dashboard/padres/tesoreria')}
        >
          <DollarSign size={18}/> Ver estado de cuentas
        </button>
        <button
          className="flex items-center gap-2 px-4.5 py-2.5 bg-success-500 text-white rounded-[10px] text-[13px] font-semibold hover:bg-success-700 transition-colors"
          onClick={() => router.push('/dashboard/padres/cargos/nuevo')}
        >
          <CreditCard size={18}/> Nuevo cargo
        </button>
        <button
          className="flex items-center gap-2 px-4.5 py-2.5 bg-info-500 text-white rounded-[10px] text-[13px] font-semibold hover:bg-brand-700 transition-colors"
          onClick={() => router.push('/dashboard/padres/asistencia')}
        >
          <Users size={18}/> Registrar asistencia
        </button>
      </div>

      {/* Lista de estudiantes */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
          <BookOpen size={15}/> Estudiantes del curso
        </div>
        {course.assignments.length === 0 ? (
          <p className="px-4.5 py-5 text-[13px] text-neutral-500 italic">No hay estudiantes inscritos</p>
        ) : (
          <div className="p-4">
            <Table columns={columns} rows={course.assignments} rowKey={a => a.id} />
          </div>
        )}
      </Card>
    </div>
  )
}
