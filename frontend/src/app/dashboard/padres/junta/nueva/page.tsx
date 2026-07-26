'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const CARGO_LABELS: Record<string, string> = {
  PRESIDENTE: 'Presidente', VICEPRESIDENTE: 'Vicepresidente',
  SECRETARIA: 'Secretaria', TESORERO: 'Tesorero', VOCAL: 'Vocal',
}

const emptyForm = {
  role: 'JUNTA_NUCLEO' as 'JUNTA_NUCLEO' | 'JUNTA_ESCOLAR',
  nucleoId: '', schoolId: '',
  firstName: '', lastName: '', ci: '', phone: '',
  cargo: 'PRESIDENTE', academicYear: new Date().getFullYear(),
  email: '', password: '',
}

// Solo lo usa JUNTA_DISTRITO — designa a la Junta de Núcleo o a la Junta Escolar de
// cada colegio de su distrito. Pega a POST /api/junta, que crea el User y el
// JuntaMember (con su cargo) en una sola transacción.
export default function NuevaJuntaPage() {
  const router = useRouter()
  const toast  = useToast()
  const [form, setForm] = useState(emptyForm)
  const [nucleos, setNucleos] = useState<{ id: number; name: string }[]>([])
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([])
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` }
    fetch(`${API_URL}/api/nucleos`, { headers }).then(r => r.ok ? r.json() : []).then(setNucleos).catch(() => {})
    fetch(`${API_URL}/api/schools`, { headers }).then(r => r.ok ? r.json() : []).then(setSchools).catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      setError('Completa correo, contraseña, nombre y apellido'); return
    }
    if (form.role === 'JUNTA_NUCLEO' && !form.nucleoId) { setError('Selecciona el núcleo'); return }
    if (form.role === 'JUNTA_ESCOLAR' && !form.schoolId) { setError('Selecciona el colegio'); return }

    setError(''); setSaving(true)
    try {
      const body = {
        ...form,
        nucleoId: form.role === 'JUNTA_NUCLEO' ? parseInt(form.nucleoId) : undefined,
        schoolId: form.role === 'JUNTA_ESCOLAR' ? parseInt(form.schoolId) : undefined,
      }
      const res  = await fetch(`${API_URL}/api/junta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al crear'); return }
      toast('Miembro de junta creado correctamente', 'success')
      router.push('/dashboard/padres')
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-brand-700 mb-1">Designar Junta de Núcleo / Escolar</h1>
      <p className="text-[13px] text-neutral-500 mb-6">Crea la cuenta y el cargo de un nuevo miembro de junta en tu distrito</p>

      <Card>
        <div className="flex flex-col gap-3.5">
          {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{error}</p>}

          <Select label="Nivel" required value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })}>
            <option value="JUNTA_NUCLEO">Junta de Núcleo</option>
            <option value="JUNTA_ESCOLAR">Junta Escolar (colegio)</option>
          </Select>

          {form.role === 'JUNTA_NUCLEO' ? (
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

          <Input label="Correo electrónico" required type="email" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input label="Contraseña" required type="password" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} />

          <Button onClick={handleSubmit} loading={saving} className="justify-center">Crear miembro de junta</Button>
        </div>
      </Card>
    </div>
  )
}
