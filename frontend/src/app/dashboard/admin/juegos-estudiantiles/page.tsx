'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trophy, Plus, Search, Download, Trash2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Toolbar from '@/components/ui/Toolbar'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input, { Select } from '@/components/ui/Input'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useDistrictConfig } from '@/hooks/useDistrictConfig'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }

const DISCIPLINES = ['Fútbol', 'Atletismo', 'Básquet', 'Vóley', 'Ajedrez', 'Tenis de Mesa', 'Judo / Defensa Personal', 'Natación']
const OTRO = 'Otro (especificar)'

// Disciplina → modalidad sugerida por defecto (editable) — no es una regla
// rígida (el atletismo también tiene postas grupales), solo ahorra el clic
// en el caso típico.
const DEFAULT_MODALITY: Record<string, 'INDIVIDUAL' | 'GRUPAL'> = {
  'Fútbol': 'GRUPAL', 'Vóley': 'GRUPAL', 'Básquet': 'GRUPAL',
  'Atletismo': 'INDIVIDUAL', 'Ajedrez': 'INDIVIDUAL', 'Tenis de Mesa': 'INDIVIDUAL',
  'Judo / Defensa Personal': 'INDIVIDUAL', 'Natación': 'INDIVIDUAL',
}

interface StudentHit { id: number; firstName: string; lastName: string; ci?: string | null; rude?: string | null }

interface Participant {
  id: number
  discipline: string
  modality: string | null
  student: {
    id: number
    fullName: string
    ci: string | null
    rude: string | null
    birthDate: string | null
    course: { grade: string; parallel: string } | null
  }
}

const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const courseLabel = (c: Participant['student']['course']) => c ? `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}"` : '—'

export default function JuegosEstudiantilesPage() {
  const toast   = useToast()
  const confirm = useConfirm()
  const district = useDistrictConfig()

  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [disciplineFilter, setDisciplineFilter] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [disciplineChoice, setDisciplineChoice] = useState(DISCIPLINES[0])
  const [customDiscipline, setCustomDiscipline] = useState('')
  const [modality, setModality] = useState<'INDIVIDUAL' | 'GRUPAL' | ''>(DEFAULT_MODALITY[DISCIPLINES[0]] || '')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<StudentHit[]>([])
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<StudentHit[]>([])
  const [saving, setSaving] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

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
      if (words.length === 0) return true
      const haystack = `${p.student.fullName} ${p.student.ci || ''} ${p.student.rude || ''}`.toLowerCase()
      return words.every(w => haystack.includes(w))
    })
  }, [participants, search, disciplineFilter])

  const handleDisciplineChoice = (value: string) => {
    setDisciplineChoice(value)
    if (value !== OTRO) setModality(DEFAULT_MODALITY[value] || '')
  }

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
    setModality(DEFAULT_MODALITY[DISCIPLINES[0]] || '')
    setStudentSearch('')
    setStudentResults([])
    setSelectedStudents([])
  }

  const handleSubmit = async () => {
    const discipline = disciplineChoice === OTRO ? customDiscipline.trim() : disciplineChoice
    if (!discipline) { toast('Indicá la disciplina', 'error'); return }
    if (selectedStudents.length === 0) { toast('Seleccioná al menos un estudiante', 'error'); return }

    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/sports-participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentIds: selectedStudents.map(s => s.id), discipline, modality: modality || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al guardar', 'error'); return }
      toast(data.message, 'success')
      setShowAdd(false)
      resetAddForm()
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

  // Exporta SIEMPRE la lista completa (no la filtrada en pantalla) — es el
  // listado oficial para presentar en los Juegos, no debe salir recortado
  // por lo que alguien esté buscando/filtrando en ese momento.
  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`${district.name || 'U.E. Naciones Unidas'}${district.location ? ` — ${district.location}` : ''}`, 14, 15)
    doc.setFontSize(12)
    doc.text('Juegos Estudiantiles Municipales — Lista de Deportistas', 14, 25)

    const sorted = [...participants].sort((a, b) =>
      a.discipline.localeCompare(b.discipline) || a.student.fullName.localeCompare(b.student.fullName))

    autoTable(doc, {
      startY: 33,
      head: [['#', 'Disciplina', 'Modalidad', 'Estudiante', 'RUDE', 'CI', 'F. Nacimiento', 'Curso']],
      body: sorted.map((p, i) => [
        i + 1, p.discipline, p.modality || '—', p.student.fullName,
        p.student.rude || '—', p.student.ci || '—', formatDate(p.student.birthDate), courseLabel(p.student.course),
      ]),
      styles: { fontSize: 8 },
    })
    doc.save('juegos-estudiantiles.pdf')
  }

  const columns: Column<Participant>[] = [
    { key: 'discipline', header: 'Disciplina', render: p => <span className="font-semibold text-brand-700">{p.discipline}</span> },
    { key: 'modality', header: 'Modalidad', render: p => p.modality || '—' },
    { key: 'student', header: 'Estudiante', render: p => p.student.fullName },
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

  return (
    <div>
      <PageHeader
        icon={Trophy}
        title="Juegos Estudiantiles Municipales"
        description="Estudiantes que representan al colegio, por disciplina — un mismo estudiante puede estar en varias"
        action={<Button onClick={() => setShowAdd(true)}><Plus size={15} /> Agregar deportistas</Button>}
      />

      <Card className="mb-4">
        <Toolbar
          search={{ value: search, onChange: setSearch, placeholder: 'Buscar por nombre, CI o RUDE' }}
          filters={[{ key: 'discipline', label: 'Disciplina', value: disciplineFilter, onChange: setDisciplineFilter, options: disciplineOptions, placeholder: 'Todas las disciplinas' }]}
          actions={[{ key: 'export', label: 'Exportar PDF', icon: Download, onClick: exportPDF, variant: 'secondary' }]}
        />
      </Card>

      <Card>
        {loading ? <LoadingState /> : (
          <Table columns={columns} rows={filtered} rowKey={p => p.id} emptyLabel="Todavía no hay deportistas registrados" />
        )}
      </Card>

      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); resetAddForm() }}
        title="Agregar deportistas"
        maxWidth={520}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowAdd(false); resetAddForm() }}>Cancelar</Button>
            <Button onClick={handleSubmit} loading={saving}>Agregar {selectedStudents.length > 0 ? `(${selectedStudents.length})` : ''}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Disciplina" value={disciplineChoice} onChange={e => handleDisciplineChoice(e.target.value)}>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
              <option value={OTRO}>{OTRO}</option>
            </Select>
            <Select label="Modalidad" value={modality} onChange={e => setModality(e.target.value as 'INDIVIDUAL' | 'GRUPAL' | '')}>
              <option value="">Sin especificar</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="GRUPAL">Grupal</option>
            </Select>
          </div>

          {disciplineChoice === OTRO && (
            <Input value={customDiscipline} onChange={e => setCustomDiscipline(e.target.value)} placeholder="Nombre de la disciplina" />
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
                return (
                  <label key={s.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-[13px] ${checked ? 'bg-success-100' : 'bg-neutral-100/60 hover:bg-neutral-100'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleStudent(s)} className="accent-brand-700" />
                    <span className="font-medium text-brand-700">{s.lastName} {s.firstName}</span>
                    {s.ci && <span className="text-neutral-500">· CI {s.ci}</span>}
                  </label>
                )
              })}
              {studentResults.length === 0 && (
                <p className="text-[12px] text-neutral-500 italic">Buscá un estudiante para agregarlo</p>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
