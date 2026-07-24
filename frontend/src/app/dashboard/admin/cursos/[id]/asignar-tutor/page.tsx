'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, GraduationCap, Check } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Teacher {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  specialty?: string
  isActive?: boolean
  courseTutor?: { id: number } // si ya es tutor de otro curso
}

export default function AsignarTutorPage() {
  const params  = useParams()
  const router  = useRouter()
  const confirm = useConfirm()
  const toast   = useToast()
  const id      = params.id as string

  const [teachers,     setTeachers]     = useState<Teacher[]>([])
  const [currentTutor, setCurrentTutor] = useState<number | null>(null)
  const [selected,     setSelected]     = useState<number | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [cRes, tRes] = await Promise.all([
          fetch(`${API_URL}/api/courses/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/teachers`,      { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [cData, tData] = await Promise.all([cRes.json(), tRes.json()])

        if (cRes.ok && cData.tutor) {
          setCurrentTutor(cData.tutor.teacher.id)
          setSelected(cData.tutor.teacher.id)
        }

        if (tRes.ok && cRes.ok) {
          const teacherIdsInCourse = cData.teacherSubjects?.map((ts: any) => ts.teacher.id) || []
          const filtered = tData.filter((t: Teacher) => teacherIdsInCourse.includes(t.id))
          setTeachers(filtered)
        }
      } catch { toast('Error de conexión', 'error') }
      finally  { setLoading(false) }
    }
    fetchData()
  }, [id])

  const handleSave = async () => {
    if (!selected) { toast('Selecciona un maestro', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/courses/${id}/assign-tutor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ teacherId: selected }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setTimeout(() => router.push(`/dashboard/admin/cursos/${id}`), 1500)
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleRemove = async () => {
    if (!await confirm('¿Quitar el maestro tutor de este curso?', { danger: true })) return
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/courses/${id}/assign-tutor`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setTimeout(() => router.push(`/dashboard/admin/cursos/${id}`), 1500)
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  return (
    <div className="max-w-[600px] mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-neutral-500 hover:text-brand-700 text-[13px]">
          <ArrowLeft size={16}/> Volver
        </button>
        <h1 className="text-xl font-bold text-brand-700">Asignar Maestro Tutor</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : (
        <Card className="flex flex-col gap-4">
          <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 text-xs text-neutral-500 leading-relaxed">
            💡 El maestro tutor es el responsable del curso. Solo puede haber uno por curso y un maestro no puede ser tutor de más de un curso.
          </div>

          <div className="text-xs font-bold text-brand-700 uppercase tracking-wide pb-1 border-b border-neutral-100">Selecciona el maestro tutor</div>

          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
            {teachers.filter(t => t.isActive !== false).map(t => {
              const isCurrentTutor   = t.id === currentTutor
              const isTutorElsewhere = !!t.courseTutor && t.id !== currentTutor
              return (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selected === t.id ? 'border-success-500 bg-success-100' :
                    isTutorElsewhere  ? 'border-neutral-300 bg-neutral-100 opacity-50 cursor-not-allowed' :
                                        'border-neutral-300 hover:bg-neutral-100/60'
                  }`}
                >
                  <input
                    type="radio" name="teacher" value={t.id}
                    checked={selected === t.id}
                    disabled={isTutorElsewhere}
                    onChange={() => !isTutorElsewhere && setSelected(t.id)}
                    className="shrink-0 w-4 h-4 accent-success-700 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-brand-700 flex items-center gap-2 flex-wrap">
                      {t.lastName} {t.firstName}
                      {isCurrentTutor   && <Badge tone="success">Tutor actual</Badge>}
                      {isTutorElsewhere && <Badge tone="danger">Tutor de otro curso</Badge>}
                    </div>
                    {t.ci        && <div className="text-[11px] text-neutral-500 mt-0.5">CI: {t.ci}</div>}
                    {t.specialty && <div className="text-[11px] text-neutral-500 mt-0.5">Especialidad: {t.specialty}</div>}
                  </div>
                  {selected === t.id && <Check size={16} className="text-success-700"/>}
                </label>
              )
            })}
          </div>

          <div className="flex items-center gap-2.5 pt-2 border-t border-neutral-100">
            {currentTutor && (
              <Button variant="danger" onClick={handleRemove} disabled={saving}>Quitar tutor</Button>
            )}
            <div className="flex-1"/>
            <Button variant="secondary" onClick={() => router.back()}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !selected} loading={saving}>
              {!saving && <GraduationCap size={14}/>} {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
