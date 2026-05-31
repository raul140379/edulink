'use client'

import { useState, useEffect } from 'react'
import { Save, BookOpen, Users, CheckCircle, AlertCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL

interface Trimester { id: number; number: number; name: string | null }
interface TeacherSubject { id: number; subjectId: number; courseId: number; subject: { id: number; name: string }; course: { id: number; grade: string; parallel: string; level: string } }
interface Student { id: number; firstName: string; lastName: string; kardex: string | null }

export default function TeacherNotasPage() {
  const [teacherId, setTeacherId] = useState<number | null>(null)
  const [trimestres, setTrimestres] = useState<Trimester[]>([])
  const [materias, setMaterias] = useState<TeacherSubject[]>([])
  const [selectedTrimestre, setSelectedTrimestre] = useState<Trimester | null>(null)
  const [selectedMateria, setSelectedMateria] = useState<TeacherSubject | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Record<number, string>>({})
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const year = new Date().getFullYear()

  const token = () => localStorage.getItem('token')

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  // 1. Cargar datos iniciales
  useEffect(() => {
    const init = async () => {
      try {
        // Obtener teacher del usuario logueado
        const meRes = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token()}` },
        })
        const me = await meRes.json()
        const tid = me.teacher?.id
        if (!tid) return
        setTeacherId(tid)

        // Trimestres y materias en paralelo
        const [trimRes, matRes] = await Promise.all([
          fetch(`${API}/notas/trimestres?year=${year}`, {
            headers: { Authorization: `Bearer ${token()}` },
          }),
          fetch(`${API}/notas/teacher-subjects/${tid}`, {
            headers: { Authorization: `Bearer ${token()}` },
          }),
        ])

        const trimData = await trimRes.json()
        const matData = await matRes.json()

        setTrimestres(Array.isArray(trimData) ? trimData : [])
        setMaterias(Array.isArray(matData) ? matData : [])

        // Pre-seleccionar el trimestre activo (según fecha)
        if (Array.isArray(trimData) && trimData.length > 0) {
          setSelectedTrimestre(trimData[0])
        }
      } catch (err) {
        console.error(err)
        showToast('err', 'Error al cargar datos iniciales')
      }
    }
    init()
  }, [])

  // 2. Cargar estudiantes y notas existentes cuando cambia materia o trimestre
  useEffect(() => {
    if (!selectedMateria || !selectedTrimestre) return

    const load = async () => {
      setLoadingStudents(true)
      setStudents([])
      setGrades({})
      try {
        const [studRes, notasRes] = await Promise.all([
          fetch(`${API}/notas/course-students/${selectedMateria.courseId}?year=${year}`, {
            headers: { Authorization: `Bearer ${token()}` },
          }),
          fetch(`${API}/notas/course/${selectedMateria.courseId}?trimesterId=${selectedTrimestre.id}`, {
            headers: { Authorization: `Bearer ${token()}` },
          }),
        ])

        const studData = await studRes.json()
        const notasData = await notasRes.json()

        setStudents(Array.isArray(studData) ? studData : [])

        // Pre-llenar notas existentes de esta materia
        const map: Record<number, string> = {}
        if (Array.isArray(notasData)) {
          notasData
            .filter((n: any) => n.subjectId === selectedMateria.subjectId)
            .forEach((n: any) => { map[n.studentId] = String(n.value) })
        }
        setGrades(map)
      } catch (err) {
        console.error(err)
        showToast('err', 'Error al cargar estudiantes')
      } finally {
        setLoadingStudents(false)
      }
    }

    load()
  }, [selectedMateria, selectedTrimestre])

  const handleGradeChange = (studentId: number, val: string) => {
    if (val !== '' && val !== '-') {
      const num = parseFloat(val)
      if (isNaN(num) || num < 0 || num > 100) return
    }
    setGrades((prev) => ({ ...prev, [studentId]: val }))
  }

  const handleSave = async () => {
    if (!selectedMateria || !selectedTrimestre || !teacherId) return

    const payload = students
      .filter((s) => grades[s.id] !== undefined && grades[s.id] !== '')
      .map((s) => ({
        studentId: s.id,
        subjectId: selectedMateria.subjectId,
        courseId: selectedMateria.courseId,
        teacherId,
        trimesterId: selectedTrimestre.id,
        value: parseFloat(grades[s.id]),
      }))

    if (payload.length === 0) {
      showToast('err', 'No hay notas para guardar')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API}/notas/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ notas: payload }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('ok', `${data.saved} notas guardadas correctamente`)
      } else {
        showToast('err', data.error || 'Error al guardar')
      }
    } catch {
      showToast('err', 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // Estadísticas rápidas
  const notasIngresadas = students.filter((s) => grades[s.id] !== undefined && grades[s.id] !== '').length
  const aprobados = students.filter((s) => {
    const v = parseFloat(grades[s.id])
    return !isNaN(v) && v >= 51
  }).length
  const reprobados = notasIngresadas - aprobados

  const courseLabel = selectedMateria
    ? `${selectedMateria.course.grade} "${selectedMateria.course.parallel}" — ${selectedMateria.course.level}`
    : ''

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#633806' }}>
          Registro de Notas
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Gestión {year} · Escala 0–100 · Aprobado ≥ 51
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
            toast.type === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {toast.type === 'ok'
            ? <CheckCircle size={16} />
            : <AlertCircle size={16} />}
          {toast.text}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex flex-wrap gap-6">

          {/* Selector de trimestre */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Trimestre
            </p>
            <div className="flex gap-2">
              {trimestres.length === 0 && (
                <span className="text-sm text-gray-400">Sin trimestres configurados</span>
              )}
              {trimestres.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTrimestre(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    selectedTrimestre?.id === t.id
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                  style={
                    selectedTrimestre?.id === t.id
                      ? { background: '#1A3A7C' }
                      : {}
                  }
                >
                  {t.name || `${t.number}° Trimestre`}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de materia */}
          <div className="flex-1 min-w-[240px]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Materia
            </p>
            <select
              value={selectedMateria?.id ?? ''}
              onChange={(e) => {
                const ts = materias.find((m) => m.id === parseInt(e.target.value))
                setSelectedMateria(ts ?? null)
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">— Seleccionar materia —</option>
              {materias.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.subject.name} · {m.course.grade} "{m.course.parallel}"
                </option>
              ))}
            </select>
            {materias.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No tienes materias asignadas aún.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Estado vacío — sin selección */}
      {!selectedMateria && (
        <div className="text-center py-20 text-gray-300">
          <BookOpen size={48} className="mx-auto mb-3" />
          <p className="text-gray-400">Selecciona un trimestre y una materia para comenzar</p>
        </div>
      )}

      {/* Cargando estudiantes */}
      {selectedMateria && loadingStudents && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Cargando estudiantes...
        </div>
      )}

      {/* Tabla de notas */}
      {selectedMateria && !loadingStudents && students.length > 0 && (
        <>
          {/* Stats rápidas */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Estudiantes', value: students.length, color: '#1A3A7C' },
              { label: 'Aprobados', value: aprobados, color: '#0F6E56' },
              { label: 'Reprobados', value: reprobados, color: '#dc2626' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users size={15} className="text-gray-400" />
                <span className="font-semibold">{courseLabel}</span>
                <span className="text-gray-300 mx-1">·</span>
                <span>{selectedMateria.subject.name}</span>
                <span className="text-gray-300 mx-1">·</span>
                <span>{selectedTrimestre?.name || `${selectedTrimestre?.number}° Trimestre`}</span>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-opacity"
                style={{ background: '#0F6E56' }}
              >
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium w-8">#</th>
                  <th className="text-left px-5 py-3 font-medium">Estudiante</th>
                  <th className="text-left px-3 py-3 font-medium w-24">Kardex</th>
                  <th className="text-center px-3 py-3 font-medium w-36">Nota (0–100)</th>
                  <th className="text-center px-3 py-3 font-medium w-28">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((student, i) => {
                  const val = grades[student.id] ?? ''
                  const num = parseFloat(val)
                  const tieneNota = val !== ''
                  const aprobado = tieneNota && !isNaN(num) && num >= 51
                  const reprobado = tieneNota && !isNaN(num) && num < 51

                  return (
                    <tr key={student.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-3 text-gray-300 text-xs">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {student.lastName} {student.firstName}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-400">
                        {student.kardex ?? '—'}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={val}
                          onChange={(e) => handleGradeChange(student.id, e.target.value)}
                          placeholder="—"
                          className="w-full text-center border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {!tieneNota ? (
                          <span className="text-gray-200 text-xs">—</span>
                        ) : aprobado ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            Aprobado
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            Reprobado
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {notasIngresadas} de {students.length} notas ingresadas
              </span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
                style={{ background: '#0F6E56' }}
              >
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar todas las notas'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sin estudiantes */}
      {selectedMateria && !loadingStudents && students.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p>No hay estudiantes inscritos en este curso para la gestión {year}.</p>
        </div>
      )}
    </div>
  )
}