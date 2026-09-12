'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Send, MessageCircle, X, CheckCircle, UserRound } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface RecipientOption {
  parentId:   number
  parentName: string
  phone?:     string
  context:    string
}

interface SentNotification {
  id:        number
  title:     string
  message:   string
  type:      string
  isRead:    boolean
  createdAt: string
  parent:    { firstName: string; lastName: string; phone?: string }
  sentBy?:   { id: number; email: string; role: string }
}

const TYPE_OPTIONS = [
  { value: 'REUNION',   label: '📅 Convocatoria a Reunión' },
  { value: 'ACTIVIDAD', label: '🎯 Actividad Programada'   },
  { value: 'DEUDA',     label: '💰 Recordatorio de Pago'   },
  { value: 'ACADEMICA', label: '📚 Notificación Académica' },
  { value: 'GENERAL',   label: '📢 Comunicado General'     },
]

const GRADE_LABELS: Record<string, string> = {
  PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°',
  CUARTO: '4°', QUINTO: '5°', SEXTO: '6°',
}
const REL_LABELS: Record<string, string> = {
  PADRE: 'Padre', MADRE: 'Madre', TUTOR_LEGAL: 'Tutor Legal', OTRO: 'Otro',
}
const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: 'Dirección', SECRETARY: 'Secretaría', REGENTE: 'Regencia', SUPER_ADMIN: 'Admin',
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function AdminNotificacionesPage() {
  const toast = useToast()

  const [query,     setQuery]     = useState('')
  const [searching, setSearching] = useState(false)
  const [results,   setResults]   = useState<RecipientOption[]>([])
  const [selected,  setSelected]  = useState<RecipientOption | null>(null)

  const [sent,        setSent]        = useState<SentNotification[]>([])
  const [loadingSent, setLoadingSent] = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [whatsapp,    setWhatsapp]    = useState<string | null>(null)
  const [form,        setForm]        = useState({ title: '', message: '', type: 'GENERAL' })

  const fetchSent = useCallback(async () => {
    const token = localStorage.getItem('token')
    setLoadingSent(true)
    try {
      const res  = await fetch(`${API_URL}/api/notifications/sent`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setSent(data)
    } catch { /* silencioso — la tarjeta queda vacía */ }
    finally { setLoadingSent(false) }
  }, [])

  useEffect(() => { fetchSent() }, [fetchSent])

  // Búsqueda unificada estudiante+padre, debounced. Se combinan ambos
  // resultados (mismo padre puede aparecer por las dos vías) para que
  // Dirección pueda buscar "Ramirez" sin saber si coincide con el apellido
  // del hijo o el del propio tutor.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); setSearching(false); return }

    setSearching(true)
    const timer = setTimeout(async () => {
      const token = localStorage.getItem('token')
      try {
        const [sRes, pRes] = await Promise.all([
          fetch(`${API_URL}/api/students?search=${encodeURIComponent(q)}&pageSize=6`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/parents?search=${encodeURIComponent(q)}&pageSize=6`,  { headers: { Authorization: `Bearer ${token}` } }),
        ])
        const [sData, pData] = await Promise.all([sRes.json(), pRes.json()])
        const studentList: any[] = Array.isArray(sData) ? sData : (sData.data || [])
        const parentList:  any[] = Array.isArray(pData) ? pData : (pData.data || [])

        const merged = new Map<number, RecipientOption>()

        studentList.forEach((s) => {
          const course = s.assignments?.[0]?.course
          const courseLabel = course ? ` — ${GRADE_LABELS[course.grade] || course.grade} ${course.parallel}` : ''
          ;(s.parents || []).forEach((ps: any) => {
            if (merged.has(ps.parent.id)) return
            merged.set(ps.parent.id, {
              parentId:   ps.parent.id,
              parentName: `${ps.parent.lastName} ${ps.parent.firstName}`,
              phone:      ps.parent.phone,
              context:    `${ps.isTutor ? '🔑 ' : ''}${REL_LABELS[ps.relationType] || ps.relationType} de ${s.lastName} ${s.firstName}${courseLabel}`,
            })
          })
        })

        parentList.forEach((p) => {
          if (merged.has(p.id)) return
          const kids = (p.students || []).map((ps: any) => `${ps.student.lastName} ${ps.student.firstName}`).join(', ')
          merged.set(p.id, {
            parentId:   p.id,
            parentName: `${p.lastName} ${p.firstName}`,
            phone:      p.phone,
            context:    kids ? `Padre/tutor de: ${kids}` : 'Sin hijos vinculados',
          })
        })

        setResults(Array.from(merged.values()).slice(0, 8))
      } catch { toast('Error de conexión al buscar', 'error') }
      finally { setSearching(false) }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, toast])

  const pick = (r: RecipientOption) => {
    setSelected(r)
    setResults([])
    setQuery('')
  }

  const handleSend = async () => {
    if (!selected || !form.title || !form.message) {
      toast('Seleccioná un destinatario y completá título y mensaje', 'error'); return
    }
    const token = localStorage.getItem('token')
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ parentId: selected.parentId, title: form.title, message: form.message, type: form.type }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'No se pudo enviar la notificación', 'error'); return }
      toast('Notificación enviada correctamente', 'success')
      if (data.whatsapp) setWhatsapp(data.whatsapp)
      setSelected(null)
      setForm({ title: '', message: '', type: 'GENERAL' })
      fetchSent()
    } catch { toast('Error de conexión', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Notificaciones</h1>
        <p className="text-[13px] text-neutral-500">Enviá un aviso puntual a cualquier padre o tutor del colegio</p>
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
        <Card className="flex flex-col gap-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 uppercase tracking-wide pb-2 border-b border-neutral-100">
            <Bell size={14}/> Nueva notificación
          </div>

          {!selected ? (
            <div className="flex flex-col gap-1.5 relative">
              <Input
                label="Destinatario" required
                placeholder="Buscar por nombre del estudiante o del padre/tutor…"
                value={query} onChange={e => setQuery(e.target.value)}
              />
              {query.trim().length >= 2 && (
                <div className="border border-neutral-300 rounded-lg bg-white shadow-sm max-h-64 overflow-y-auto">
                  {searching ? (
                    <div className="px-3 py-3 text-[13px] text-neutral-500">Buscando…</div>
                  ) : results.length === 0 ? (
                    <div className="px-3 py-3 text-[13px] text-neutral-500 italic">Sin resultados</div>
                  ) : (
                    results.map(r => (
                      <button
                        key={r.parentId} type="button" onClick={() => pick(r)}
                        className="w-full text-left px-3 py-2 hover:bg-brand-100/60 border-b border-neutral-100 last:border-b-0 flex flex-col gap-0.5"
                      >
                        <span className="text-[13px] font-semibold text-brand-700">{r.parentName}</span>
                        <span className="text-[11px] text-neutral-500">{r.context}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 bg-brand-100/60 border border-brand-200 rounded-lg px-3 py-2.5">
              <UserRound size={16} className="text-brand-700 flex-shrink-0"/>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-brand-700 truncate">{selected.parentName}</div>
                <div className="text-[11px] text-neutral-500 truncate">
                  {selected.context}{selected.phone ? ` · 📱 ${selected.phone}` : ''}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-[12px] text-brand-700 underline flex-shrink-0">Cambiar</button>
            </div>
          )}

          <Select label="Tipo" required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          <Input
            label="Título" required placeholder="Ej: Reunión de padres, Cita con Dirección…"
            value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          />

          <Textarea
            label="Mensaje" required rows={4} placeholder="Escribe el mensaje para el padre/tutor..."
            value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
          />

          <Button onClick={handleSend} loading={saving} disabled={!selected} className="justify-center">
            {!saving && <Send size={14}/>}
            {saving ? 'Enviando...' : 'Enviar notificación'}
          </Button>
        </Card>

        <Card className="flex flex-col gap-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 uppercase tracking-wide pb-2 border-b border-neutral-100">
            <CheckCircle size={14}/> Enviadas por el colegio ({sent.length})
          </div>
          {loadingSent ? (
            <div className="flex justify-center py-6"><p className="text-sm text-neutral-500">Cargando...</p></div>
          ) : sent.length === 0 ? (
            <p className="text-[13px] text-neutral-500 italic py-2">Todavía no se enviaron notificaciones</p>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto">
              {sent.map(n => (
                <div key={n.id} className="bg-neutral-100/60 border border-neutral-300 rounded-lg p-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-medium bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                      {TYPE_OPTIONS.find(t => t.value === n.type)?.label || n.type}
                    </span>
                    <span className="text-[11px] text-neutral-500">{fmtDate(n.createdAt)}</span>
                  </div>
                  <div className="text-[13px] font-semibold text-brand-700">{n.title}</div>
                  <div className="text-xs text-neutral-500 leading-relaxed">{n.message}</div>
                  <div className="text-[11px] text-info-500 flex items-center gap-2 flex-wrap">
                    Para: {n.parent.lastName} {n.parent.firstName}
                    {n.sentBy && (
                      <span className="text-neutral-500">· Enviada por {ROLE_LABELS[n.sentBy.role] || n.sentBy.role}</span>
                    )}
                    {n.parent.phone && (
                      <a
                        href={`https://wa.me/591${n.parent.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`*${n.title}*\n\n${n.message}`)}`}
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
