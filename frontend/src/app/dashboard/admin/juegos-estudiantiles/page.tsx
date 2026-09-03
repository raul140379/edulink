'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trophy, Plus, Search, Download, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input, { Select } from '@/components/ui/Input'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }

// Catálogo oficial derivado de las 2 planillas reales (Sub-14 y Sub-19) —
// compartido entre ambas categorías, sin restricción del sistema sobre cuál
// corresponde a cada una (criterio manual del usuario, confirmado 2-sep-2026).
// Cada prueba de atletismo es su propia disciplina, no una sub-prueba de
// "Atletismo" — así aparece en la planilla real Sub-19 (columnas separadas).
const GRUPALES = ['Fútbol', 'Fútbol Sala (Futsal)', 'Baloncesto (Básquet)', 'Voleibol (Vóley)', 'Ciclismo de Montaña']
const INDIVIDUALES = [
  '100m Planos', '200m Planos', '400m Planos', '800m Planos', '3.000m Planos', '5.000m Planos',
  'Relevos 4x100', 'Salto de Longitud', 'Salto Triple', 'Impulsión de Bala', 'Lanzamiento de Disco', 'Lanzamiento de Jabalina',
]
const DISCIPLINES = [...GRUPALES, ...INDIVIDUALES]
const OTRO = 'Otro (especificar)'

const MODALITY_BY_DISCIPLINE: Record<string, 'INDIVIDUAL' | 'GRUPAL'> = {
  ...Object.fromEntries(GRUPALES.map(d => [d, 'GRUPAL' as const])),
  ...Object.fromEntries(INDIVIDUALES.map(d => [d, 'INDIVIDUAL' as const])),
}

const CATEGORIA_LABELS: Record<string, string> = { SUB14: 'Sub-14', SUB19: 'Sub-19' }
const ROL_LABELS: Record<string, string> = { JUGADOR: 'Jugador', ENTRENADOR: 'Entrenador', DELEGADO: 'Delegado' }

interface StudentHit {
  id: number; firstName: string; lastName: string
  ci?: string | null; rude?: string | null; birthDate?: string | null; gender?: 'MASCULINO' | 'FEMENINO'
}

interface Participant {
  id: number
  discipline: string
  modality: string | null
  categoria: 'SUB14' | 'SUB19'
  rolFuncion: string | null
  contactPhone: string | null
  student: {
    id: number
    fullName: string
    firstName: string
    lastName: string
    ci: string | null
    rude: string | null
    birthDate: string | null
    gender: 'MASCULINO' | 'FEMENINO'
    course: { grade: string; parallel: string } | null
  }
}

const formatDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const courseLabel = (c: Participant['student']['course']) => c ? `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}"` : '—'

// Advertencia blanda de edad (nunca bloquea) — rangos confirmados 2-sep-2026.
// Hay superposición real entre categorías, es esperado, no un error.
function ageWarning(birthDate: string | null | undefined, categoria: 'SUB14' | 'SUB19'): string | null {
  if (!birthDate) return null
  const d = new Date(birthDate)
  if (categoria === 'SUB19') {
    const year = d.getFullYear()
    if (year < 2007 || year > 2014) return `nacido en ${year} — fuera del rango típico Sub-19 (2007-2014)`
    return null
  }
  const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  if (age < 12 || age > 14) return `${age} años — fuera del rango típico Sub-14 (12-14 años)`
  return null
}

// Nombre/apellido no vienen separados en Student (solo firstName/lastName,
// lastName suele traer los 2 apellidos juntos) — la planilla Sub-14 real
// pide Apellido Paterno y Materno por separado. Mejor esfuerzo: primera
// palabra = paterno, resto = materno. No es exacto para apellidos
// compuestos (ej. "DE LA CRUZ") — limitación conocida, no oculta.
function splitApellidos(lastName: string): { paterno: string; materno: string } {
  const parts = lastName.trim().split(/\s+/)
  if (parts.length <= 1) return { paterno: parts[0] || '', materno: '' }
  return { paterno: parts[0], materno: parts.slice(1).join(' ') }
}

