'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, Users, ChevronRight,
  Lock, Edit3, Save
} from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import Table, { Column } from '@/components/ui/Table'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Trimester  { id: number; number: number; name: string | null; isClosed: boolean }
interface TeacherSubject {
  id: number; subjectId: number; courseId: number
  subject: { id: number; name: string }
  course:  { id: number; grade: string; parallel: string; level: string }
}
interface Student    { id: number; firstName: string; lastName: string; kardex: string | null }
interface NotaItem   { id: number; dimension: 'SABER'|'HACER'; titulo: string; puntaje: number; maxPuntaje: number; fecha: string|null }
interface Nota {
  id: number; saber: number|null; hacer: number|null; ser: number|null
  autoEvaluacion: number|null; total: number|null; cerrado: boolean
  items: NotaItem[]
}

const GRADES: Record<string,string> = {
  PRIMERO:'1°',SEGUNDO:'2°',TERCERO:'3°',CUARTO:'4°',QUINTO:'5°',SEXTO:'6°'
}

export default function TeacherNotasPage() {
  const toast = useToast()
  const [teacherId,  setTeacherId]  = useState<number|null>(null)
  const [trimestres, setTrimestres] = useState<Trimester[]>([])
  const [materias,   setMaterias]   = useState<TeacherSubject[]>([])
  const [selTrim,    setSelTrim]    = useState<Trimester|null>(null)
  const [selMateria, setSelMateria] = useState<TeacherSubject|null>(null)
  const [students,   setStudents]   = useState<Student[]>([])
  const [notas,      setNotas]      = useState<Record<number,Nota>>({})
  const [selStudent, setSelStudent] = useState<Student|null>(null)
  const [loading,    setLoading]    = useState(false)
  const [trimBlockMsg, setTrimBlockMsg] = useState<string|null>(null)
  const year = new Date().getFullYear()

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` })

  useEffect(() => {
    const init = async () => {
      try {
        const me = await fetch(`${API}/api/auth/me`,{headers:auth()}).then(r=>r.json())
        const tid = me.teacher?.id
        if (!tid) { toast('No se encontró el perfil del maestro', 'error'); return }
        setTeacherId(tid)
        const [trims, mats] = await Promise.all([
          fetch(`${API}/api/notas/trimestres?year=${year}`,{headers:auth()}).then(r=>r.json()),
          fetch(`${API}/api/notas/teacher-subjects/${tid}`,{headers:auth()}).then(r=>r.json()),
        ])
        setTrimestres(Array.isArray(trims)?trims:[])
        setMaterias(Array.isArray(mats)?mats:[])
        if (Array.isArray(trims)&&trims.length>0) setSelTrim(trims[0])
      } catch { toast('Error al cargar datos iniciales', 'error') }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadStudentsAndNotas = useCallback(async () => {
    if (!selMateria||!selTrim) return
    setLoading(true); setStudents([]); setNotas({}); setSelStudent(null)
    try {
      const [studs, notasArr] = await Promise.all([
        fetch(`${API}/api/notas/course-students/${selMateria.courseId}?year=${year}`,{headers:auth()}).then(r=>r.json()),
        fetch(`${API}/api/notas/course/${selMateria.courseId}?trimesterId=${selTrim.id}`,{headers:auth()}).then(r=>r.json()),
      ])
      setStudents(Array.isArray(studs)?studs:[])
      const map: Record<number,Nota> = {}
      if (Array.isArray(notasArr)) {
        notasArr.filter((n:any)=>n.subjectId===selMateria.subjectId)
          .forEach((n:any)=>{ map[n.studentId]=n })
      }
      setNotas(map)

      if (selTrim.isClosed) {
        setTrimBlockMsg(`🔒 El ${selTrim.number}° Trimestre fue cerrado por la dirección. No se pueden modificar notas.`)
      } else if (selTrim.number > 1) {
        const trimAnterior = trimestres.find(t => t.number === selTrim.number - 1)
        if (trimAnterior) {
          const notasAnt = await fetch(
            `${API}/api/notas/course/${selMateria.courseId}?trimesterId=${trimAnterior.id}`,
            {headers:auth()}
          ).then(r=>r.json())
          const notasAntMateria = Array.isArray(notasAnt)
            ? notasAnt.filter((n:any) => n.subjectId === selMateria.subjectId)
            : []
          if (notasAntMateria.length === 0) {
            setTrimBlockMsg(`⚠️ El ${selTrim.number - 1}° Trimestre no tiene notas registradas. Debes completarlo antes.`)
          } else if (!notasAntMateria.every((n:any) => n.cerrado)) {
            setTrimBlockMsg(`⚠️ El ${selTrim.number - 1}° Trimestre no está completamente cerrado. Ciérralo antes de continuar.`)
          } else {
            setTrimBlockMsg(null)
          }
        }
      } else {
        setTrimBlockMsg(null)
      }

    } catch { toast('Error al cargar estudiantes', 'error') }
    finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selMateria, selTrim, trimestres])

  useEffect(()=>{ loadStudentsAndNotas() },[loadStudentsAndNotas])

  const openDetalle = async (student: Student) => {
    if (!selMateria||!selTrim||!teacherId) return
    let nota = notas[student.id]
    if (!nota) {
      try {
        const res = await fetch(`${API}/api/notas/init`,{
          method:'POST', headers:{...auth(),'Content-Type':'application/json'},
          body: JSON.stringify({
            studentId: student.id, subjectId: selMateria.subjectId,
            courseId: selMateria.courseId, teacherId, trimesterId: selTrim.id
          })
        })
        nota = await res.json()
        setNotas(prev=>({...prev,[student.id]:{...nota,items:[]}}))
      } catch { toast('Error al inicializar nota', 'error'); return }
    }
    try {
      const det = await fetch(`${API}/api/notas/detalle/${nota.id}`,{headers:auth()}).then(r=>r.json())
      setNotas(prev=>({...prev,[student.id]:det}))
    } catch {}
    setSelStudent(student)
  }

  const refreshNota = async (notaId:number, studentId:number) => {
    try {
      const det = await fetch(`${API}/api/notas/detalle/${notaId}`,{headers:auth()}).then(r=>r.json())
      setNotas(prev=>({...prev,[studentId]:det}))
    } catch {}
  }

  const nota = selStudent ? notas[selStudent.id] : null

  const totalSinNota = students.filter(s=>!notas[s.id]?.total).length
  const aprobados    = students.filter(s=>{ const t=notas[s.id]?.total; return t!=null&&t>=51 }).length
  const reprobados   = students.filter(s=>{ const t=notas[s.id]?.total; return t!=null&&t<51 }).length

  const courseLabel = selMateria
    ? `${GRADES[selMateria.course.grade]||selMateria.course.grade} "${selMateria.course.parallel}"`
    : ''

  const columns: Column<Student>[] = [
    { key: 'num', header: '#', render: (s) => <span className="text-xs text-neutral-500">{students.indexOf(s) + 1}</span> },
    { key: 'estudiante', header: 'Estudiante', render: s => <span className="font-medium text-brand-700">{s.lastName} {s.firstName}</span> },
    { key: 'kardex', header: 'Kardex', render: s => <span className="text-xs text-neutral-500 font-mono">{s.kardex ?? '—'}</span> },
    { key: 'saber', header: 'Saber/45', className: 'text-center', render: s => notas[s.id]?.saber != null ? notas[s.id].saber!.toFixed(1) : <span className="text-neutral-500">—</span> },
    { key: 'hacer', header: 'Hacer/40', className: 'text-center', render: s => notas[s.id]?.hacer != null ? notas[s.id].hacer!.toFixed(1) : <span className="text-neutral-500">—</span> },
    { key: 'ser', header: 'Ser/10', className: 'text-center', render: s => notas[s.id]?.ser != null ? notas[s.id].ser!.toFixed(1) : <span className="text-neutral-500">—</span> },
    { key: 'auto', header: 'AutoEval/5', className: 'text-center', render: s => notas[s.id]?.autoEvaluacion != null ? notas[s.id].autoEvaluacion!.toFixed(1) : <span className="text-neutral-500">—</span> },
    {
      key: 'total', header: 'Total', className: 'text-center', render: s => {
        const total = notas[s.id]?.total
        const aprobado = total != null && total >= 51
        return total != null
          ? <strong className={aprobado ? 'text-success-700' : 'text-danger-600'}>{total.toFixed(1)}</strong>
          : <span className="text-neutral-500">—</span>
      }
    },
    {
      key: 'estado', header: 'Estado', className: 'text-center', render: s => {
        const n = notas[s.id]
        const total = n?.total
        const aprobado = total != null && total >= 51
        if (n?.cerrado) return <Badge tone="warning"><Lock size={10}/> Cerrado</Badge>
        if (total != null) return <Badge tone={aprobado ? 'success' : 'danger'}>{aprobado ? 'Aprobado' : 'Reprobado'}</Badge>
        return <Badge tone="neutral">Sin nota</Badge>
      }
    },
    {
      key: 'accion', header: '', render: s => (
        <Button
          size="sm" variant="secondary" disabled={!!trimBlockMsg}
          onClick={() => !trimBlockMsg && openDetalle(s)}
        >
          <Edit3 size={13}/> Editar <ChevronRight size={12}/>
        </Button>
      )
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Registro de Notas</h1>
        <p className="text-xs text-neutral-500">Gestión {year} · Saber(45) + Hacer(40) + Ser(10) + Autoevaluación(5) = 100 pts · Aprobado ≥ 51</p>
      </div>

      <Card className="flex flex-wrap gap-5 mb-5">
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">Trimestre</div>
          <div className="flex gap-2 flex-wrap">
            {trimestres.map(t => (
              <button
                key={t.id} onClick={() => setSelTrim(t)}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${selTrim?.id === t.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-brand-700 border-neutral-300 hover:border-brand-500'}`}
              >
                {t.name || `${t.number}° Trimestre`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-1" style={{ minWidth: 240 }}>
          <div className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">Materia</div>
          <Select
            value={selMateria?.id ?? ''}
            onChange={e => setSelMateria(materias.find(m => m.id === parseInt(e.target.value)) ?? null)}
          >
            <option value="">— Seleccionar materia —</option>
            {materias.map(m => (
              <option key={m.id} value={m.id}>
                {m.subject.name} · {GRADES[m.course.grade] || m.course.grade} &quot;{m.course.parallel}&quot;
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {!selMateria && (
        <Card className="flex flex-col items-center gap-3 py-14 text-neutral-500">
          <BookOpen size={48} className="text-neutral-300"/>
          <p>Selecciona un trimestre y una materia</p>
        </Card>
      )}

      {selMateria && loading && <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>}

      {selMateria && !loading && students.length > 0 && !selStudent && (
        <>
          {trimBlockMsg && (
            <div className="bg-warning-100 border border-warning-500 rounded-[10px] px-4.5 py-3.5 text-[13px] text-[#7D4E00] font-medium mb-4">
              {trimBlockMsg}
            </div>
          )}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Card className="text-center"><div className="text-[28px] font-extrabold text-brand-700">{students.length}</div><div className="text-xs text-neutral-500 mt-1">Estudiantes</div></Card>
            <Card className="text-center"><div className="text-[28px] font-extrabold text-success-700">{aprobados}</div><div className="text-xs text-neutral-500 mt-1">Aprobados</div></Card>
            <Card className="text-center"><div className="text-[28px] font-extrabold text-danger-600">{reprobados}</div><div className="text-xs text-neutral-500 mt-1">Reprobados</div></Card>
            <Card className="text-center"><div className="text-[28px] font-extrabold text-[#BA7517]">{totalSinNota}</div><div className="text-xs text-neutral-500 mt-1">Sin nota</div></Card>
          </div>

          <Card padded={false} className="overflow-hidden">
            <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] text-neutral-500 flex-wrap">
              <Users size={14}/>
              <strong className="text-brand-700">{courseLabel}</strong>
              <span>·</span><span>{selMateria.subject.name}</span>
              <span>·</span><span>{selTrim?.name || `${selTrim?.number}° Trimestre`}</span>
            </div>
            <div className="p-4">
              <Table columns={columns} rows={students} rowKey={s => s.id} />
            </div>
          </Card>
        </>
      )}

      {selStudent && nota && (
        <DetalleNota
          student={selStudent} nota={nota}
          selMateria={selMateria!} selTrim={selTrim!}
          onBack={()=>setSelStudent(null)}
          onRefresh={()=>refreshNota(nota.id, selStudent.id)}
        />
      )}
    </div>
  )
}

function DetalleNota({
  student, nota, selMateria, selTrim, onBack, onRefresh
}: {
  student: Student; nota: Nota; selMateria: TeacherSubject; selTrim: Trimester
  onBack: ()=>void; onRefresh: ()=>void
}) {
  const confirm = useConfirm()
  const toast   = useToast()
  const [serVal, setSerVal] = useState(nota.ser != null ? String(nota.ser) : '')
  const [saving, setSaving] = useState(false)
  const auth = { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' }

  const itemsSaber = nota.items.filter(i => i.dimension === 'SABER')
  const itemsHacer = nota.items.filter(i => i.dimension === 'HACER')

  const saveSer = async () => {
    const val = parseFloat(serVal)
    if (isNaN(val) || val < 0 || val > 10) { toast('Ser debe estar entre 0 y 10', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/notas/${nota.id}/ser`, {
        method: 'PUT', headers: auth, body: JSON.stringify({ ser: val })
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Error', 'error'); return }
      toast('Nota Ser guardada', 'success')
      onRefresh()
    } catch { toast('Error de conexión', 'error') }
    finally { setSaving(false) }
  }

  const cerrar = async () => {
    if (!await confirm('¿Cerrar el trimestre? Esta acción no se puede deshacer.', { danger: true })) return
    try {
      const res = await fetch(`${API}/api/notas/${nota.id}/cerrar`, { method: 'PUT', headers: auth })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Error', 'error'); return }
      toast('Trimestre cerrado', 'success')
      onRefresh()
    } catch { toast('Error de conexión', 'error') }
  }

  const total    = nota.total
  const aprobado = total != null && total >= 51

  return (
    <Card>
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <Button variant="secondary" size="sm" onClick={onBack}>← Volver</Button>
        <div>
          <div className="text-base font-bold text-brand-700">{student.lastName} {student.firstName}</div>
          <div className="text-xs text-neutral-500">{selMateria.subject.name} · {selTrim.name || `${selTrim.number}° Trimestre`}</div>
        </div>
        {nota.cerrado
          ? <Badge tone="warning" className="ml-auto"><Lock size={12}/> Trimestre cerrado</Badge>
          : total != null && (
            <Button variant="danger" size="sm" onClick={cerrar} className="ml-auto">
              <Lock size={13}/> Cerrar trimestre
            </Button>
          )}
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <DimCard label="Saber" max={45} value={nota.saber} colorVar="var(--color-brand-700)" items={itemsSaber.length}/>
        <DimCard label="Hacer" max={40} value={nota.hacer} colorVar="var(--color-success-500)" items={itemsHacer.length}/>
        <DimCard label="Ser" max={10} value={nota.ser} colorVar="#1565C0" items={null}/>
        <DimCard label="Autoevaluación" max={5} value={nota.autoEvaluacion} colorVar="var(--color-info-500)" items={null}/>
        <div className="bg-neutral-100/60 border border-brand-700 rounded-[10px] p-3.5 text-center">
          <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1.5">TOTAL</div>
          <div className={`text-[32px] font-extrabold ${aprobado ? 'text-success-700' : 'text-danger-600'}`}>{total != null ? total.toFixed(1) : '—'}</div>
          <div className="text-[11px] text-neutral-500 mt-0.5">/ 100</div>
          {total != null && <div className="mt-1"><Badge tone={aprobado ? 'success' : 'danger'}>{aprobado ? 'Aprobado' : 'Reprobado'}</Badge></div>}
        </div>
      </div>

      <ItemsReadOnly label="Saber" colorClass="text-brand-700" items={itemsSaber} maxPts={45}
        hint="Los ítems de Saber se registran automáticamente desde el módulo de Tareas y Exámenes."/>

      <ItemsReadOnly label="Hacer" colorClass="text-success-700" items={itemsHacer} maxPts={40}
        hint="Los ítems de Hacer se registran automáticamente desde el módulo de Tareas y Exámenes."/>

      <Card className="mb-3.5">
        <div className="flex items-center gap-2 text-sm font-bold mb-3" style={{ color: '#1565C0' }}>
          Ser <Badge tone="info">máx 10 pts</Badge>
        </div>
        {nota.cerrado
          ? <div className="text-xl font-bold text-brand-700 mb-2">{nota.ser != null ? nota.ser : '—'} / 10</div>
          : (
            <div className="flex items-center gap-3">
              <input
                type="number" min={0} max={10} step={0.5}
                value={serVal} onChange={e => setSerVal(e.target.value)}
                placeholder="0 – 10"
                className="w-[90px] px-2.5 py-1.5 border border-neutral-300 rounded-lg text-sm text-brand-700 outline-none text-center focus:border-info-500"
              />
              <Button size="sm" onClick={saveSer} disabled={saving}>
                <Save size={13}/> Guardar
              </Button>
            </div>
          )}
        <p className="text-xs text-neutral-500 mt-2">Valores, ética, actitud y convivencia. Lo ingresa el maestro al finalizar el trimestre.</p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-sm font-bold text-info-500 mb-3">
          Autoevaluación <Badge tone="info">máx 5 pts</Badge>
        </div>
        <div className="text-xl font-bold text-brand-700 mb-2">{nota.autoEvaluacion != null ? nota.autoEvaluacion : '—'} / 5</div>
        <p className="text-xs text-neutral-500 mt-2">La ingresa el propio estudiante desde su dashboard.</p>
      </Card>
    </Card>
  )
}

function DimCard({ label, max, value, colorVar, items }: { label: string; max: number; value: number|null; colorVar: string; items: number|null }) {
  return (
    <div className="bg-neutral-100/60 border border-neutral-300 rounded-[10px] p-3.5 text-center">
      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1.5">{label}</div>
      <div className="text-2xl font-extrabold" style={{ color: colorVar }}>{value != null ? value.toFixed(1) : '—'}</div>
      <div className="text-[11px] text-neutral-500 mt-0.5">/ {max}</div>
      {items != null && <div className="text-[11px] text-neutral-500 mt-1">{items} ítem{items !== 1 ? 's' : ''}</div>}
    </div>
  )
}

function ItemsReadOnly({ label, colorClass, items, maxPts, hint }: {
  label: string; colorClass: string; items: NotaItem[]; maxPts: number; hint?: string
}) {
  return (
    <Card className="mb-3.5">
      <div className={`flex items-center gap-2 text-sm font-bold mb-3 ${colorClass}`}>
        {label}
        <Badge tone="neutral">Solo lectura</Badge>
      </div>
      {hint && <p className="text-xs text-neutral-500 italic mb-2.5">{hint}</p>}
      {items.length === 0
        ? <p className="text-xs text-neutral-500">Sin ítems registrados. Crea tareas o exámenes desde el módulo correspondiente.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-neutral-100">
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-neutral-500 uppercase">Título</th>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-neutral-500 uppercase">Fecha</th>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-neutral-500 uppercase">Puntaje</th>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-neutral-500 uppercase">Máx</th>
                  <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-neutral-500 uppercase">→ pts</th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id} className="border-t border-neutral-100">
                    <td className="px-2.5 py-2 text-[13px] text-brand-700">{i.titulo}</td>
                    <td className="px-2.5 py-2 text-xs text-neutral-500">{i.fecha ? new Date(i.fecha).toLocaleDateString('es-BO') : '—'}</td>
                    <td className="px-2.5 py-2 text-[13px] font-bold text-brand-700">{i.puntaje}</td>
                    <td className="px-2.5 py-2 text-xs text-neutral-500">{i.maxPuntaje}</td>
                    <td className="px-2.5 py-2 text-xs text-neutral-500">{Math.round((i.puntaje / i.maxPuntaje) * maxPts * 100) / 100} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </Card>
  )
}
