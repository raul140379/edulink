'use client'

import { useEffect, useState } from 'react'
import { Plus, Building2, Users, GraduationCap, Upload } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const TIPO_LABELS: Record<string, string> = { FISCAL: 'Fiscal', CONVENIO: 'Convenio', PRIVADA: 'Privada' }
const SUBSISTEMA_LABELS: Record<string, string> = {
  REGULAR: 'Regular',
  ALTERNATIVA_ESPECIAL: 'Alternativa y Especial',
  SUPERIOR_FORMACION_PROFESIONAL: 'Superior de Formación Profesional',
}

interface Nucleo {
  id:       number
  name:     string
  location: string | null
}

interface School {
  id:         number
  name:       string
  sieCode:    string
  tipo:       'FISCAL' | 'CONVENIO' | 'PRIVADA'
  area:       'URBANA' | 'RURAL'
  subsistema: string
  address:    string | null
  isActive:   boolean
  district:   { id: number; name: string }
  nucleo:     Nucleo | null
  _count:     { students: number; teachers: number; parents: number }
}

const emptyForm = { name: '', sieCode: '', tipo: 'FISCAL', area: 'URBANA', subsistema: 'REGULAR', address: '', nucleoId: '' }

export default function ColegiosPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [nucleos, setNucleos] = useState<Nucleo[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const toast = useToast()

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchSchools = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/schools`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setSchools(data)
    } catch { toast('Error al cargar las unidades educativas', 'error') }
    finally  { setLoading(false) }
  }

  const fetchNucleos = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/nucleos`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setNucleos(data)
    } catch { /* selector opcional, no bloquea la pantalla */ }
  }

  useEffect(() => { fetchSchools(); fetchNucleos() }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError(''); setShowModal(true)
  }

  const handleCreate = async () => {
    if (!form.name || !form.sieCode) { setFormError('El nombre y el código SIE son requeridos'); return }
    setFormError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/schools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, nucleoId: form.nucleoId ? Number(form.nucleoId) : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message); return }
      toast('Unidad educativa creada correctamente', 'success')
      setShowModal(false)
      fetchSchools()
    } catch { setFormError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const res  = await fetch(`${API_URL}/api/schools/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      setShowImport(false)
      setImportFile(null)
      fetchSchools()
    } catch { toast('Error de conexión', 'error') }
    finally  { setImporting(false) }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Unidades Educativas</h1>
          <p className="text-[13px] text-neutral-500">Colegios del distrito</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setImportFile(null); setShowImport(true) }}><Upload size={16} /> Importar planilla</Button>
          <Button onClick={openCreate}><Plus size={16} /> Nuevo colegio</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-neutral-500">
          Cargando...
        </div>
      ) : schools.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-neutral-500">
          No hay unidades educativas registradas todavía
        </div>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {schools.map((s) => (
            <Card key={s.id} className="flex gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <Building2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-brand-700 mb-1.5">{s.name}</div>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  <Badge tone="info">SIE: {s.sieCode}</Badge>
                  <Badge tone="info">{TIPO_LABELS[s.tipo] || s.tipo}</Badge>
                  <Badge tone="info">{s.area === 'URBANA' ? 'Urbana' : 'Rural'}</Badge>
                  {s.subsistema !== 'REGULAR' && <Badge tone="warning">{SUBSISTEMA_LABELS[s.subsistema] || s.subsistema}</Badge>}
                  {!s.isActive && <Badge tone="danger">Inactiva</Badge>}
                </div>
                <div className="text-[11px] text-neutral-500 mb-2">
                  {s.district.name}{s.nucleo ? ` · Núcleo ${s.nucleo.name}` : ''}
                </div>
                <div className="flex flex-col gap-1 text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1.5"><GraduationCap size={13} /> {s._count.students} estudiantes</span>
                  <span className="flex items-center gap-1.5"><Users size={13} /> {s._count.teachers} maestros · {s._count.parents} padres</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo Colegio"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Crear colegio</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{formError}</p>}
          <Input label="Nombre" required placeholder="U.E. ..." value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Código SIE" required placeholder="41980023" value={form.sieCode}
            onChange={e => setForm({ ...form, sieCode: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" required value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option value="FISCAL">Fiscal</option>
              <option value="CONVENIO">Convenio</option>
              <option value="PRIVADA">Privada</option>
            </Select>
            <Select label="Área" required value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}>
              <option value="URBANA">Urbana</option>
              <option value="RURAL">Rural</option>
            </Select>
          </div>
          <Select label="Subsistema" value={form.subsistema} onChange={e => setForm({ ...form, subsistema: e.target.value })}
            hint="Educación Regular es el único subsistema con flujo académico propio en el sistema hoy">
            <option value="REGULAR">Regular</option>
            <option value="ALTERNATIVA_ESPECIAL">Alternativa y Especial</option>
            <option value="SUPERIOR_FORMACION_PROFESIONAL">Superior de Formación Profesional</option>
          </Select>
          <Input label="Dirección" placeholder="Opcional" value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })} />
          <Select label="Núcleo" value={form.nucleoId} onChange={e => setForm({ ...form, nucleoId: e.target.value })}>
            <option value="">Sin asignar</option>
            {nucleos.map(n => (
              <option key={n.id} value={n.id}>{n.name}{n.location ? ` (${n.location})` : ''}</option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Importar colegios desde planilla"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImport(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={!importFile} loading={importing}>Importar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <p className="text-[13px] text-neutral-500">
            Sube un archivo Excel con las columnas <b>SIE</b>, <b>NOMBRE</b>, <b>DEPENDENCIA</b> (Fiscal/Convenio/Privada),
            <b> AREA</b> (Urbana/Rural) y opcionalmente <b>NUCLEO</b> (por nombre).
          </p>
          <input
            type="file" accept=".xlsx,.xls"
            onChange={e => setImportFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-100 file:text-brand-700 file:text-sm file:font-semibold"
          />
        </div>
      </Modal>
    </div>
  )
}