export default function JuegosEstudiantilesPage() {
  const toast    = useToast()
  const confirm  = useConfirm()
  const district = useDistrictConfig()

  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [disciplineFilter, setDisciplineFilter] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [disciplineChoice, setDisciplineChoice] = useState(DISCIPLINES[0])
  const [customDiscipline, setCustomDiscipline] = useState('')
  const [categoria, setCategoria] = useState<'SUB14' | 'SUB19'>('SUB19')
  const [rolFuncion, setRolFuncion] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<StudentHit[]>([])
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<StudentHit[]>([])
  const [saving, setSaving] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ message: string; created: number; skipped: number } | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const modality = disciplineChoice === OTRO ? undefined : MODALITY_BY_DISCIPLINE[disciplineChoice]

  const fetchParticipants = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/sports-participants`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al cargar', 'error'); return }
      setParticipants(data)
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchParticipants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const disciplineOptions = useMemo(() => {
    const set = new Set(participants.map(p => p.discipline))
    return Array.from(set).sort().map(d => ({ value: d, label: d }))
  }, [participants])

  const filtered = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return participants.filter(p => {
      if (disciplineFilter && p.discipline !== disciplineFilter) return false
      if (categoriaFilter && p.categoria !== categoriaFilter) return false
      if (words.length === 0) return true
      const haystack = `${p.student.fullName} ${p.student.ci || ''} ${p.student.rude || ''}`.toLowerCase()
      return words.every(w => haystack.includes(w))
    })
  }, [participants, search, disciplineFilter, categoriaFilter])

  const handleSearchStudents = async () => {
    if (!studentSearch.trim()) return
    setSearchingStudents(true)
    try {
      const res = await fetch(`${API_URL}/api/students?search=${encodeURIComponent(studentSearch)}&isActive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setStudentResults(res.ok ? data : [])
    } catch { setStudentResults([]) }
    finally { setSearchingStudents(false) }
  }

  const toggleStudent = (s: StudentHit) => {
    setSelectedStudents(prev => prev.some(x => x.id === s.id) ? prev.filter(x => x.id !== s.id) : [...prev, s])
  }

  const resetAddForm = () => {
    setDisciplineChoice(DISCIPLINES[0])
    setCustomDiscipline('')
    setCategoria('SUB19')
    setRolFuncion('')
    setContactPhone('')
    setStudentSearch('')
    setStudentResults([])
    setSelectedStudents([])
    setSubmitResult(null)
  }

  const closeAddModal = () => { setShowAdd(false); resetAddForm() }

  const handleSubmit = async () => {
    const discipline = disciplineChoice === OTRO ? customDiscipline.trim() : disciplineChoice
    if (!discipline) { toast('Indicá la disciplina', 'error'); return }
    if (selectedStudents.length === 0) { toast('Seleccioná al menos un estudiante', 'error'); return }

    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/sports-participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          studentIds: selectedStudents.map(s => s.id), discipline, modality, categoria,
          rolFuncion: rolFuncion || undefined, contactPhone: contactPhone.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al guardar', 'error'); return }
      setSubmitResult({ message: data.message, created: data.created, skipped: data.skipped })
      fetchParticipants()
    } catch { toast('Error de conexión', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (p: Participant) => {
    const ok = await confirm(`¿Quitar a ${p.student.fullName} de ${p.discipline}?`, { danger: true, confirmLabel: 'Quitar' })
    if (!ok) return
    try {
      const res = await fetch(`${API_URL}/api/sports-participants/${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al eliminar', 'error'); return }
      toast('Registro eliminado', 'success')
      setParticipants(prev => prev.filter(x => x.id !== p.id))
    } catch { toast('Error de conexión', 'error') }
  }

  const schoolLabel = district.name || 'U.E. Naciones Unidas'

  // Sub-14: una planilla por disciplina + género (coincide con la muestra
  // real, que declara "DISCIPLINA:" y el género en el título de cada hoja) —
  // varias tablas, cada una en su propia página del mismo PDF.
  const exportSub14 = async () => {
    const rows = participants.filter(p => p.categoria === 'SUB14')
    if (rows.length === 0) { toast('No hay deportistas Sub-14 registrados', 'error'); return }
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()

    const groups = new Map<string, Participant[]>()
    for (const p of rows) {
      const key = `${p.discipline}__${p.student.gender}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(p)
    }

    let first = true
    for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const [discipline, gender] = key.split('__')
      if (!first) doc.addPage()
      first = false
      doc.setFontSize(11)
      doc.text('JUEGOS DEPORTIVOS ESTUDIANTILES — PLANILLA DE REGISTRO', 14, 15)
      doc.setFontSize(13)
      doc.text(`${discipline.toUpperCase()} ${gender === 'MASCULINO' ? 'VARONES' : 'DAMAS'}`, 14, 23)
      doc.setFontSize(9)
      doc.text(`Unidad Educativa: ${schoolLabel}`, 14, 30)

      autoTable(doc, {
        startY: 35,
        head: [['N°', 'Nombres', 'Ap. Paterno', 'Ap. Materno', 'F. Nacimiento', 'N° C.I.', 'RUDE', 'U. Educativa', 'Rol/Función', 'N° Contacto']],
        body: group.map((p, i) => {
          const { paterno, materno } = splitApellidos(p.student.lastName)
          return [
            i + 1, p.student.firstName, paterno, materno, formatDate(p.student.birthDate),
            p.student.ci || '—', p.student.rude || '—', schoolLabel,
            p.rolFuncion ? ROL_LABELS[p.rolFuncion] : '—', p.contactPhone || '—',
          ]
        }),
        styles: { fontSize: 7 },
      })
    }
    doc.save('juegos-estudiantiles-sub14.pdf')
  }

  // Sub-19: una matriz combinada por género — filas = estudiantes, columnas
  // = TODO el catálogo (igual que la planilla real), X donde el estudiante
  // está anotado en esa disciplina.
  const exportSub19 = async () => {
    const rows = participants.filter(p => p.categoria === 'SUB19')
    if (rows.length === 0) { toast('No hay deportistas Sub-19 registrados', 'error'); return }
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF('l') // horizontal — muchas columnas

    const byGender = new Map<string, Participant[]>()
    for (const p of rows) {
      if (!byGender.has(p.student.gender)) byGender.set(p.student.gender, [])
      byGender.get(p.student.gender)!.push(p)
    }

    const columns = [...GRUPALES, ...INDIVIDUALES]
    let first = true
    for (const [gender, group] of [...byGender.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (!first) doc.addPage()
      first = false
      doc.setFontSize(11)
      doc.text('JUEGOS ESTUDIANTILES MUNICIPALES DEPORTIVOS — SUB 19', 14, 15)
      doc.setFontSize(9)
      doc.text(`Unidad Educativa: ${schoolLabel}  ·  Categoría: ${gender === 'MASCULINO' ? 'Varones' : 'Damas'}`, 14, 22)

      const byStudent = new Map<number, { student: Participant['student']; disciplines: Set<string> }>()
      for (const p of group) {
        if (!byStudent.has(p.student.id)) byStudent.set(p.student.id, { student: p.student, disciplines: new Set() })
        byStudent.get(p.student.id)!.disciplines.add(p.discipline)
      }
      const students = [...byStudent.values()].sort((a, b) => a.student.fullName.localeCompare(b.student.fullName))

      autoTable(doc, {
        startY: 27,
        head: [
          [
            { content: 'N°', rowSpan: 2 }, { content: 'RUDE', rowSpan: 2 }, { content: 'Nombre Completo', rowSpan: 2 }, { content: 'F. Nacimiento', rowSpan: 2 },
            { content: 'Disc. de Conjunto', colSpan: GRUPALES.length, styles: { halign: 'center' } },
            { content: 'Disc. Individuales', colSpan: INDIVIDUALES.length, styles: { halign: 'center' } },
          ],
          [...columns.map(c => ({ content: c, styles: { fontSize: 6 } }))],
        ],
        body: students.map((s, i) => [
          i + 1, s.student.rude || '—', s.student.fullName, formatDate(s.student.birthDate),
          ...columns.map(c => s.disciplines.has(c) ? 'X' : ''),
        ]),
        styles: { fontSize: 6.5, halign: 'center' },
        columnStyles: { 2: { halign: 'left' } },
      })
    }
    doc.save('juegos-estudiantiles-sub19.pdf')
  }

  const columns: Column<Participant>[] = [
    { key: 'discipline', header: 'Disciplina', render: p => <span className="font-semibold text-brand-700">{p.discipline}</span> },
    { key: 'categoria', header: 'Categoría', render: p => <Badge tone="brand">{CATEGORIA_LABELS[p.categoria]}</Badge> },
    { key: 'modality', header: 'Modalidad', render: p => p.modality || '—' },
    { key: 'student', header: 'Estudiante', render: p => p.student.fullName },
    { key: 'gender', header: 'Género', render: p => <Badge tone={p.student.gender === 'MASCULINO' ? 'info' : 'danger'}>{p.student.gender === 'MASCULINO' ? '♂ M' : '♀ F'}</Badge> },
    { key: 'rol', header: 'Rol/Función', render: p => p.rolFuncion ? ROL_LABELS[p.rolFuncion] : '—' },
    { key: 'rude', header: 'RUDE', render: p => p.student.rude || '—' },
    { key: 'ci', header: 'CI', render: p => p.student.ci || '—' },
    { key: 'birthDate', header: 'F. Nacimiento', render: p => formatDate(p.student.birthDate) },
    { key: 'course', header: 'Curso', render: p => courseLabel(p.student.course) },
    {
      key: 'actions', header: '', className: 'text-right',
      render: p => (
        <Button variant="ghost" size="sm" onClick={() => handleDelete(p)} aria-label="Quitar">
          <Trash2 size={14} className="text-danger-600" />
        </Button>
      ),
    },
  ]

  const disciplineToUse = disciplineChoice === OTRO ? customDiscipline : disciplineChoice
  const categoriaOptions = [{ value: 'SUB14', label: 'Sub-14' }, { value: 'SUB19', label: 'Sub-19' }]

  return (
    <div>
      <PageHeader
        icon={Trophy}
        title="Juegos Estudiantiles Municipales"
        description="Estudiantes que representan al colegio, por disciplina y categoría — un mismo estudiante puede estar en varias"
        action={<Button onClick={() => setShowAdd(true)}><Plus size={15} /> Agregar deportistas</Button>}
      />

      <Card className="mb-4">
        <Toolbar
          search={{ value: search, onChange: setSearch, placeholder: 'Buscar por nombre, CI o RUDE' }}
          filters={[
            { key: 'discipline', label: 'Disciplina', value: disciplineFilter, onChange: setDisciplineFilter, options: disciplineOptions, placeholder: 'Todas las disciplinas' },
            { key: 'categoria', label: 'Categoría', value: categoriaFilter, onChange: setCategoriaFilter, options: categoriaOptions, placeholder: 'Todas las categorías' },
          ]}
          actions={[
            { key: 'export14', label: 'Exportar Sub-14', icon: Download, onClick: exportSub14, variant: 'secondary' },
            { key: 'export19', label: 'Exportar Sub-19', icon: Download, onClick: exportSub19, variant: 'secondary' },
          ]}
        />
      </Card>

      <Card>
        {loading ? <LoadingState /> : (
          <Table columns={columns} rows={filtered} rowKey={p => p.id} emptyLabel="Todavía no hay deportistas registrados" />
        )}
      </Card>

      <Modal
        open={showAdd}
        onClose={closeAddModal}
        title={submitResult ? '✅ Deportistas agregados' : 'Agregar deportistas'}
        maxWidth={560}
        footer={
          submitResult ? (
            <Button onClick={closeAddModal}>Listo</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeAddModal}>Cancelar</Button>
              <Button onClick={handleSubmit} loading={saving}>Agregar {selectedStudents.length > 0 ? `(${selectedStudents.length})` : ''}</Button>
            </>
          )
        }
      >
        {submitResult ? (
          <div className="flex flex-col gap-2.5">
            <p className={`text-[13px] rounded-lg px-3.5 py-3 flex items-start gap-2 ${submitResult.skipped > 0 ? 'bg-warning-100 text-[#8A6116]' : 'bg-success-100 text-success-700'}`}>
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{submitResult.message}</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Categoría" required value={categoria} onChange={e => setCategoria(e.target.value as 'SUB14' | 'SUB19')}>
                {categoriaOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
              <Select label="Disciplina" value={disciplineChoice} onChange={e => setDisciplineChoice(e.target.value)}>
                <optgroup label="Grupales">{GRUPALES.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>
                <optgroup label="Individuales / Pruebas">{INDIVIDUALES.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>
                <option value={OTRO}>{OTRO}</option>
              </Select>
            </div>
            {modality && (
              <p className="text-[12px] text-neutral-500 -mt-1.5">Modalidad: <span className="font-semibold text-brand-700">{modality === 'GRUPAL' ? 'Grupal' : 'Individual'}</span> (según la disciplina elegida)</p>
            )}

            {disciplineChoice === OTRO && (
              <Input value={customDiscipline} onChange={e => setCustomDiscipline(e.target.value)} placeholder="Nombre de la disciplina" />
            )}

            {categoria === 'SUB14' && (
              <div className="grid grid-cols-2 gap-3">
                <Select label="Rol / Función (opcional)" value={rolFuncion} onChange={e => setRolFuncion(e.target.value)}>
                  <option value="">Sin especificar</option>
                  {Object.entries(ROL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                <Input label="N° de Contacto (opcional)" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Celular" />
              </div>
            )}

            <div>
              <div className="text-[13px] font-semibold text-brand-700 mb-1.5">
                Estudiante(s) {disciplineToUse && <span className="font-normal text-neutral-500">— para {disciplineToUse}</span>}
              </div>
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <Input
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchStudents() } }}
                    placeholder="Buscar estudiante por nombre, CI o RUDE"
                  />
                </div>
                <Button variant="secondary" onClick={handleSearchStudents} loading={searchingStudents}><Search size={14} /></Button>
              </div>
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                {studentResults.map(s => {
                  const checked = selectedStudents.some(x => x.id === s.id)
                  const warning = ageWarning(s.birthDate, categoria)
                  return (
                    <label key={s.id} className={`flex flex-col gap-0.5 px-3 py-2 rounded-lg cursor-pointer text-[13px] ${checked ? 'bg-success-100' : 'bg-neutral-100/60 hover:bg-neutral-100'}`}>
                      <span className="flex items-center gap-2.5">
                        <input type="checkbox" checked={checked} onChange={() => toggleStudent(s)} className="accent-brand-700" />
                        <span className="font-medium text-brand-700">{s.lastName} {s.firstName}</span>
                        {s.ci && <span className="text-neutral-500">· CI {s.ci}</span>}
                      </span>
                      {warning && (
                        <span className="flex items-center gap-1 text-[11px] text-warning-600 pl-6">
                          <AlertTriangle size={11} /> {warning} — se puede confirmar igual
                        </span>
                      )}
                    </label>
                  )
                })}
                {studentResults.length === 0 && (
                  <p className="text-[12px] text-neutral-500 italic">Buscá un estudiante para agregarlo</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
