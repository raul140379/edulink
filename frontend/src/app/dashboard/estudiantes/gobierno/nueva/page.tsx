'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const CARGO_LABELS: Record<string, string> = {
  PRESIDENTE: 'Presidente', VICEPRESIDENTE: 'Vicepresidente',
  SECRETARIA: 'Secretaria', TESORERO: 'Tesorero', VOCAL: 'Vocal',
}

const generatePassword = (lastName: string): string => {
  const year  = new Date().getFullYear()
  const last4 = (lastName || 'gob').replace(/\s+/g, '').slice(0, 4).toLowerCase()
  return `gobierno${last4}${year}`
}

const emptyForm = {
  role: 'GOBIERNO_NUCLEO' as 'GOBIERNO_NUCLEO' | 'STUDENT_GOV',
  nucleoId: '', schoolId: '',
  firstName: '', lastName: '', ci: '', phone: '',
  cargo: 'PRESIDENTE', academicYear: new Date().getFullYear(),
  email: '', password: '',
}

// Solo lo usa GOBIERNO_DISTRITO — designa al Gobierno Estudiantil de Núcleo o al de
// cada colegio de su distrito. Pega a POST /api/gobierno, que crea el User y el
// GobiernoMember (con su cargo) en una sola transacción.
export default function NuevoGobiernoPage() {
  const router = useRouter()
  const toast  = useToast()
  const [form, setForm] = useState(emptyForm)
  const [nucleos, setNucleos] = useState<{ id: number; name: string }[]>([])
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([])
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')
  const [generatingEmail, setGeneratingEmail] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` }
    fetch(`${API_URL}/api/nucleos`, { headers }).then(r => r.ok ? r.json() : []).then(setNucleos).catch(() => {})
    fetch(`${API_URL}/api/schools`, { headers }).then(r => r.ok ? r.json() : []).then(setSchools).catch(() => {})
  }, [])

  const handleGenerateEmail = async () => {
    if (!form.firstName || !form.lastName) { setError('Escribe el nombre y apellido primero'); return }
    setGeneratingEmail(true)
    try {
      const res  = await fetch(`${API_URL}/api/users/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'No se pudo generar el correo'); return }
      setForm(f => ({ ...f, email: data.email })); setError('')
    } catch { setError('Error de conexión') }
    finally  { setGeneratingEmail(false) }
  }

  const handleSubmit = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      setError('Completa correo, contraseña, nombre y apellido'); return
    }
    if (form.role === 'GOBIERNO_NUCLEO' && !form.nucleoId) { setError('Selecciona el núcleo'); return }
    if (form.role === 'STUDENT_GOV' && !form.schoolId) { setError('Selecciona el colegio'); return }

    setError(''); setSaving(true)
    try {
      const body = {
        ...form,
        nucleoId: form.role === 'GOBIERNO_NUCLEO' ? parseInt(form.nucleoId) : undefined,
        schoolId: form.role === 'STUDENT_GOV' ? parseInt(form.schoolId) : undefined,
      }
      const res  = await fetch(`${API_URL}/api/gobierno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al crear'); return }
      toast('Miembro de gobierno estudiantil creado correctamente', 'success')
      router.push('/dashboard/estudiantes')
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-brand-700 mb-1">Designar Gobierno Estudiantil de Núcleo / Colegio</h1>
      <p className="text-[13px] text-neutral-500 mb-6">Crea la cuenta y el cargo de un nuevo miembro del gobierno estudiantil en tu distrito</p>

      <Card>
        <div className="flex flex-col gap-3.5">
          {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{error}</p>}

          <Select label="Nivel" required value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })}>
            <option value="GOBIERNO_NUCLEO">Gobierno Estudiantil de Núcleo</option>
            <option value="STUDENT_GOV">Gobierno Estudiantil (colegio)</option>
          </Select>

          {form.role === 'GOBIERNO_NUCLEO' ? (
            <Select label="Núcleo" required value={form.nucleoId} onChange={e => setForm({ ...form, nucleoId: e.target.value })}>
              <option value="">Selecciona un núcleo</option>
              {nucleos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </Select>
          ) : (
            <Select label="Colegio" required value={form.schoolId} onChange={e => setForm({ ...form, schoolId: e.target.value })}>
              <option value="">Selecciona un colegio</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Apellidos" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CI" value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} />
            <Input label="Teléfono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Select label="Cargo" required value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })}>
            {Object.entries(CARGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>

          <div>
            <Input label="Correo electrónico" required type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} />
            <button
              type="button" onClick={handleGenerateEmail} disabled={generatingEmail}
              className="flex items-center gap-1.5 border border-dashed border-neutral-300 text-info-500 rounded-md px-2.5 py-1.5 text-[11px] w-fit mt-1.5 hover:bg-neutral-100 hover:border-info-500"
            >
              <RefreshCw size={12} /> {generatingEmail ? 'Generando...' : 'Generar correo automático'}
            </button>
          </div>
          <div>
            <Input label="Contraseña" required type="password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} />
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, password: generatePassword(f.lastName) }))}
              className="flex items-center gap-1.5 border border-dashed border-neutral-300 text-info-500 rounded-md px-2.5 py-1.5 text-[11px] w-fit mt-1.5 hover:bg-neutral-100 hover:border-info-500"
            >
              <RefreshCw size={12} /> Generar contraseña automática
            </button>
          </div>

          <Button onClick={handleSubmit} loading={saving} className="justify-center">Crear miembro de gobierno estudiantil</Button>
        </div>
      </Card>
    </div>
  )
}
