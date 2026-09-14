'use client'

import { useEffect, useState } from 'react'
import { UserX, Bell, Send, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '@/components/ui/Card'
import Table, { Column } from '@/components/ui/Table'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import LoadingState from '@/components/ui/LoadingState'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import API_URL from '@/lib/api'
import { todayLocalStr, addDaysLocalStr } from '@/lib/localDate'

const GRADE_LABELS: Record<string, string> = { PRIMERO: '1°', SEGUNDO: '2°', TERCERO: '3°', CUARTO: '4°', QUINTO: '5°', SEXTO: '6°' }

interface Course { id: number; grade: string; parallel: string; level: string }
interface AbsentStudent {
  studentId: number
  firstName: string
  lastName: string
  course: Course | null
  faltasSemana: number
  faltasTrimestre: number
  parentId: number | null
  tutorName: string | null
  tutorPhone: string | null
}
interface ReportData {
  weekStart: string
  weekEnd: string
  trimester: { id: number; name: string; number: number }
  total: number
  students: AbsentStudent[]
}

const BULK_TITLE = '⚠️ Inasistencias de la semana'
const BULK_MESSAGE = 'Le informamos que su hijo/a registra inasistencias esta semana. Por favor comuníquese con la Dirección para más información.'

function courseLabel(c: Course | null) {
  if (!c) return '—'
  return `${GRADE_LABELS[c.grade] || c.grade} "${c.parallel}"`
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type SortKey = 'curso' | 'semana' | 'trimestre'

export default function AusenciasSemanalPage() {
  const toast = useToast()
  const confirm = useConfirm()

  const [data,    setData]    = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [anchorDate, setAnchorDate] = useState(todayLocalStr())
  const [sortKey, setSortKey] = useState<SortKey>('curso')
  const [sendingBulk, setSendingBulk] = useState(false)
  const [notifyFor,   setNotifyFor]   = useState<AbsentStudent | null>(null)
  const [modalTitle,   setModalTitle]   = useState(BULK_TITLE)
  const [modalMessage, setModalMessage] = useState(BULK_MESSAGE)
  const [sendingOne, setSendingOne] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  const load = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/reports/absences-weekly?date=${anchorDate}`, { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) { toast(json.message || 'Error al cargar el reporte', 'error'); return }
      setData(json)
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [anchorDate])

  const students = [...(data?.students || [])].sort((a, b) => {
    if (sortKey === 'semana')    return b.faltasSemana - a.faltasSemana
    if (sortKey === 'trimestre') return b.faltasTrimestre - a.faltasTrimestre
    return 0 // 'curso' -> ya viene ordenado por curso/estudiante desde el backend
  })

  const openNotify = (s: AbsentStudent) => {
    setModalTitle(BULK_TITLE)
    setModalMessage(BULK_MESSAGE)
    setNotifyFor(s)
  }

  const handleSendOne = async () => {
    if (!notifyFor?.parentId) return
    setSendingOne(true)
    try {
      const res  = await fetch(`${API_URL}/api/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ parentId: notifyFor.parentId, title: modalTitle, message: modalMessage, type: 'ACADEMICA' }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.message || 'Error al enviar', 'error'); return }
      toast(`Notificación enviada a ${notifyFor.tutorName}`, 'success')
      setNotifyFor(null)
    } catch { toast('Error de conexión', 'error') }
    finally { setSendingOne(false) }
  }

  const handleSendAll = async () => {
    const withTutor = students.filter((s) => s.parentId)
    if (withTutor.length === 0) { toast('No hay tutores con cuenta vinculada en la lista', 'error'); return }

    const ok = await confirm(
      `Se enviará el mismo mensaje a ${withTutor.length} padre${withTutor.length !== 1 ? 's' : ''}: "${BULK_MESSAGE}" ¿Confirmás el envío?`,
      { confirmLabel: 'Enviar a todos' }
    )
    if (!ok) return

    setSendingBulk(true)
    try {
      const res  = await fetch(`${API_URL}/api/notifications/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ parentIds: withTutor.map((s) => s.parentId), title: BULK_TITLE, message: BULK_MESSAGE, type: 'ACADEMICA' }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.message || 'Error al enviar', 'error'); return }
      toast(`Notificación enviada a ${withTutor.length} tutores`, 'success')
    } catch { toast('Error de conexión', 'error') }
    finally { setSendingBulk(false) }
  }

  const columns: Column<AbsentStudent>[] = [
    { key: 'course', header: 'Curso', render: (s) => <Badge tone="brand">{courseLabel(s.course)}</Badge> },
    { key: 'student', header: 'Estudiante', render: (s) => <span className="font-semibold text-brand-700">{s.lastName} {s.firstName}</span> },
    { key: 'tutor', header: 'Tutor', render: (s) => s.tutorName ? <div><div className="text-[13px]">{s.tutorName}</div>{s.tutorPhone && <div className="text-[11px] text-neutral-500">{s.tutorPhone}</div>}</div> : <span className="text-neutral-500 text-xs">Sin tutor vinculado</span> },
    { key: 'semana', header: 'Faltas semana', render: (s) => <Badge tone={s.faltasSemana >= 3 ? 'danger' : 'warning'}>{s.faltasSemana}</Badge> },
    { key: 'trimestre', header: 'Faltas trimestre', render: (s) => <Badge tone={s.faltasTrimestre >= 6 ? 'danger' : 'neutral'}>{s.faltasTrimestre}</Badge> },
    {
      key: 'actions', header: 'Notificar', render: (s) => (
        <button
          title="Notificar al tutor" onClick={() => openNotify(s)} disabled={!s.parentId}
          className="w-7 h-7 rounded-md bg-brand-100 text-brand-700 flex items-center justify-center hover:opacity-75 disabled:opacity-30"
        >
          <Bell size={13} />
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={UserX}
        title="Estudiantes Ausentes — Semanal"
        description="Faltas de la semana y del trimestre vigente, por curso y estudiante"
      />

      <Card className="mb-4 flex items-center justify-center gap-1.5">
        <Button aria-label="Semana anterior" variant="ghost" size="sm" onClick={() => setAnchorDate((d) => addDaysLocalStr(d, -7))}>
          <ChevronLeft size={16} />
        </Button>
        <span className="text-[13px] font-semibold text-brand-700 min-w-[150px] text-center">
          {data ? `${formatShortDate(data.weekStart)} al ${formatShortDate(data.weekEnd)}` : '—'}
        </span>
        <Button aria-label="Semana siguiente" variant="ghost" size="sm" onClick={() => setAnchorDate((d) => addDaysLocalStr(d, 7))}>
          <ChevronRight size={16} />
        </Button>
      </Card>

      {loading ? (
        <LoadingState />
      ) : !data || data.total === 0 ? (
        <Card className="text-center py-12 text-neutral-500">No hay estudiantes con faltas esta semana</Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="text-[13px] text-neutral-500">
              <span className="font-semibold text-brand-700">{data.total}</span> estudiante{data.total !== 1 ? 's' : ''} con faltas esta semana · {data.trimester.name}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-neutral-500 flex items-center gap-1"><ArrowUpDown size={11} /> Ordenar por:</span>
                {([
                  { key: 'curso' as const, label: 'Curso' },
                  { key: 'semana' as const, label: 'Faltas semana' },
                  { key: 'trimestre' as const, label: 'Faltas trimestre' },
                ]).map((o) => (
                  <button
                    key={o.key} onClick={() => setSortKey(o.key)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${sortKey === o.key ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-brand-700 hover:bg-brand-100'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <Button onClick={handleSendAll} loading={sendingBulk}>
                <Send size={14} /> Enviar a todos
              </Button>
            </div>
          </Card>

          <Table columns={columns} rows={students} rowKey={(s) => s.studentId} loading={false} emptyLabel="Sin resultados" />
        </>
      )}

      {/* ── Modal notificar individual ── */}
      <Modal
        open={!!notifyFor}
        onClose={() => setNotifyFor(null)}
        title="Notificar al tutor"
        maxWidth={480}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNotifyFor(null)}>Cancelar</Button>
            <Button onClick={handleSendOne} loading={sendingOne}>Enviar</Button>
          </>
        }
      >
        {notifyFor && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-neutral-500">
              {notifyFor.lastName} {notifyFor.firstName} · tutor: {notifyFor.tutorName}
              {notifyFor.tutorPhone && ` · ${notifyFor.tutorPhone}`}
            </p>
            <input
              value={modalTitle} onChange={(e) => setModalTitle(e.target.value)}
              className="h-10 px-3 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600"
              placeholder="Título"
            />
            <textarea
              value={modalMessage} onChange={(e) => setModalMessage(e.target.value)}
              rows={4}
              className="px-3 py-2.5 rounded-lg border border-neutral-300 text-sm outline-none focus:border-brand-600 resize-none"
              placeholder="Mensaje"
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
