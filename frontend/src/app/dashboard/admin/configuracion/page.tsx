'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Image as ImageIcon, Layers, School, CheckCircle2, ArrowRight, Upload } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'
import { useConfirm } from '@/components/ui/ConfirmProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

type Step = 'datos' | 'logo' | 'nucleos' | 'colegios' | 'cierre'

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'datos',    label: 'Datos del distrito', icon: <Building2 size={15}/> },
  { id: 'logo',     label: 'Logo',               icon: <ImageIcon size={15}/> },
  { id: 'nucleos',  label: 'Núcleos',            icon: <Layers size={15}/> },
  { id: 'colegios', label: 'Colegios',           icon: <School size={15}/> },
  { id: 'cierre',   label: 'Cierre',             icon: <CheckCircle2 size={15}/> },
]

const MAX_LOGO_BYTES = 300 * 1024

interface District {
  id:          number
  name:        string
  location:    string | null
  logoUrl:     string | null
  emailDomain: string | null
}

interface Nucleo {
  id:       number
  name:     string
  location: string | null
}

export default function ConfiguracionPage() {
  const toast   = useToast()
  const confirm = useConfirm()

  const [step, setStep] = useState<Step>('datos')
  const [district, setDistrict] = useState<District | null>(null)
  const [loading, setLoading] = useState(true)

  const [form,   setForm]   = useState({ name: '', location: '', emailDomain: '' })
  const [saving, setSaving] = useState(false)

  const [logoFile,    setLogoFile]    = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [nucleos,       setNucleos]       = useState<Nucleo[]>([])
  const [loadingNucleos, setLoadingNucleos] = useState(false)
  const [nucleoForm,    setNucleoForm]    = useState({ name: '', location: '' })
  const [savingNucleo,  setSavingNucleo]  = useState(false)
  const [editingNucleoId, setEditingNucleoId] = useState<number | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const auth  = () => ({ Authorization: `Bearer ${token}` })

  const fetchDistrict = async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/district/me`, { headers: auth() })
      const data = await res.json()
      if (res.ok) {
        setDistrict(data)
        setForm({ name: data.name || '', location: data.location || '', emailDomain: data.emailDomain || '' })
      }
    } catch { toast('Error al cargar los datos del distrito', 'error') }
    finally  { setLoading(false) }
  }

  const fetchNucleos = async () => {
    setLoadingNucleos(true)
    try {
      const res  = await fetch(`${API_URL}/api/nucleos`, { headers: auth() })
      const data = await res.json()
      if (res.ok) setNucleos(data)
    } catch { toast('Error al cargar los núcleos', 'error') }
    finally  { setLoadingNucleos(false) }
  }

  useEffect(() => { fetchDistrict() }, [])
  useEffect(() => { if (step === 'nucleos') fetchNucleos() }, [step])

  const handleSaveDatos = async () => {
    if (!form.name.trim()) { toast('El nombre del distrito es requerido', 'error'); return }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/district`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast('Datos del distrito actualizados', 'success')
      fetchDistrict()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleLogoSelect = (file: File | null) => {
    if (!file) { setLogoFile(null); setLogoPreview(null); return }
    if (!file.type.startsWith('image/')) { toast('El archivo debe ser una imagen', 'error'); return }
    if (file.size > MAX_LOGO_BYTES) { toast(`La imagen no puede superar ${MAX_LOGO_BYTES / 1024}KB`, 'error'); return }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleUploadLogo = async () => {
    if (!logoFile) return
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', logoFile)
      const res  = await fetch(`${API_URL}/api/district/logo`, {
        method:  'POST',
        headers: auth(),
        body:    formData,
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast('Logo actualizado correctamente', 'success')
      setLogoFile(null)
      setLogoPreview(null)
      fetchDistrict()
    } catch { toast('Error de conexión', 'error') }
    finally  { setUploadingLogo(false) }
  }

  const openNucleoCreate = () => {
    setEditingNucleoId(null)
    setNucleoForm({ name: '', location: '' })
  }

  const openNucleoEdit = (n: Nucleo) => {
    setEditingNucleoId(n.id)
    setNucleoForm({ name: n.name, location: n.location || '' })
  }

  const handleSaveNucleo = async () => {
    if (!nucleoForm.name.trim()) { toast('El nombre del núcleo es requerido', 'error'); return }
    setSavingNucleo(true)
    try {
      const url    = editingNucleoId ? `${API_URL}/api/nucleos/${editingNucleoId}` : `${API_URL}/api/nucleos`
      const method = editingNucleoId ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...auth() },
        body:    JSON.stringify(nucleoForm),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast(editingNucleoId ? 'Núcleo actualizado' : 'Núcleo creado correctamente', 'success')
      setNucleoForm({ name: '', location: '' })
      setEditingNucleoId(null)
      fetchNucleos()
    } catch { toast('Error de conexión', 'error') }
    finally  { setSavingNucleo(false) }
  }

  const cancelNucleoEdit = async () => {
    if (nucleoForm.name && !await confirm('¿Descartar los cambios de este núcleo?')) return
    setEditingNucleoId(null)
    setNucleoForm({ name: '', location: '' })
  }

  const stepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Configuración del Distrito</h1>
        <p className="text-[13px] text-neutral-500">
          Datos, marca y estructura de {district?.name || 'tu distrito'} — se puede editar en cualquier momento.
        </p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-colors ${
              step === s.id ? 'bg-brand-700 text-white' : i < stepIndex ? 'bg-success-100 text-success-700' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
      ) : (
        <>
          {step === 'datos' && (
            <Card className="max-w-xl flex flex-col gap-3.5">
              <Input
                label="Nombre del distrito" required
                placeholder="Distrito Educativo ..."
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              />
              <Textarea
                label="Ubicación" rows={2}
                placeholder="Ej: Municipio, Provincia, Departamento"
                hint="Aparece en el portal público y en los dashboards"
                value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
              />
              <Input
                label="Dominio de correo institucional"
                placeholder="@midistrito.edu.bo"
                hint="Usado para generar automáticamente los correos de maestros, padres y delegados"
                value={form.emailDomain} onChange={e => setForm({ ...form, emailDomain: e.target.value })}
              />
              <div className="flex justify-end pt-1">
                <Button onClick={handleSaveDatos} loading={saving}>Guardar</Button>
              </div>
            </Card>
          )}

          {step === 'logo' && (
            <Card className="max-w-xl flex flex-col gap-3.5">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center overflow-hidden shrink-0">
                  {logoPreview || district?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview || district?.logoUrl || ''} alt="Logo" className="w-full h-full object-contain"/>
                  ) : (
                    <ImageIcon size={28} className="text-neutral-500"/>
                  )}
                </div>
                <div className="flex-1">
                  <label className="text-[13px] font-semibold text-neutral-700 block mb-1.5">Escudo / logo del distrito</label>
                  <input
                    type="file" accept="image/*"
                    onChange={e => handleLogoSelect(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-neutral-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-100 file:text-brand-700 file:text-sm file:font-semibold"
                  />
                  <p className="text-xs text-neutral-500 mt-1.5">Máximo {MAX_LOGO_BYTES / 1024}KB. Se muestra en el portal público, el login y los dashboards.</p>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={handleUploadLogo} disabled={!logoFile} loading={uploadingLogo}>
                  <Upload size={14}/> Subir logo
                </Button>
              </div>
            </Card>
          )}

          {step === 'nucleos' && (
            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 320px' }}>
              <Card padded={false} className="overflow-hidden">
                <div className="px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-semibold text-brand-700">
                  Núcleos educativos ({nucleos.length})
                </div>
                {loadingNucleos ? (
                  <div className="p-8 text-center text-sm text-neutral-500">Cargando...</div>
                ) : nucleos.length === 0 ? (
                  <div className="p-8 text-center text-sm text-neutral-500">Todavía no hay núcleos registrados</div>
                ) : (
                  <div className="flex flex-col">
                    {nucleos.map(n => (
                      <button
                        key={n.id} onClick={() => openNucleoEdit(n)}
                        className={`flex items-center justify-between px-4.5 py-2.5 border-t border-neutral-100 text-left hover:bg-neutral-100/50 transition-colors ${editingNucleoId === n.id ? 'bg-brand-100' : ''}`}
                      >
                        <span className="text-[13px] font-medium text-brand-700">{n.name}</span>
                        {n.location && <span className="text-xs text-neutral-500">{n.location}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="flex flex-col gap-3">
                <div className="text-[13px] font-semibold text-brand-700">
                  {editingNucleoId ? 'Editar núcleo' : 'Nuevo núcleo'}
                </div>
                <Input
                  label="Nombre" required placeholder="Ej: 19 de Junio"
                  value={nucleoForm.name} onChange={e => setNucleoForm({ ...nucleoForm, name: e.target.value })}
                />
                <Input
                  label="Ubicación" placeholder="Ej: Limoncito"
                  value={nucleoForm.location} onChange={e => setNucleoForm({ ...nucleoForm, location: e.target.value })}
                />
                <div className="flex gap-2 justify-end">
                  {editingNucleoId && <Button variant="secondary" size="sm" onClick={cancelNucleoEdit}>Cancelar</Button>}
                  <Button size="sm" onClick={handleSaveNucleo} loading={savingNucleo}>
                    {editingNucleoId ? 'Guardar cambios' : 'Crear núcleo'}
                  </Button>
                </div>
                {!editingNucleoId && nucleoForm.name === '' && nucleos.length > 0 && (
                  <button onClick={openNucleoCreate} className="text-xs text-neutral-500 text-left hover:text-brand-700">
                    + Empezar otro núcleo nuevo
                  </button>
                )}
              </Card>
            </div>
          )}

          {step === 'colegios' && (
            <Card className="max-w-xl flex flex-col gap-3">
              <p className="text-[13px] text-neutral-700">
                Las unidades educativas del distrito se administran desde su propia pantalla — ahí puedes darlas de
                alta una por una, o importar una planilla completa (Excel) con todos los colegios del distrito de una vez.
              </p>
              <Link href="/dashboard/admin/colegios">
                <Button><School size={14}/> Ir a Unidades Educativas <ArrowRight size={14}/></Button>
              </Link>
            </Card>
          )}

          {step === 'cierre' && (
            <Card className="max-w-xl flex flex-col gap-4">
              <div className="flex items-center gap-2 text-success-700">
                <CheckCircle2 size={20}/>
                <span className="text-[15px] font-bold">Configuración lista</span>
              </div>
              <p className="text-[13px] text-neutral-700">
                Con los datos del distrito, el logo, los núcleos y las unidades educativas cargadas, el último paso
                es crear el usuario Director para cada unidad educativa — cada colegio necesita el suyo propio.
              </p>
              <Link href="/dashboard/admin/usuarios">
                <Button>Ir a Usuarios <ArrowRight size={14}/></Button>
              </Link>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
