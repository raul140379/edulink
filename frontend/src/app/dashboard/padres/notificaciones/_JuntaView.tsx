'use client'

import { useEffect, useState } from 'react'
import { Bell, Send, MessageCircle, X, CheckCircle, Search } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Parent {
  id:        number
  firstName: string
  lastName:  string
  phone?:    string
  ci?:       string
  students:  { student: { firstName: string; lastName: string } }[]
}

interface SentNotification {
  id:        number
  title:     string
  message:   string
  type:      string
  isRead:    boolean
  createdAt: string
  parent:    { firstName: string; lastName: string; phone?: string }
}

const TYPE_OPTIONS = [
  { value: 'REUNION',   label: '📅 Convocatoria a Reunión' },
  { value: 'ACTIVIDAD', label: '🎯 Actividad Programada'   },
  { value: 'DEUDA',     label: '💰 Recordatorio de Pago'   },
  { value: 'ACADEMICA', label: '📚 Notificación Académica' },
  { value: 'GENERAL',   label: '📢 Comunicado General'     },
]

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
})

export default function JuntaNotificacionesPage() {
  const toast = useToast()
  const [parents,  setParents]  = useState<Parent[]>([])
  const [sent,     setSent]     = useState<SentNotification[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [whatsapp, setWhatsapp] = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  const [form,     setForm]     = useState({
    parentId: '', title: '', message: '', type: 'GENERAL'
  })

  const fetchData = async () => {
    const token = localStorage.getItem('token')
    setLoading(true)
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/treasury/parents`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/notifications/sent`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [pData, sData] = await Promise.all([pRes.json(), sRes.json()])
      if (pRes.ok) setParents(pData)
      if (sRes.ok) setSent(sData)
    } catch { toast('Error de conexión', 'error') }
    finally  { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleSend = async () => {
    if (!form.parentId || !form.title || !form.message) {
      toast('Todos los campos son requeridos', 'error'); return
    }
    const token = localStorage.getItem('token')
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/notifications/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(data.message, 'success')
      if (data.whatsapp) setWhatsapp(data.whatsapp)
      setForm({ parentId: '', title: '', message: '', type: 'GENERAL' })
      const sRes  = await fetch(`${API_URL}/api/notifications/sent`, { headers: { Authorization: `Bearer ${token}` } })
      const sData = await sRes.json()
      if (sRes.ok) setSent(sData)
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const selectedParent = parents.find(p => p.id === parseInt(form.parentId))

  const filteredParents = parents.filter(p => {
    const q = search.toLowerCase()
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q)  ||
      (p.ci || '').toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Notificaciones</h1>
        <p className="text-[13px] text-neutral-500">Envía avisos a los padres de familia</p>
      </div>

      {whatsapp && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-[#E8FFF0] border border-[#25D366] rounded-[10px] mb-4 text-[13px] text-brand-700 flex-wrap">
          <MessageCircle size={16} className="text-[#25D366]"/>
          <span>Notificación enviada. ¿También enviar por WhatsApp?</span>
          <a href={whatsapp} target="_blank" rel="noreferrer" className="bg-[#25D366] text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-[#1DA851] transition-colors">
            Abrir WhatsApp
          </a>
          <button onClick={() => setWhatsapp(null)} className="ml-auto text-neutral-500 hover:text-brand-700"><X size={14}/></button>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Formulario */}
        <Card className="flex flex-col gap-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 uppercase tracking-wide pb-2 border-b border-neutral-100">
            <Bell size={14}/> Nueva notificación
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-[38px] text-info-500 pointer-events-none"/>
            <Input
              label="Buscar padre" required placeholder="Buscar por nombre o CI..."
              value={search} onChange={e => setSearch(e.target.value)} className="pl-9"
            />
          </div>

          <div>
            <Select label="Padre / Tutor" required value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })}>
              <option value="">— Selecciona un padre —</option>
              {filteredParents.map(p => (
                <option key={p.id} value={p.id}>
                  {p.lastName} {p.firstName}
                  {p.ci ? ` — CI: ${p.ci}` : ''}
                  {p.students?.length > 0 ? ` (${p.students.map(s => `${s.student.lastName} ${s.student.firstName}`).join(', ')})` : ''}
                </option>
              ))}
            </Select>
            {selectedParent?.phone && <span className="text-[11px] text-neutral-500 mt-1 block">📱 {selectedParent.phone}</span>}
            {selectedParent && !selectedParent.phone && <span className="text-[11px] text-[#BA7517] mt-1 block">⚠️ Sin número de teléfono registrado</span>}
          </div>

          <Select label="Tipo" required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          <Input
            label="Título" required placeholder="Ej: Reunión de padres, Recordatorio de pago..."
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          />

          <Textarea
            label="Mensaje" required rows={4} placeholder="Escribe el mensaje para el padre de familia..."
            value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
          />

          {selectedParent?.phone && form.title && form.message && (
            <div className="bg-[#E8FFF0] border border-[#25D366] rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#25D366] mb-2">
                <MessageCircle size={13}/> Vista previa WhatsApp
              </div>
              <div className="text-xs text-brand-700 leading-relaxed bg-white rounded-md p-2.5">
                <strong>{form.title}</strong>
                <br/>{form.message}
                <br/><br/>
                <em>— U.E. Naciones Unidas</em>
              </div>
            </div>
          )}

          <Button onClick={handleSend} loading={saving} className="justify-center">
            {!saving && <Send size={14}/>}
            {saving ? 'Enviando...' : 'Enviar notificación'}
          </Button>
        </Card>

        {/* Notificaciones enviadas */}
        <Card className="flex flex-col gap-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 uppercase tracking-wide pb-2 border-b border-neutral-100">
            <CheckCircle size={14}/> Enviadas ({sent.length})
          </div>
          {loading ? (
            <div className="flex justify-center py-6"><p className="text-sm text-neutral-500">Cargando...</p></div>
          ) : sent.length === 0 ? (
            <p className="text-[13px] text-neutral-500 italic py-2">No hay notificaciones enviadas aún</p>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto">
              {sent.map(n => (
                <div key={n.id} className="bg-neutral-100/60 border border-neutral-300 rounded-lg p-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium bg-success-100 text-success-700 px-2 py-0.5 rounded-full">
                      {TYPE_OPTIONS.find(t => t.value === n.type)?.label || n.type}
                    </span>
                    <span className="text-[11px] text-neutral-500">{fmtDate(n.createdAt)}</span>
                  </div>
                  <div className="text-[13px] font-semibold text-brand-700">{n.title}</div>
                  <div className="text-xs text-neutral-500 leading-relaxed">{n.message}</div>
                  <div className="text-[11px] text-info-500 flex items-center gap-2 flex-wrap">
                    Para: {n.parent.lastName} {n.parent.firstName}
                    {n.parent.phone && (
                      <a
                        href={`https://wa.me/591${n.parent.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`*${n.title}*\n\n${n.message}\n\n— U.E. Naciones Unidas`)}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 bg-[#25D366] text-white px-1.5 py-0.5 rounded-[10px] text-[10px] hover:bg-[#1DA851] transition-colors"
                      >
                        <MessageCircle size={11}/> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
