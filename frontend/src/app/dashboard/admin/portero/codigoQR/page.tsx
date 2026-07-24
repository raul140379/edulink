'use client'

import { useEffect, useState, useRef } from 'react'
import { RefreshCw, Download, Search } from 'lucide-react'
import QRCode from 'qrcode'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/ConfirmProvider'
import { useToast } from '@/components/ui/ToastProvider'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface PersonCode {
  id: number
  firstName: string
  lastName: string
  ci?: string
  attendanceCode?: string
  staffRole?: string
  specialty?: string
  type: 'MAESTRO' | 'STAFF'
}

export default function CodigosPage() {
  const confirm = useConfirm()
  const toast   = useToast()

  const [teachers,    setTeachers]    = useState<PersonCode[]>([])
  const [staff,       setStaff]       = useState<PersonCode[]>([])
  const [loading,     setLoading]     = useState(true)
  const [generating,  setGenerating]  = useState(false)
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState<'ALL'|'MAESTRO'|'STAFF'>('ALL')
  const [selected,    setSelected]    = useState<PersonCode|null>(null)
  const [qrDataUrl,   setQrDataUrl]   = useState<string>('')
  const printRef = useRef<HTMLDivElement>(null)

  const token = () => localStorage.getItem('token') || ''
  const auth  = () => ({ Authorization: `Bearer ${token()}` })

  const loadCodes = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/gate/attendance-codes`, { headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast('Error al cargar códigos', 'error'); return }
      setTeachers(data.teachers.map((t: any) => ({ ...t, type: 'MAESTRO' })))
      setStaff(data.staff.map((s: any) => ({ ...s, type: 'STAFF' })))
    } catch { toast('Error de conexión', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadCodes() }, [])

  useEffect(() => {
    if (selected?.attendanceCode) {
      QRCode.toDataURL(selected.attendanceCode, {
        width: 300, margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      }).then(setQrDataUrl).catch(() => setQrDataUrl(''))
    } else {
      setQrDataUrl('')
    }
  }, [selected])

  const handleGenerateAll = async () => {
    if (!await confirm('¿Generar códigos para todos los que no tienen? Los existentes no se modifican.')) return
    setGenerating(true)
    try {
      const res  = await fetch(`${API}/api/gate/generate-codes`, {
        method: 'POST', headers: auth()
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(`✅ ${data.message}`, 'success')
      loadCodes()
    } catch { toast('Error de conexión', 'error') }
    finally { setGenerating(false) }
  }

  const handleRegenerate = async (person: PersonCode) => {
    if (!await confirm(`¿Regenerar código de ${person.firstName} ${person.lastName}? El código anterior dejará de funcionar.`, { danger: true })) return
    try {
      const endpoint = person.type === 'STAFF'
        ? `${API}/api/gate/regenerate-code/staff/${person.id}`
        : `${API}/api/gate/regenerate-code/teacher/${person.id}`
      const res  = await fetch(endpoint, { method: 'POST', headers: auth() })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(`✅ Código regenerado: ${data.attendanceCode}`, 'success')
      loadCodes()
      if (selected?.id === person.id && selected?.type === person.type) {
        setSelected({ ...person, attendanceCode: data.attendanceCode })
      }
    } catch { toast('Error de conexión', 'error') }
  }

  const handlePrint = () => {
    if (!selected || !qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>QR - ${selected.lastName} ${selected.firstName}</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px; }
        .card { border: 2px solid #1A3A7C; border-radius: 12px; padding: 24px; text-align: center; max-width: 280px; }
        .name { font-size: 16px; font-weight: 700; color: #1A3A7C; margin: 12px 0 4px; }
        .role { font-size: 12px; color: #6B8BB0; margin-bottom: 8px; }
        .code { font-size: 20px; font-weight: 800; letter-spacing: 4px; color: #0F172A; font-family: monospace; }
        .school { font-size: 11px; color: #94A3B8; margin-top: 12px; }
        img { width: 220px; height: 220px; }
      </style></head><body>
      <div class="card">
        <div class="school">U.E. Naciones Unidas — El Torno</div>
        <img src="${qrDataUrl}" alt="QR"/>
        <div class="name">${selected.lastName} ${selected.firstName}</div>
        <div class="role">${selected.type === 'STAFF' ? selected.staffRole : 'MAESTRO'}</div>
        <div class="code">${selected.attendanceCode}</div>
      </div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `)
    win.document.close()
  }

  const handlePrintAll = async () => {
    const all = [...teachers, ...staff].filter(p => p.attendanceCode)
    if (all.length === 0) { toast('No hay códigos generados', 'error'); return }

    const cards = await Promise.all(all.map(async p => {
      const url = await QRCode.toDataURL(p.attendanceCode!, {
        width: 200, margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      })
      return `
        <div class="card">
          <div class="school">U.E. Naciones Unidas</div>
          <img src="${url}" alt="QR"/>
          <div class="name">${p.lastName} ${p.firstName}</div>
          <div class="role">${p.type === 'STAFF' ? p.staffRole : 'MAESTRO'}</div>
          <div class="code">${p.attendanceCode}</div>
        </div>
      `
    }))

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>Códigos QR — EduLink</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 16px; color: #1A3A7C; text-align: center; margin-bottom: 20px; }
        .grid { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
        .card { border: 1.5px solid #1A3A7C; border-radius: 10px; padding: 14px; text-align: center; width: 180px; page-break-inside: avoid; }
        .name { font-size: 11px; font-weight: 700; color: #1A3A7C; margin: 8px 0 2px; }
        .role { font-size: 9px; color: #6B8BB0; margin-bottom: 4px; }
        .code { font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #0F172A; font-family: monospace; }
        .school { font-size: 9px; color: #94A3B8; }
        img { width: 150px; height: 150px; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <h1>Códigos QR de Asistencia — U.E. Naciones Unidas</h1>
      <div class="grid">${cards.join('')}</div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `)
    win.document.close()
  }

  const allPersons = [
    ...teachers.map(t => ({ ...t, type: 'MAESTRO' as const })),
    ...staff.map(s => ({ ...s, type: 'STAFF' as const }))
  ]
  const filtered = allPersons.filter(p => {
    const matchFilter = filter === 'ALL' || p.type === filter
    const matchSearch = search === '' ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      p.attendanceCode?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const withCode    = allPersons.filter(p => p.attendanceCode).length
  const withoutCode = allPersons.filter(p => !p.attendanceCode).length

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-brand-700 mb-1">Códigos QR de Asistencia</h1>
          <p className="text-[13px] text-neutral-500">Genera y distribuye los códigos de registro para maestros y personal</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={handlePrintAll} className="!bg-success-700 !text-white !border-success-700">
            <Download size={14}/> Imprimir todos
          </Button>
          <Button onClick={handleGenerateAll} disabled={generating} loading={generating}>
            {!generating && <RefreshCw size={14}/>} {generating ? 'Generando...' : 'Generar faltantes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="text-center">
          <div className="text-[28px] font-extrabold text-brand-700">{allPersons.length}</div>
          <div className="text-[11px] text-neutral-500">Total personas</div>
        </Card>
        <Card className="text-center !bg-success-100 !border-success-500/40">
          <div className="text-[28px] font-extrabold text-success-700">{withCode}</div>
          <div className="text-[11px] text-success-700/80">Con código QR</div>
        </Card>
        <Card className="text-center !bg-danger-100 !border-danger-500/40">
          <div className="text-[28px] font-extrabold text-danger-600">{withoutCode}</div>
          <div className="text-[11px] text-danger-600/80">Sin código QR</div>
        </Card>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 340px' }}>
        <div>
          <div className="flex gap-2.5 mb-3.5 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500"/>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full pl-8 pr-3 py-2.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none box-border"
              />
            </div>
            {(['ALL', 'MAESTRO', 'STAFF'] as const).map(f => (
              <button
                key={f} onClick={() => setFilter(f)}
                className={`px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${filter === f ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-brand-700'}`}
              >
                {f === 'ALL' ? 'Todos' : f === 'MAESTRO' ? 'Maestros' : 'Personal'}
              </button>
            ))}
          </div>

          <Card padded={false} className="overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-neutral-500">Cargando...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-neutral-100">
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Persona</th>
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Tipo</th>
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Código QR</th>
                      <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr
                        key={`${p.type}-${p.id}`}
                        onClick={() => setSelected(p)}
                        className={`border-t border-neutral-100 cursor-pointer ${selected?.id === p.id && selected?.type === p.type ? 'bg-brand-100' : 'hover:bg-neutral-100/50'}`}
                      >
                        <td className="px-3.5 py-2.5 align-middle">
                          <div className="text-[13px] font-semibold text-brand-700">{p.lastName} {p.firstName}</div>
                          {p.ci && <div className="text-[11px] text-neutral-500">CI: {p.ci}</div>}
                        </td>
                        <td className="px-3.5 py-2.5 align-middle">
                          <Badge tone={p.type === 'MAESTRO' ? 'info' : 'success'}>{p.type === 'STAFF' ? p.staffRole : 'MAESTRO'}</Badge>
                        </td>
                        <td className="px-3.5 py-2.5 align-middle">
                          {p.attendanceCode ? (
                            <span className="font-mono text-sm font-bold text-brand-700 tracking-[2px]">{p.attendanceCode}</span>
                          ) : (
                            <span className="text-[11px] text-danger-600">Sin código</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 align-middle" onClick={e => e.stopPropagation()}>
                          <Button variant="secondary" size="sm" onClick={() => handleRegenerate(p)}>
                            <RefreshCw size={11}/> Regenerar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card className="sticky top-5">
            {!selected ? (
              <div className="text-center py-10 px-5 text-neutral-500">
                <div className="text-4xl mb-3">👆</div>
                <div className="text-[13px]">Selecciona una persona para ver su QR</div>
              </div>
            ) : (
              <div className="text-center" ref={printRef}>
                <div className="text-[11px] text-neutral-500 mb-1 uppercase tracking-wide">U.E. Naciones Unidas — El Torno</div>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR" className="w-[220px] h-[220px] rounded-lg mx-auto"/>
                ) : (
                  <div className="w-[220px] h-[220px] bg-neutral-100 rounded-lg flex items-center justify-center mx-auto text-neutral-500 text-[13px]">
                    Sin código generado
                  </div>
                )}
                <div className="text-base font-bold text-brand-700 mt-3">{selected.lastName} {selected.firstName}</div>
                <div className="text-xs text-neutral-500 mb-2">{selected.type === 'STAFF' ? selected.staffRole : 'MAESTRO'}</div>
                {selected.attendanceCode && (
                  <div className="text-[22px] font-extrabold tracking-[4px] text-[#0F172A] font-mono mb-4">{selected.attendanceCode}</div>
                )}
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => handleRegenerate(selected)} className="flex-1 justify-center">
                    <RefreshCw size={13}/> Regenerar
                  </Button>
                  {selected.attendanceCode && (
                    <Button onClick={handlePrint} className="flex-1 justify-center">
                      <Download size={13}/> Imprimir
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
