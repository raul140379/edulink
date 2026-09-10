'use client'

import { useEffect, useState } from 'react'
import { Download, Search } from 'lucide-react'
import QRCode from 'qrcode'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'
import { useSchoolConfig } from '@/hooks/useSchoolConfig'
import API_URL from '@/lib/api'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }

interface CourseOption { id: number; grade: string; parallel: string; level: string; shift: string }
const courseLabel = (c: CourseOption) => `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}"`

interface StudentRow {
  id: number
  firstName: string
  lastName: string
  rude: string | null
  isActive: boolean
}

// Mismo mecanismo que admin/portero/codigoQR (QR generado en el cliente con
// el paquete `qrcode`, formato carnet para imprimir todos de una vez) — acá
// el contenido del QR es el RUDE del estudiante en vez del attendanceCode,
// y el universo es un curso completo en vez de todo el personal.
export default function CodigosQREstudiantesPage() {
  const toast = useToast()
  const district = useDistrictConfig()
  const school = useSchoolConfig()

  const [courses, setCourses] = useState<CourseOption[]>([])
  const [courseId, setCourseId] = useState<number | null>(null)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<StudentRow | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : '') || ''
  const auth = () => ({ Authorization: `Bearer ${token()}` })

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/courses`, { headers: auth() })
        const list: CourseOption[] = await res.json()
        setCourses(list)
        if (list.length > 0) setCourseId(list[0].id)
      } catch { toast('Error al cargar los cursos', 'error') }
      finally { setLoadingCourses(false) }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })()
  }, [])

  useEffect(() => {
    if (!courseId) return
    setLoadingStudents(true)
    setSelected(null)
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/api/students/by-course/${courseId}`, { headers: auth() })
        const data = await res.json()
        if (!res.ok) { toast('Error al cargar estudiantes', 'error'); return }
        setStudents(
          data
            .map((a: any) => a.student as StudentRow)
            .filter((s: StudentRow) => s.isActive)
            .sort((a: StudentRow, b: StudentRow) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es')),
        )
      } catch { toast('Error de conexión', 'error') }
      finally { setLoadingStudents(false) }
    })()
  }, [courseId])

  useEffect(() => {
    if (selected?.rude) {
      QRCode.toDataURL(selected.rude, { width: 300, margin: 2, color: { dark: '#0F172A', light: '#FFFFFF' } })
        .then(setQrDataUrl).catch(() => setQrDataUrl(''))
    } else {
      setQrDataUrl('')
    }
  }, [selected])

  const selectedCourse = courses.find((c) => c.id === courseId) || null
  const schoolName = school.name || 'U.E.'

  const handlePrint = () => {
    if (!selected || !qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>QR - ${selected.lastName} ${selected.firstName}</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px; }
        .card { border: 2px solid #0A5A45; border-radius: 12px; padding: 24px; text-align: center; max-width: 280px; }
        .name { font-size: 16px; font-weight: 700; color: #0A5A45; margin: 12px 0 4px; }
        .role { font-size: 12px; color: #6B8F7F; margin-bottom: 8px; }
        .code { font-size: 13px; font-weight: 700; letter-spacing: 1px; color: #0F172A; font-family: monospace; }
        .school { font-size: 11px; color: #94A3B8; margin-top: 12px; }
        img { width: 220px; height: 220px; }
      </style></head><body>
      <div class="card">
        <div class="school">${schoolName}${district.location ? ` — ${district.location}` : ''}</div>
        <img src="${qrDataUrl}" alt="QR"/>
        <div class="name">${selected.lastName} ${selected.firstName}</div>
        <div class="role">${selectedCourse ? courseLabel(selectedCourse) : ''}</div>
        <div class="code">${selected.rude}</div>
      </div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `)
    win.document.close()
  }

  const handlePrintAll = async () => {
    const withRude = students.filter((s) => s.rude)
    if (withRude.length === 0) { toast('Ningún estudiante de este curso tiene RUDE cargado', 'error'); return }

    const cards = await Promise.all(withRude.map(async (s) => {
      const url = await QRCode.toDataURL(s.rude!, { width: 200, margin: 1, color: { dark: '#0F172A', light: '#FFFFFF' } })
      return `
        <div class="card">
          <div class="school">${schoolName}</div>
          <img src="${url}" alt="QR"/>
          <div class="name">${s.lastName} ${s.firstName}</div>
          <div class="role">${selectedCourse ? courseLabel(selectedCourse) : ''}</div>
          <div class="code">${s.rude}</div>
        </div>
      `
    }))

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>Códigos QR — ${selectedCourse ? courseLabel(selectedCourse) : ''}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 16px; color: #0A5A45; text-align: center; margin-bottom: 20px; }
        .grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
        .card { border: 1.5px solid #0A5A45; border-radius: 10px; padding: 14px; text-align: center; width: 180px; page-break-inside: avoid; }
        .name { font-size: 11px; font-weight: 700; color: #0A5A45; margin: 8px 0 2px; }
        .role { font-size: 9px; color: #6B8F7F; margin-bottom: 4px; }
        .code { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; color: #0F172A; font-family: monospace; }
        .school { font-size: 9px; color: #94A3B8; }
        img { width: 150px; height: 150px; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <h1>Códigos QR de Estudiantes — ${schoolName} — ${selectedCourse ? courseLabel(selectedCourse) : ''}</h1>
      <div class="grid">${cards.join('')}</div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `)
    win.document.close()
  }

  const filtered = students.filter((s) =>
    search === '' || `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()),
  )
  const withRudeCount = students.filter((s) => s.rude).length

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Códigos QR de Estudiantes</h1>
          <p className="text-[13px] text-neutral-500">Generá e imprimí los QR (RUDE) de un curso completo, tipo carnet — para escanear desde la app de Regente</p>
        </div>
        <div className="flex gap-2.5 items-end">
          <div className="w-56">
            <Select label="Curso" value={courseId ?? ''} onChange={(e) => setCourseId(Number(e.target.value))} disabled={loadingCourses}>
              {courses.map((c) => <option key={c.id} value={c.id}>{courseLabel(c)}</option>)}
            </Select>
          </div>
          <Button variant="secondary" onClick={handlePrintAll} className="!bg-success-700 !text-white !border-success-700">
            <Download size={14}/> Imprimir todos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="text-center">
          <div className="text-[28px] font-extrabold text-brand-700">{students.length}</div>
          <div className="text-[11px] text-neutral-500">Estudiantes en el curso</div>
        </Card>
        <Card className="text-center !bg-success-100 !border-success-500/40">
          <div className="text-[28px] font-extrabold text-success-700">{withRudeCount}</div>
          <div className="text-[11px] text-success-700/80">Con RUDE (QR disponible)</div>
        </Card>
        <Card className="text-center !bg-danger-100 !border-danger-500/40">
          <div className="text-[28px] font-extrabold text-danger-600">{students.length - withRudeCount}</div>
          <div className="text-[11px] text-danger-600/80">Sin RUDE</div>
        </Card>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 340px' }}>
        <div>
          <div className="relative mb-3.5">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500"/>
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className="w-full pl-8 pr-3 py-2.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none box-border"
            />
          </div>

          <Card padded={false} className="overflow-hidden">
            {loadingStudents ? (
              <div className="p-12 text-center text-neutral-500">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-neutral-500">Sin estudiantes para este curso</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-neutral-100">
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Estudiante</th>
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">RUDE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setSelected(s)}
                        className={`border-t border-neutral-100 cursor-pointer ${selected?.id === s.id ? 'bg-brand-100' : 'hover:bg-neutral-100/50'}`}
                      >
                        <td className="px-3.5 py-2.5 align-middle text-[13px] font-semibold text-brand-700">{s.lastName} {s.firstName}</td>
                        <td className="px-3.5 py-2.5 align-middle">
                          {s.rude ? (
                            <span className="font-mono text-xs text-brand-700">{s.rude}</span>
                          ) : (
                            <span className="text-[11px] text-danger-600">Sin RUDE</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card className="sticky top-5">
            {!selected ? (
              <div className="text-center py-10 px-5 text-neutral-500">
                <div className="text-4xl mb-3">👆</div>
                <div className="text-[13px]">Selecciona un estudiante para ver su QR</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-[11px] text-neutral-500 mb-1 uppercase tracking-wide">{schoolName}</div>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR" className="w-[220px] h-[220px] rounded-lg mx-auto"/>
                ) : (
                  <div className="w-[220px] h-[220px] bg-neutral-100 rounded-lg flex items-center justify-center mx-auto text-neutral-500 text-[13px]">
                    Sin RUDE — no se puede generar QR
                  </div>
                )}
                <div className="text-base font-bold text-brand-700 mt-3">{selected.lastName} {selected.firstName}</div>
                <div className="text-xs text-neutral-500 mb-2">{selectedCourse ? courseLabel(selectedCourse) : ''}</div>
                {selected.rude && (
                  <div className="text-[13px] font-bold tracking-[1px] text-[#0F172A] font-mono mb-4">{selected.rude}</div>
                )}
                {selected.rude && (
                  <Button onClick={handlePrint} className="w-full justify-center">
                    <Download size={13}/> Imprimir
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
