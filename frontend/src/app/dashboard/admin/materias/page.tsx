'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, BookOpen, Search, Settings, Check, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Table, { Column } from '@/components/ui/Table'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface GradeConfig {
  id:            number
  grade:         string
  hoursPerWeek:  number
  educationType: string
}

interface Subject {
  id:           number
  name:         string
  code?:        string
  level:        string
  campo?:       string
  hoursPerWeek: number
  isActive:     boolean
  gradeConfigs?: GradeConfig[]
  _count:       { teacherSubjects: number }
}

const LEVELS = [
  { value: 'INICIAL',    label: 'Inicial'    },
  { value: 'PRIMARIA',   label: 'Primaria'   },
  { value: 'SECUNDARIA', label: 'Secundaria' },
]

const GRADES: Record<string,string> = {
  PRIMERO:'1°', SEGUNDO:'2°', TERCERO:'3°',
  CUARTO:'4°',  QUINTO:'5°',  SEXTO:'6°',
}

const GRADE_ORDER: Record<string,number> = {
  PRIMERO:1, SEGUNDO:2, TERCERO:3, CUARTO:4, QUINTO:5, SEXTO:6
}

const CAMPO_LABELS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        'Vida, Tierra y Territorio',
  COMUNIDAD_SOCIEDAD:            'Comunidad y Sociedad',
  COSMOS_PENSAMIENTO:            'Cosmos y Pensamiento',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'Ciencia, Tecnología y Producción',
  SIN_CAMPO:                     'Sin campo asignado',
}

const CAMPO_TONE: Record<string, 'success' | 'info' | 'warning' | 'brand' | 'neutral'> = {
  VIDA_TIERRA_TERRITORIO:        'success',
  COMUNIDAD_SOCIEDAD:            'info',
  COSMOS_PENSAMIENTO:            'warning',
  CIENCIA_TECNOLOGIA_PRODUCCION: 'brand',
  SIN_CAMPO:                     'neutral',
}

const CAMPO_ICONS: Record<string,string> = {
  VIDA_TIERRA_TERRITORIO:        '🌿',
  COMUNIDAD_SOCIEDAD:            '🌐',
  COSMOS_PENSAMIENTO:            '✨',
  CIENCIA_TECNOLOGIA_PRODUCCION: '⚙️',
  SIN_CAMPO:                     '📋',
}

const CAMPO_ORDER = [
  'VIDA_TIERRA_TERRITORIO',
  'COMUNIDAD_SOCIEDAD',
  'COSMOS_PENSAMIENTO',
  'CIENCIA_TECNOLOGIA_PRODUCCION',
  'SIN_CAMPO',
]

const emptyForm = { name: '', code: '', level: 'SECUNDARIA', hoursPerWeek: '4', campo: '' }

