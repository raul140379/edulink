'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Users, MessageCircle, BookOpen, GraduationCap } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string
  ci?:       string
}

interface Student {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  rude?:     string
  gender:    string
  isActive:  boolean
  parents:   { isTutor: boolean; parent: Parent }[]
}

interface Assignment {
  id:      number
  student: Student
}

interface CourseInfo {
  id:            number
  grade:         string
  parallel:      string
  level:         string
  shift:         string
  educationType: string
}

const GRADES: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const SHIFTS: Record<string, string> = {
  MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche',
}
const LEVELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIA: 'Primaria', SECUNDARIA: 'Secundaria',
}

export default function TeacherCursoPage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [courseInfo,  setCourseInfo]  = useState<CourseInfo | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [search,      setSearch]      = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token')
      setLoading(true)
      try {
        const [sRes, cRes] = await Promise.all([
          fetch(`${API_URL}/api/students/by-course/${courseId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/courses/${courseId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
        ])
        const [sData, cData] = await Promise.all([sRes.json(), cRes.json()])
        if (sRes.ok) setAssignments(sData)
        else setError(sData.message || 'Error al cargar estudiantes')
        if (cRes.ok) setCourseInfo(cData)
      } catch { setError('Error de conexión') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [courseId])

  const openWhatsApp = (phone: string, name: string) => {
    const msg = encodeURIComponent(`Estimado/a ${name}, le contactamos desde la U.E. Naciones Unidas.`)
    window.open(`https://wa.me/591${phone.replace(/\D/g, '')}?text=${msg}`, '_blank')
  }

  const filtered = assignments.filter(a => {
    const q = search.toLowerCase()
    return (
      a.student.firstName.toLowerCase().includes(q) ||
      a.student.lastName.toLowerCase().includes(q)  ||
      (a.student.ci   || '').toLowerCase().includes(q) ||
      (a.student.rude || '').toLowerCase().includes(q)
    )
  })

  const varones = assignments.filter(a => a.student.gender === 'MASCULINO').length
  const mujeres = assignments.filter(a => a.student.gender === 'FEMENINO').length

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (error)   return <div className="flex justify-center py-16"><p className="text-sm text-danger-600">{error}</p></div>

  return (
    <div>
      <div className="flex items-start gap-4 mb-5 flex-wrap">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px] py-1.5 whitespace-nowrap">
          <ArrowLeft size={16}/> Volver
        </button>
        <div className="flex-1">
          {courseInfo && (
            <>
              <h1 className="text-xl font-bold text-brand-700 mb-1">
                {GRADES[courseInfo.grade]} &quot;{courseInfo.parallel}&quot; · {SHIFTS[courseInfo.shift]}
              </h1>
              <p className="text-[13px] text-neutral-500">
                {LEVELS[courseInfo.level]}
                {courseInfo.educationType === 'BTH' && ' · BTH'}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Card className="!bg-brand-700 !border-brand-700 flex items-center gap-3">
          <Users size={24} className="text-white"/>
          <div><div className="text-[11px] text-white/70 uppercase tracking-wide mb-0.5">Total estudiantes</div><div className="text-xl font-bold text-white">{assignments.length}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <GraduationCap size={24} className="text-brand-700"/>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Varones</div><div className="text-xl font-bold text-brand-700">{varones}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <GraduationCap size={24} className="text-[#9B3070]"/>
          <div><div className="text-[11px] text-neutral-500 uppercase tracking-wide mb-0.5">Mujeres</div><div className="text-xl font-bold text-brand-700">{mujeres}</div></div>
        </Card>
      </div>

      <div className="mb-3.5">
        <Input placeholder="Buscar por nombre, CI o RUDE..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-bold text-brand-700">
          <BookOpen size={15}/> Estudiantes ({filtered.length})
        </div>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-neutral-500 italic">No se encontraron estudiantes</p>
        ) : (
          <div className="flex flex-col">
            {filtered.map((a, i) => {
              const tutor = a.student.parents.find(p => p.isTutor)
              return (
                <div key={a.id} className="flex items-start gap-3 px-4.5 py-3 border-t border-neutral-100 first:border-t-0 hover:bg-neutral-100/40">
                  <div className="text-xs text-neutral-500 min-w-[20px] pt-0.5">{i + 1}</div>
                  <div className="text-xl shrink-0">{a.student.gender === 'MASCULINO' ? '👦' : '👧'}</div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-brand-700 mb-0.5">{a.student.lastName} {a.student.firstName}</div>
                    <div className="flex gap-2.5 text-[11px] text-neutral-500 flex-wrap mb-1">
                      {a.student.ci   && <span>CI: {a.student.ci}</span>}
                      {a.student.rude && <span>RUDE: {a.student.rude}</span>}
                      {!a.student.isActive && <Badge tone="danger">Inactivo</Badge>}
                    </div>
                    {tutor && (
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                        <span className="font-semibold text-info-500">Tutor:</span>
                        <span className="text-brand-700">{tutor.parent.lastName} {tutor.parent.firstName}</span>
                        {tutor.parent.phone && (
                          <button
                            onClick={() => openWhatsApp(tutor.parent.phone!, `${tutor.parent.lastName} ${tutor.parent.firstName}`)}
                            className="flex items-center gap-1 bg-[#25D366] text-white rounded-[10px] px-1.5 py-0.5 text-[10px] shrink-0 hover:bg-[#1DA851] transition-colors"
                          >
                            <MessageCircle size={11}/> WhatsApp
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`text-base pt-0.5 shrink-0 ${a.student.gender === 'MASCULINO' ? 'text-brand-700' : 'text-[#9B3070]'}`}>
                    {a.student.gender === 'MASCULINO' ? '♂' : '♀'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
