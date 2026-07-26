'use client'

import { useEffect, useState } from 'react'
import { Plus, Megaphone, EyeOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

type ComunicadoType = 'COMUNICADO' | 'CONVOCATORIA' | 'AVISO'

interface Comunicado {
  id:          number
  title:       string
  body:        string
  type:        ComunicadoType
  isPublished: boolean
  publishedAt: string
  author:      { id: number; email: string }
}

const TYPE_LABELS: Record<ComunicadoType, string> = {
  COMUNICADO:   'Comunicado',
  CONVOCATORIA: 'Convocatoria',
  AVISO:        'Aviso',
}

const TYPE_TONE: Record<ComunicadoType, 'brand' | 'warning' | 'danger'> = {
  COMUNICADO:   'brand',
  CONVOCATORIA: 'warning',
  AVISO:        'danger',
}

const emptyForm: { title: string; body: string; type: ComunicadoType } = { title: '', body: '', type: 'COMUNICADO' }

// Reusa /api/comunicados — el backend resuelve el alcance (colegio/núcleo/distrito)
// según el rol de quien publica (STUDENT_GOV/GOBIERNO_NUCLEO/GOBIERNO_DISTRITO).
export default function EstudiantesComunicadosPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const toast = useToast()
  const confirm = useConfirm()

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const fetchComunicados = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/comunicados`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setComunicados(data)
    } catch { toast('Error al cargar los comunicados', 'error') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchComunicados() }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setFormError(''); setShowModal(true)
  }

  const handleCreate = async () => {
    if (!form.title || !form.body) { setFormError('El título y el contenido son requeridos'); return }
    setFormError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/comunicados`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.message); return }
      toast('Comunicado publicado correctamente', 'success')
      setShowModal(false)
      fetchComunicados()
    } catch { setFormError('Error de conexión') }
    finally  { setSaving(false) }
  }

  const handleUnpublish = async (id: number) => {
    const ok = await confirm('¿Despublicar este comunicado?', { danger: true, confirmLabel: 'Despublicar' })
    if (!ok) return
    try {
      const res = await fetch(`${API_URL}/api/comunicados/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { const data = await res.json(); toast(data.message, 'error'); return }
      toast('Comunicado despublicado correctamente', 'success')
      fetchComunicados()
    } catch { toast('Error de conexión', 'error') }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Comunicados</h1>
          <p className="text-[13px] text-neutral-500">Convocatorias y avisos para tu alcance (colegio, núcleo o distrito)</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo comunicado</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-neutral-500">Cargando...</div>
      ) : comunicados.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-neutral-500">No hay comunicados publicados todavía</div>
      ) : (
        <div className="flex flex-col gap-3">
          {comunicados.map((c) => (
            <Card key={c.id} className={`flex gap-3 ${c.isPublished ? '' : 'opacity-60'}`}>
              <div className="w-10 h-10 rounded-[10px] bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <Megaphone size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Badge tone={TYPE_TONE[c.type]}>{TYPE_LABELS[c.type]}</Badge>
                  {!c.isPublished && <Badge tone="neutral">Despublicado</Badge>}
                  <span className="text-[11px] text-neutral-500 ml-auto">
                    {new Date(c.publishedAt).toLocaleDateString('es-BO')}
                  </span>
                </div>
                <div className="text-[15px] font-bold text-brand-700 mb-1">{c.title}</div>
                <div className="text-[13px] text-neutral-700 whitespace-pre-wrap mb-1.5">{c.body}</div>
                <div className="text-[11px] text-neutral-500">Publicado por {c.author.email}</div>
              </div>
              {c.isPublished && (
                <button
                  title="Despublicar"
                  onClick={() => handleUnpublish(c.id)}
                  className="shrink-0 self-start text-neutral-500 hover:text-danger-600 hover:bg-danger-100 rounded-lg p-1.5 transition-colors"
                >
                  <EyeOff size={16} />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo Comunicado"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Publicar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          {formError && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{formError}</p>}
          <Select label="Tipo" required value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ComunicadoType })}>
            <option value="COMUNICADO">Comunicado</option>
            <option value="CONVOCATORIA">Convocatoria</option>
            <option value="AVISO">Aviso</option>
          </Select>
          <Input label="Título" required placeholder="Título del comunicado" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Contenido" required rows={5} placeholder="Contenido del comunicado" value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })} />
        </div>
      </Modal>
    </div>
  )
}
