'use client'

import { useState } from 'react'
import { X, CheckCircle2, MessageCircle, Info } from 'lucide-react'
import Button from '@/components/Button'
import { notificacionesApi, TIPOS, NotificationType } from './api'
import { TutorInfo } from '@/modules/asistencia/api'
import { ApiError } from '@/lib/api'

interface Props {
  studentName: string
  tutor: TutorInfo
  onClose: () => void
  onSent: () => void
}

export default function NotifySheet({ studentName, tutor, onClose, onSent }: Props) {
  const [type,    setType]    = useState<NotificationType>('ACADEMICA')
  const [title,   setTitle]   = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error,   setError]   = useState('')
  const [whatsapp, setWhatsapp] = useState<string | null | undefined>(undefined) // undefined = todavía no se envió

  const handleSend = async () => {
    if (!title || !message) { setError('Completá título y mensaje'); return }
    setError('')
    setSending(true)
    try {
      const result = await notificacionesApi.send(tutor.id, title, message, type)
      setWhatsapp(result.whatsapp) // null = sin teléfono registrado; string = link listo para abrir
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error de conexión')
    } finally {
      setSending(false)
    }
  }

  const handleDone = () => onSent()

  // Estado "ya se envió" — la notificación SIEMPRE queda guardada en el
  // sistema (el padre la ve en su cuenta); WhatsApp es un link que el
  // maestro abre a mano si quiere, nunca un envío automático — dejarlo
  // clarísimo acá, no en silencio.
  if (whatsapp !== undefined) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/40" onClick={handleDone} />
        <div className="relative bg-white rounded-t-2xl px-5 pt-4 pb-6 flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5 text-success-700">
            <CheckCircle2 size={22} className="shrink-0" />
            <div>
              <div className="text-[15px] font-bold">Notificación enviada</div>
              <div className="text-[13px] text-text-secondary">{tutor.firstName} {tutor.lastName} la verá en su cuenta de EduLink</div>
            </div>
          </div>

          {whatsapp ? (
            <a
              href={whatsapp} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[15px] font-semibold text-white"
              style={{ background: '#25D366' }}
            >
              <MessageCircle size={18} /> Abrir WhatsApp
            </a>
          ) : (
            <div className="flex items-start gap-2 text-[13px] text-text-secondary bg-bg-soft rounded-lg px-3.5 py-3">
              <Info size={15} className="shrink-0 mt-0.5" />
              Este padre no tiene WhatsApp registrado — solo verá el aviso en el sistema.
            </div>
          )}

          <Button variant="secondary" onClick={handleDone}>Listo</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl px-5 pt-4 pb-6 flex flex-col gap-3.5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[15px] font-bold text-brand-700">Notificar</div>
            <div className="text-[13px] text-text-secondary">{studentName} · tutor: {tutor.lastName} {tutor.firstName}</div>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-secondary"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {TIPOS.map(t => (
            <button
              key={t.value} onClick={() => setType(t.value)}
              className={`px-2.5 py-2 rounded-lg border text-left text-[13px] font-medium transition-colors ${type === t.value ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-border'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Título (ej: Tarea no presentada)"
          className="h-11 px-3.5 rounded-xl border border-border text-[15px] outline-none focus:border-brand-600"
        />
        <textarea
          value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Mensaje..." rows={3}
          className="px-3.5 py-2.5 rounded-xl border border-border text-[15px] outline-none focus:border-brand-600 resize-none"
        />

        {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{error}</p>}

        <Button onClick={handleSend} loading={sending} disabled={!title || !message}>
          Enviar a {tutor.firstName}
        </Button>
      </div>
    </div>
  )
}
