'use client'

import { useEffect, useState } from 'react'
import { Plus, Calendar, BookOpen, CheckCircle, XCircle, ChevronDown, ChevronUp, Trash2, Lock, Unlock } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface AcademicYear {
  id:        number
  year:      number
  startDate: string
  endDate:   string
  isActive:  boolean
  _count:    { trimesters: number; assignments: number; holidays: number }
}

interface Trimester {
  id:        number
  number:    number
  name:      string
  startDate: string
  endDate:   string
  isClosed:  boolean
}

interface Holiday {
  id:          number
  date:        string
  description: string
}

export default function GestionPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [years,       setYears]       = useState<AcademicYear[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState<number | null>(null)
  const [trimesters,  setTrimesters]  = useState<Record<number, Trimester[]>>({})
  const [holidays,    setHolidays]    = useState<Record<number, Holiday[]>>({})
  const [showYearModal, setShowYearModal] = useState(false)
  const [showTrimModal, setShowTrimModal] = useState(false)
  const [showHolModal,  setShowHolModal]  = useState(false)
  const [selectedYear,  setSelectedYear]  = useState<number | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [yearError,     setYearError]     = useState('')
  const [trimError,     setTrimError]     = useState('')
  const [holError,      setHolError]      = useState('')
  const [yearForm, setYearForm] = useState({ year: new Date().getFullYear().toString(), startDate: '', endDate: '' })
  const [trimForm, setTrimForm] = useState({ number: '1', name: '', startDate: '', endDate: '' })
  const [holForm,  setHolForm]  = useState({ date: '', description: '' })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchYears = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/academic`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setYears(data)
    } catch { toast('Error al cargar gestiones', 'error') }
    finally  { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchYears() }, [])

  const fetchTrimesters = async (yearId: number) => {
    const tRes  = await fetch(`${API_URL}/api/academic/${yearId}/trimesters`, { headers: { Authorization: `Bearer ${token}` } })
    const tData = await tRes.json()
    if (tRes.ok) setTrimesters(p => ({ ...p, [yearId]: tData }))
  }

  const handleExpand = async (yearId: number) => {
    if (expanded === yearId) { setExpanded(null); return }
    setExpanded(yearId)
    if (!trimesters[yearId]) {
      const [tRes, hRes] = await Promise.all([
        fetch(`${API_URL}/api/academic/${yearId}/trimesters`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/academic/${yearId}/holidays`,   { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [tData, hData] = await Promise.all([tRes.json(), hRes.json()])
      if (tRes.ok) setTrimesters(p => ({ ...p, [yearId]: tData }))
      if (hRes.ok) setHolidays(p  => ({ ...p, [yearId]: hData }))
    }
  }

  const handleCreateYear = async () => {
    setYearError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/academic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(yearForm),
      })
      const data = await res.json()
      if (!res.ok) { setYearError(data.message); return }
      toast('Gestión creada correctamente', 'success')
      setShowYearModal(false)
      setYearForm({ year: (new Date().getFullYear() + 1).toString(), startDate: '', endDate: '' })
      fetchYears()
    } catch { setYearError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleToggleYear = async (id: number) => {
    try {
      const res  = await fetch(`${API_URL}/api/academic/${id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) { toast(data.message, 'success'); fetchYears() }
    } catch { toast('Error al cambiar estado', 'error') }
  }

  const handleToggleCloseTrimester = async (yearId: number, trimId: number) => {
    const trim = trimesters[yearId]?.find(t => t.id === trimId)
    const accion = trim?.isClosed ? 'reabrir' : 'cerrar'
    const ok = await confirm(
      `¿Deseas ${accion} este trimestre? ${!trim?.isClosed ? 'Una vez cerrado, los maestros no podrán modificar notas.' : ''}`,
      { danger: !trim?.isClosed, confirmLabel: trim?.isClosed ? 'Reabrir' : 'Cerrar' }
    )
    if (!ok) return
    try {
      const res  = await fetch(`${API_URL}/api/academic/${yearId}/trimesters/${trimId}/toggle-close`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      fetchTrimesters(yearId)
    } catch { toast('Error al cerrar trimestre', 'error') }
  }

  const handleCreateTrim = async () => {
    if (!selectedYear) return
    setTrimError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/academic/${selectedYear}/trimesters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(trimForm),
      })
      const data = await res.json()
      if (!res.ok) { setTrimError(data.message); return }
      toast('Trimestre creado', 'success')
      setShowTrimModal(false)
      setTrimForm({ number: '1', name: '', startDate: '', endDate: '' })
      fetchTrimesters(selectedYear)
    } catch { setTrimError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleCreateHol = async () => {
    if (!selectedYear) return
    setHolError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/academic/${selectedYear}/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(holForm),
      })
      const data = await res.json()
      if (!res.ok) { setHolError(data.message); return }
      toast('Feriado registrado', 'success')
      setShowHolModal(false)
      setHolForm({ date: '', description: '' })
      const hRes  = await fetch(`${API_URL}/api/academic/${selectedYear}/holidays`, { headers: { Authorization: `Bearer ${token}` } })
      const hData = await hRes.json()
      if (hRes.ok) setHolidays(p => ({ ...p, [selectedYear]: hData }))
    } catch { setHolError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleDeleteHol = async (yearId: number, holId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/academic/${yearId}/holidays/${holId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        toast('Feriado eliminado', 'success')
        setHolidays(p => ({ ...p, [yearId]: p[yearId].filter(h => h.id !== holId) }))
      }
    } catch { toast('Error al eliminar', 'error') }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Gestión Académica</h1>
          <p className="text-[13px] text-neutral-500">Administra los años escolares, trimestres y días feriados</p>
        </div>
        <Button onClick={() => setShowYearModal(true)}><Plus size={16} /> Nueva gestión</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : years.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-neutral-500 text-sm">
          <Calendar size={40} className="text-neutral-300" />
          <p>No hay gestiones registradas</p>
          <Button onClick={() => setShowYearModal(true)}><Plus size={14} /> Crear primera gestión</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {years.map(y => (
            <Card key={y.id} padded={false} className={`overflow-hidden ${y.isActive ? 'ring-2 ring-info-500/40 !border-info-500' : ''}`}>
              <div className="flex items-center justify-between gap-4 px-5 py-4 flex-wrap">
                <div className="flex items-center gap-3.5">
                  <div className={`text-xl font-extrabold px-3.5 py-2 rounded-[10px] min-w-[80px] text-center ${y.isActive ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                    {y.year}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[13px] font-medium text-brand-700">{fmt(y.startDate)} — {fmt(y.endDate)}</div>
                    <div className="flex gap-3 text-xs text-neutral-500 flex-wrap">
                      <span>📚 {y._count.trimesters} trimestres</span>
                      <span>🎓 {y._count.assignments} inscripciones</span>
                      <span>📅 {y._count.holidays} feriados</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {y.isActive
                    ? <Badge tone="success"><CheckCircle size={12} /> Activa</Badge>
                    : <Badge tone="neutral"><XCircle size={12} /> Inactiva</Badge>}
                  <Button size="sm" variant={y.isActive ? 'danger' : 'primary'} onClick={() => handleToggleYear(y.id)}>
                    {y.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                  <button onClick={() => handleExpand(y.id)} className="w-8 h-8 rounded-lg bg-neutral-100 text-brand-700 flex items-center justify-center hover:bg-neutral-100/70">
                    {expanded === y.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {expanded === y.id && (
                <div className="border-t border-neutral-100 p-5 flex flex-col gap-5 bg-neutral-100/40">
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-[13px] font-semibold text-brand-700">
                      <span className="flex items-center gap-1.5"><BookOpen size={14} /> Trimestres</span>
                      <Button size="sm" onClick={() => { setSelectedYear(y.id); setTrimError(''); setShowTrimModal(true) }}><Plus size={12} /> Agregar</Button>
                    </div>
                    {!trimesters[y.id] || trimesters[y.id].length === 0 ? (
                      <p className="text-xs text-neutral-500 italic py-1">Sin trimestres registrados</p>
                    ) : (
                      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                        {trimesters[y.id].map(t => (
                          <div key={t.id} className={`bg-white border rounded-lg p-3 flex items-center gap-2.5 ${t.isClosed ? 'border-accent-500 bg-warning-100/40' : 'border-neutral-300'}`}>
                            <div className={`text-xl font-extrabold min-w-[32px] text-center ${t.isClosed ? 'text-accent-600' : 'text-info-500'}`}>{t.number}°</div>
                            <div className="flex-1">
                              <div className="text-[13px] font-medium text-brand-700">{t.name}</div>
                              <div className="text-[11px] text-neutral-500 mt-0.5">{fmt(t.startDate)} — {fmt(t.endDate)}</div>
                              <div className="mt-1">
                                {t.isClosed ? <Badge tone="warning"><Lock size={10} /> Cerrado</Badge> : <Badge tone="success"><CheckCircle size={10} /> Abierto</Badge>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleCloseTrimester(y.id, t.id)}
                              title={t.isClosed ? 'Reabrir trimestre' : 'Cerrar trimestre'}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap ${
                                t.isClosed ? 'bg-success-100 text-success-700 hover:bg-success-700 hover:text-white' : 'bg-warning-100 text-accent-600 hover:bg-accent-600 hover:text-white'
                              } transition-colors`}
                            >
                              {t.isClosed ? <Unlock size={14} /> : <Lock size={14} />}
                              {t.isClosed ? 'Reabrir' : 'Cerrar'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-5 flex-wrap text-[11px] text-neutral-500 py-2 border-t border-dashed border-neutral-300">
                    <span className="flex items-center gap-1"><Lock size={11} className="text-accent-600" /> Cerrado = maestros no pueden modificar notas</span>
                    <span className="flex items-center gap-1"><Unlock size={11} className="text-success-700" /> Abierto = maestros pueden registrar y editar notas</span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-[13px] font-semibold text-brand-700">
                      <span className="flex items-center gap-1.5"><Calendar size={14} /> Días feriados</span>
                      <Button size="sm" onClick={() => { setSelectedYear(y.id); setHolError(''); setShowHolModal(true) }}><Plus size={12} /> Agregar</Button>
                    </div>
                    {!holidays[y.id] || holidays[y.id].length === 0 ? (
                      <p className="text-xs text-neutral-500 italic py-1">Sin feriados registrados</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {holidays[y.id].map(h => (
                          <div key={h.id} className="flex items-center gap-2.5 bg-white border border-neutral-300 rounded-lg px-3 py-2.5">
                            <span className="text-xs font-semibold text-brand-700 whitespace-nowrap min-w-[110px]">{fmt(h.date)}</span>
                            <span className="flex-1 text-[13px] text-brand-700">{h.description}</span>
                            <button onClick={() => handleDeleteHol(y.id, h.id)} className="text-danger-600 hover:bg-danger-100 rounded-md p-1"><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Modal Nueva Gestión */}
      <Modal
        open={showYearModal}
        onClose={() => setShowYearModal(false)}
        title="Nueva Gestión Académica"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowYearModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateYear} loading={saving}>Crear gestión</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {yearError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{yearError}</p>}
          <Input label="Año" required type="number" min={2020} max={2100} value={yearForm.year} onChange={e => setYearForm({ ...yearForm, year: e.target.value })} />
          <Input label="Fecha de inicio" required type="date" value={yearForm.startDate} onChange={e => setYearForm({ ...yearForm, startDate: e.target.value })} />
          <Input label="Fecha de fin" required type="date" value={yearForm.endDate} onChange={e => setYearForm({ ...yearForm, endDate: e.target.value })} />
        </div>
      </Modal>

      {/* Modal Trimestre */}
      <Modal
        open={showTrimModal}
        onClose={() => setShowTrimModal(false)}
        title="Agregar Trimestre"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowTrimModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateTrim} loading={saving}>Agregar trimestre</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {trimError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{trimError}</p>}
          <Select label="Número" required value={trimForm.number} onChange={e => setTrimForm({ ...trimForm, number: e.target.value })}>
            <option value="1">1° Trimestre</option>
            <option value="2">2° Trimestre</option>
            <option value="3">3° Trimestre</option>
          </Select>
          <Input label="Nombre (opcional)" placeholder="Ej: Primer Trimestre" value={trimForm.name} onChange={e => setTrimForm({ ...trimForm, name: e.target.value })} />
          <Input label="Fecha inicio" required type="date" value={trimForm.startDate} onChange={e => setTrimForm({ ...trimForm, startDate: e.target.value })} />
          <Input label="Fecha fin" required type="date" value={trimForm.endDate} onChange={e => setTrimForm({ ...trimForm, endDate: e.target.value })} />
        </div>
      </Modal>

      {/* Modal Feriado */}
      <Modal
        open={showHolModal}
        onClose={() => setShowHolModal(false)}
        title="Registrar Día Feriado"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowHolModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateHol} loading={saving}>Registrar feriado</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {holError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{holError}</p>}
          <Input label="Fecha" required type="date" value={holForm.date} onChange={e => setHolForm({ ...holForm, date: e.target.value })} />
          <Input label="Descripción" required placeholder="Ej: Día de la Independencia" value={holForm.description} onChange={e => setHolForm({ ...holForm, description: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}