export default function MateriasPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [subjects,    setSubjects]    = useState<Subject[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showModal,   setShowModal]   = useState(false)
  const [editMode,    setEditMode]    = useState(false)
  const [editId,      setEditId]      = useState<number | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [formError,   setFormError]   = useState('')
  const [search,      setSearch]      = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterCampo, setFilterCampo] = useState('')
  const [form,        setForm]        = useState(emptyForm)

  // Grade config modal
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [gradeSubject,   setGradeSubject]   = useState<Subject | null>(null)
  const [gradeConfigs,   setGradeConfigs]   = useState<GradeConfig[]>([])
  const [loadingGrades,  setLoadingGrades]  = useState(false)
  const [editingGrade,   setEditingGrade]   = useState<{id:number; hours:string} | null>(null)
  const [savingGrade,    setSavingGrade]    = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchSubjects = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/subjects`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setSubjects(data)
      else toast('Error al cargar materias', 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchSubjects() }, [])

  const openCreate = () => {
    setEditMode(false); setEditId(null)
    setForm(emptyForm); setFormError('')
    setShowModal(true)
  }

  const openEdit = (s: Subject) => {
    setEditMode(true); setEditId(s.id)
    setForm({
      name:         s.name,
      code:         s.code || '',
      level:        s.level,
      campo:        s.campo || '',
      hoursPerWeek: String(s.hoursPerWeek),
    })
    setFormError('')
    setShowModal(true)
  }

  const openGradeConfig = async (s: Subject) => {
    setGradeSubject(s)
    setShowGradeModal(true)
    setLoadingGrades(true)
    setEditingGrade(null)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/${s.id}/grade-configs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        const sorted = [...data].sort((a: GradeConfig, b: GradeConfig) => {
          const typeDiff = a.educationType.localeCompare(b.educationType)
          if (typeDiff !== 0) return typeDiff
          return (GRADE_ORDER[a.grade] || 99) - (GRADE_ORDER[b.grade] || 99)
        })
        setGradeConfigs(sorted)
      }
    } catch { toast('Error al cargar configuración', 'error') }
    finally { setLoadingGrades(false) }
  }

  const handleSaveGrade = async (configId: number, hours: string) => {
    if (!hours || parseInt(hours) < 1) { toast('Las horas deben ser mayor a 0', 'error'); return }
    setSavingGrade(true)
    try {
      const res  = await fetch(`${API_URL}/api/subjects/grade-config/${configId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ hoursPerWeek: parseInt(hours) })
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast('Horas actualizadas correctamente', 'success')
      setGradeConfigs(prev => prev.map(gc =>
        gc.id === configId ? { ...gc, hoursPerWeek: parseInt(hours) } : gc
      ))
      setEditingGrade(null)
    } catch { toast('Error de conexión', 'error') }
    finally { setSavingGrade(false) }
  }

  const handleSave = async () => {
    if (!form.name || !form.level) { setFormError('Nombre y nivel son requeridos'); return }
    setSaving(true); setFormError('')
    try {
      const url    = editMode ? `${API_URL}/api/subjects/${editId}` : `${API_URL}/api/subjects`
      const method = editMode ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name:         form.name,
          code:         form.code || undefined,
          level:        form.level,
          campo:        form.campo || undefined,
          hoursPerWeek: parseInt(form.hoursPerWeek),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message); return }
      toast(editMode ? 'Materia actualizada' : 'Materia creada', 'success')
      setShowModal(false)
      fetchSubjects()
    } catch { setFormError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm(`¿Eliminar la materia "${name}"?`, { danger: true, confirmLabel: 'Eliminar' })
    if (!ok) return
    try {
      const res  = await fetch(`${API_URL}/api/subjects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchSubjects() }
      else toast(data.message, 'error')
    } catch { toast('Error al eliminar', 'error') }
  }

  const filtered = subjects.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase()))
    const matchLevel = !filterLevel || s.level === filterLevel
    const matchCampo = !filterCampo || (s.campo || 'SIN_CAMPO') === filterCampo
    return matchSearch && matchLevel && matchCampo
  })

  const grouped = filtered.reduce((acc, s) => {
    const campo = s.campo || 'SIN_CAMPO'
    if (!acc[campo]) acc[campo] = []
    acc[campo].push(s)
    return acc
  }, {} as Record<string, Subject[]>)

  const sortedCampos = CAMPO_ORDER.filter(c => grouped[c])

  const configsByType = gradeConfigs.reduce((acc, gc) => {
    if (!acc[gc.educationType]) acc[gc.educationType] = []
    acc[gc.educationType].push(gc)
    return acc
  }, {} as Record<string, GradeConfig[]>)

  const columns: Column<Subject>[] = [
    { key: 'idx', header: '#', render: (s) => <span className="text-neutral-500">{filtered.indexOf(s) + 1}</span> },
    { key: 'name', header: 'Materia', render: (s) => <span className="font-medium text-brand-700">{s.name}</span> },
    { key: 'level', header: 'Nivel', render: (s) => <Badge tone="brand">{LEVELS.find(l => l.value === s.level)?.label || s.level}</Badge> },
    { key: 'code', header: 'Código', render: (s) => <span className="text-neutral-500 text-xs">{s.code || '—'}</span> },
    { key: 'hours', header: 'Hrs/Plan', render: (s) => <span className="text-neutral-500 text-xs">{s.hoursPerWeek}h</span> },
    { key: 'courses', header: 'Cursos', render: (s) => <Badge tone={s._count.teacherSubjects > 0 ? 'info' : 'neutral'}>{s._count.teacherSubjects} curso{s._count.teacherSubjects !== 1 ? 's' : ''}</Badge> },
    {
      key: 'actions', header: 'Acciones', render: (s) => (
        <div className="flex gap-1.5">
          <button title="Editar materia" onClick={() => openEdit(s)} className="w-7 h-7 rounded-md bg-accent-500/15 text-accent-600 flex items-center justify-center hover:opacity-75">
            <Edit size={13} />
          </button>
          <button title="Horas por grado" onClick={() => openGradeConfig(s)} className="w-7 h-7 rounded-md bg-info-500/15 text-info-500 flex items-center justify-center hover:opacity-75">
            <Settings size={13} />
          </button>
          <button title="Eliminar" onClick={() => handleDelete(s.id, s.name)} className="w-7 h-7 rounded-md bg-danger-100 text-danger-600 flex items-center justify-center hover:opacity-75">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Gestión de Materias</h1>
          <p className="text-[13px] text-neutral-500">Materias agrupadas por Campo del Saber y Conocimiento</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nueva materia</Button>
      </div>

      <div className="flex gap-2.5 mb-5 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info-500 pointer-events-none" />
          <input
            placeholder="Buscar materia..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
          />
        </div>
        <Select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="w-auto min-w-[150px]">
          <option value="">Todos los niveles</option>
          {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </Select>
        <Select value={filterCampo} onChange={e => setFilterCampo(e.target.value)} className="w-auto min-w-[200px]">
          <option value="">Todos los campos</option>
          {CAMPO_ORDER.map(c => <option key={c} value={c}>{CAMPO_ICONS[c]} {CAMPO_LABELS[c]}</option>)}
        </Select>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="grid gap-2.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {sortedCampos.map(campo => (
            <button
              key={campo}
              onClick={() => setFilterCampo(filterCampo === campo ? '' : campo)}
              className={`text-left rounded-[10px] px-3.5 py-2.5 border-l-4 transition-shadow ${
                CAMPO_TONE[campo] === 'success' ? 'bg-success-100 border-l-success-500' :
                CAMPO_TONE[campo] === 'info' ? 'bg-info-500/10 border-l-info-500' :
                CAMPO_TONE[campo] === 'warning' ? 'bg-warning-100 border-l-accent-600' :
                CAMPO_TONE[campo] === 'brand' ? 'bg-brand-100 border-l-brand-700' : 'bg-neutral-100 border-l-neutral-500'
              } ${filterCampo === campo ? 'ring-2 ring-brand-700' : ''}`}
            >
              <div className="text-xl mb-1">{CAMPO_ICONS[campo]}</div>
              <div className="text-xs font-bold text-brand-700 leading-tight mb-1">{CAMPO_LABELS[campo]}</div>
              <div className="text-lg font-extrabold text-brand-700">
                {grouped[campo]?.length || 0}<span className="text-[11px] font-normal ml-1">materias</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-neutral-500 text-sm">
          <BookOpen size={40} className="text-neutral-300" />
          <p>No se encontraron materias</p>
          <Button onClick={openCreate}><Plus size={14} /> Crear primera materia</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {sortedCampos.map(campo => (
            <Card key={campo} padded={false} className="overflow-hidden">
              <div className={`flex items-center gap-2.5 px-4.5 py-3.5 border-b border-neutral-100 ${
                CAMPO_TONE[campo] === 'success' ? 'bg-success-100' :
                CAMPO_TONE[campo] === 'info' ? 'bg-info-500/10' :
                CAMPO_TONE[campo] === 'warning' ? 'bg-warning-100' :
                CAMPO_TONE[campo] === 'brand' ? 'bg-brand-100' : 'bg-neutral-100'
              }`}>
                <span className="text-2xl">{CAMPO_ICONS[campo]}</span>
                <div>
                  <div className="text-[15px] font-bold text-brand-700">{CAMPO_LABELS[campo]}</div>
                  <div className="text-[11px] text-neutral-500">{grouped[campo]?.length || 0} materia{(grouped[campo]?.length || 0) !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <Table columns={columns} rows={grouped[campo] || []} rowKey={(s) => s.id} />
            </Card>
          ))}
        </div>
      )}

      {/* ── Modal crear/editar materia ── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editMode ? 'Editar Materia' : 'Nueva Materia'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>{editMode ? 'Actualizar' : 'Crear materia'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{formError}</p>}
          <Input label="Nombre" required placeholder="Ej: Matemáticas, Lenguaje, Ciencias..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Código" placeholder="Ej: MAT, LEN..." value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
            <Input label="Horas Plan" type="number" min={1} max={20} value={form.hoursPerWeek} onChange={e => setForm({ ...form, hoursPerWeek: e.target.value })} />
          </div>
          <Select label="Nivel" required value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>
            {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select>
          <Select label="Campo del Saber" value={form.campo} onChange={e => setForm({ ...form, campo: e.target.value })}>
            <option value="">— Sin campo —</option>
            <option value="VIDA_TIERRA_TERRITORIO">🌿 Vida, Tierra y Territorio</option>
            <option value="COMUNIDAD_SOCIEDAD">🌐 Comunidad y Sociedad</option>
            <option value="COSMOS_PENSAMIENTO">✨ Cosmos y Pensamiento</option>
            <option value="CIENCIA_TECNOLOGIA_PRODUCCION">⚙️ Ciencia, Tecnología y Producción</option>
          </Select>
        </div>
      </Modal>

      {/* ── Modal configuración horas por grado ── */}
      <Modal
        open={showGradeModal && !!gradeSubject}
        onClose={() => { setShowGradeModal(false); setEditingGrade(null) }}
        title="Horas por Grado"
        maxWidth={600}
        footer={<Button onClick={() => { setShowGradeModal(false); setEditingGrade(null) }}>Cerrar</Button>}
      >
        {gradeSubject && (
          <div className="flex flex-col gap-3.5">
            <p className="text-xs text-neutral-500 -mt-2">{gradeSubject.name}</p>
            {loadingGrades ? (
              <p className="text-center text-sm text-neutral-500 py-8">Cargando...</p>
            ) : gradeConfigs.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <Settings size={32} className="opacity-30 mx-auto mb-2" />
                <p className="text-sm">No hay configuración de grados para esta materia.</p>
                <p className="text-xs mt-1">Configura el plan de estudios primero.</p>
              </div>
            ) : (
              Object.entries(configsByType).map(([type, configs]) => (
                <div key={type}>
                  <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wide mb-2 px-3 py-1.5 bg-neutral-100 rounded-lg w-fit">
                    {type === 'REGULAR' ? '📚 Regular' : '🔧 BTH'}
                  </div>
                  <div className="border border-neutral-300 rounded-[10px] overflow-hidden mb-3.5">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-neutral-100">
                          <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Grado</th>
                          <th className="px-3.5 py-2.5 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Hrs/semana</th>
                          <th className="px-3.5 py-2.5 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Periodos máx</th>
                          <th className="px-3.5 py-2.5 text-center text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {configs.map(gc => {
                          const isEditing = editingGrade?.id === gc.id
                          return (
                            <tr key={gc.id} className={`border-t border-neutral-100 ${isEditing ? 'bg-neutral-100/60' : ''}`}>
                              <td className="px-3.5 py-2.5"><span className="font-semibold text-brand-700">{GRADES[gc.grade] || gc.grade} {gc.grade}</span></td>
                              <td className="px-3.5 py-2.5 text-center">
                                {isEditing ? (
                                  <input
                                    type="number" min={1} max={20}
                                    value={editingGrade.hours}
                                    onChange={e => setEditingGrade({ ...editingGrade, hours: e.target.value })}
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSaveGrade(gc.id, editingGrade.hours)
                                      if (e.key === 'Escape') setEditingGrade(null)
                                    }}
                                    className="w-[70px] px-2 py-1.5 border border-brand-600 rounded-md text-sm font-bold text-center text-brand-700 outline-none"
                                  />
                                ) : (
                                  <Badge tone="info">{gc.hoursPerWeek} hrs</Badge>
                                )}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                <Badge tone="warning">{isEditing ? parseInt(editingGrade.hours) || 0 : gc.hoursPerWeek} per.</Badge>
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                {isEditing ? (
                                  <div className="flex gap-1.5 justify-center">
                                    <Button size="sm" loading={savingGrade} onClick={() => handleSaveGrade(gc.id, editingGrade.hours)}>
                                      <Check size={12} /> Guardar
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => setEditingGrade(null)}><X size={12} /></Button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setEditingGrade({ id: gc.id, hours: String(gc.hoursPerWeek) })}
                                    className="inline-flex items-center gap-1 bg-accent-500/15 text-accent-600 rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-75"
                                  >
                                    <Edit size={12} /> Editar
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
            <p className="bg-neutral-100 rounded-lg px-3.5 py-2.5 text-xs text-neutral-500">
              💡 Las hrs/semana determinan los periodos máximos asignables en el horario para cada grado. Presiona Enter para guardar rápidamente.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
