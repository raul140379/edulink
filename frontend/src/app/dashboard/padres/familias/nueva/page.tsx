'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Check } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const RELATION_LABELS: Record<string, string> = {
  PADRE: 'Padre', MADRE: 'Madre', TUTOR_LEGAL: 'Tutor legal', OTRO: 'Otro (tercero)',
}

interface StudentHit { id: number; firstName: string; lastName: string }

const emptyForm = {
  firstName: '', lastName: '', ci: '', phone: '', email: '', address: '', kardex: '',
  relationType: 'TUTOR_LEGAL',
}

// Registro de padres/tutores — responsabilidad exclusiva de Junta Escolar
// (todo el colegio) y Delegado (solo estudiantes de su propio curso, validado
// también server-side en parent.service.ts:createParent). Solo se genera
// acceso al sistema cuando el vínculo es "Tutor legal" (isTutor=true) — es la
// condición que ahora exige la Junta/Tesorería para cualquier padre/madre/
// tercero que vaya a manejar cargos o ser parte del directorio.
export default function NuevaFamiliaPage() {
  const router = useRouter()
  const toast  = useToast()
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<StudentHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedStudents, setSelectedStudents] = useState<StudentHit[]>([])

  const [showCreds, setShowCreds] = useState(false)
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null)

  const token  = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const myUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {}
  const myRole = myUser?.role || ''

  // El Delegado solo puede registrar padres de estudiantes de SU curso — se
  // precarga esa lista fija (sin buscador) en vez de la búsqueda libre que
  // usa Junta Escolar sobre todo el colegio.
  useEffect(() => {
    if (myRole !== 'DELEGATE') return
    fetch(`${API_URL}/api/delegates/my-course`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const seen = new Map<number, StudentHit>()
        for (const a of data?.assignments || []) {
          const s = a.student
          if (s && !seen.has(s.id)) seen.set(s.id, { id: s.id, firstName: s.firstName, lastName: s.lastName })
        }
        setStudentResults(Array.from(seen.values()))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearchStudents = async () => {
    if (myRole === 'DELEGATE') return // la lista ya está precargada
    if (!studentSearch.trim()) return
    setSearching(true)
    try {
      const res  = await fetch(`${API_URL}/api/students?search=${encodeURIComponent(studentSearch)}&isActive=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setStudentResults(res.ok ? data : [])
    } catch { setStudentResults([]) }
    finally { setSearching(false) }
  }

  const toggleStudent = (s: StudentHit) => {
    setSelectedStudents(prev =>
      prev.some(x => x.id === s.id) ? prev.filter(x => x.id !== s.id) : [...prev, s]
    )
  }

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName) { setError('Nombre y apellido son requeridos'); return }
    if (selectedStudents.length === 0) { setError('Selecciona al menos un estudiante'); return }

    setError(''); setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/parents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          ci: form.ci || undefined, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined,
          kardex: form.kardex || undefined,
          studentIds: selectedStudents.map(s => s.id),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Error al registrar'); return }
      toast('Padre/tutor registrado correctamente', 'success')
      if (data.accessEmail) {
        setCreds({ email: data.accessEmail, password: data.defaultPassword })
        setShowCreds(true)
      } else {
        router.push('/dashboard/padres/familias')
      }
    } catch { setError('Error de conexión') }
    finally  { setSaving(false) }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-brand-700 mb-1">Registrar Padre</h1>
      <p className="text-[13px] text-neutral-500 mb-6">
        {myRole === 'DELEGATE'
          ? 'Solo podés registrar padres de estudiantes de tu propio curso'
          : 'Registra un nuevo padre, madre o tutor de un estudiante del colegio'}
      </p>

      <Card>
        <div className="flex flex-col gap-3.5">
          {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            <Input label="Apellidos" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CI" value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} />
            <Input label="Teléfono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input label="Correo (opcional, para acceso propio)" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input
            label="N° Kardex (opcional)" placeholder="Si se deja vacío, se asigna automáticamente al generar su QR"
            value={form.kardex} onChange={e => setForm({ ...form, kardex: e.target.value })}
          />

          <Select label="Relación con el/los estudiante(s)" required value={form.relationType} onChange={e => setForm({ ...form, relationType: e.target.value })}>
            {Object.entries(RELATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          {form.relationType === 'TUTOR_LEGAL' && (
            <p className="text-[12px] text-info-500 bg-info-500/10 rounded-lg px-3 py-2">
              Como Tutor legal, se le genera automáticamente una cuenta de acceso al sistema.
            </p>
          )}

          <div>
            <div className="text-[13px] font-semibold text-brand-700 mb-1.5">Estudiante(s)</div>
            {myRole !== 'DELEGATE' && (
              <div className="flex gap-2 mb-2">
                <Input
                  label="" value={studentSearch} placeholder="Buscar estudiante por nombre"
                  onChange={e => setStudentSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearchStudents() } }}
                />
                <Button variant="secondary" onClick={handleSearchStudents} loading={searching}><Search size={14}/></Button>
              </div>
            )}
            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
              {studentResults.map(s => {
                const checked = selectedStudents.some(x => x.id === s.id)
                return (
                  <label key={s.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-[13px] ${checked ? 'bg-success-100' : 'bg-neutral-100/60 hover:bg-neutral-100'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleStudent(s)} className="accent-brand-700" />
                    <span className="font-medium text-brand-700">{s.lastName} {s.firstName}</span>
                  </label>
                )
              })}
              {studentResults.length === 0 && (
                <p className="text-[12px] text-neutral-500 italic">
                  {myRole === 'DELEGATE' ? 'Cargando estudiantes de tu curso...' : 'Buscá un estudiante para vincularlo'}
                </p>
              )}
            </div>
          </div>

          <Button onClick={handleSubmit} loading={saving} className="justify-center">Registrar</Button>
        </div>
      </Card>

      <Modal
        open={showCreds} onClose={() => { setShowCreds(false); router.push('/dashboard/padres/familias') }}
        title="✅ Padre registrado"
        footer={<Button onClick={() => { setShowCreds(false); router.push('/dashboard/padres/familias') }}>Entendido</Button>}
      >
        {creds && (
          <div className="flex flex-col gap-2.5">
            <p className="text-[12px] text-success-700 bg-success-100 rounded-lg px-3 py-2.5">
              <Check size={13} className="inline mr-1"/> Se generó una cuenta de acceso. Anota estas credenciales.
            </p>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Email:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono break-all">{creds.email}</span>
            </div>
            <div className="flex items-center gap-2.5 bg-neutral-100 border border-neutral-300 rounded-lg px-3.5 py-2.5">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">Contraseña:</span>
              <span className="text-sm font-semibold text-brand-700 font-mono break-all">{creds.password}</span>
            </div>
            <p className="text-[12px] text-[#8A6116] bg-warning-100 rounded-lg px-3 py-2.5">⚠️ Esta es la única vez que verás la contraseña.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
