'use client'

import { useEffect, useState } from 'react'
import { User, Phone, Mail, CreditCard, Lock, Save, Eye, EyeOff } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ParentData {
  id:        number
  firstName: string
  lastName:  string
  ci?:       string
  phone?:    string
  email?:    string
  address?:  string
  user?:     { email: string; isActive: boolean }
}

export default function ParentPerfilPage() {
  const toast = useToast()
  const [parent,   setParent]   = useState<ParentData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState({ phone: '', email: '', address: '' })
  const [pwForm,   setPwForm]   = useState({ current: '', newPw: '', confirm: '' })
  const [showCurr, setShowCurr] = useState(false)
  const [showNew,  setShowNew]  = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token')
      if (!token) { setLoading(false); return }
      setLoading(true)
      try {
        const res  = await fetch(`${API_URL}/api/parents/me`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        if (res.ok) {
          setParent(data)
          setForm({
            phone:   data.phone   || '',
            email:   '',
            address: data.address || '',
          })
        }
      } catch { toast('Error de conexión', 'error') }
      finally  { setLoading(false) }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    const token = localStorage.getItem('token')
    if (!token || !parent) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/parents/me`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ phone: form.phone, email: form.email || null, address: form.address }),
      })
      const data = await res.json()
      if (res.ok) {
        toast('Datos actualizados correctamente', 'success')
        setParent(data.parent)
        setForm(prev => ({ ...prev, email: form.email }))
      }
      else toast(data.message, 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!pwForm.current)         { toast('Ingresa tu contraseña actual', 'error'); return }
    if (!pwForm.newPw)           { toast('Ingresa la nueva contraseña', 'error'); return }
    if (pwForm.newPw.length < 6) { toast('Mínimo 6 caracteres', 'error'); return }
    if (pwForm.newPw !== pwForm.confirm) { toast('Las contraseñas no coinciden', 'error'); return }
    const token = localStorage.getItem('token')
    if (!token) return
    setSavingPw(true)
    try {
      const res  = await fetch(`${API_URL}/api/auth/change-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }),
      })
      const data = await res.json()
      if (res.ok) { toast('Contraseña cambiada correctamente', 'success'); setPwForm({ current: '', newPw: '', confirm: '' }) }
      else toast(data.message, 'error')
    } catch { toast('Error de conexión', 'error') }
    finally  { setSavingPw(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>
  if (!parent) return null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Mi Perfil</h1>
        <p className="text-[13px] text-neutral-500">Información personal y seguridad</p>
      </div>

      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Datos personales */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-semibold text-brand-700">
            <User size={15}/> Datos personales
          </div>
          <div className="p-5 flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide"><CreditCard size={13}/> Nombre completo</div>
              <div className="text-sm font-medium text-brand-700">{parent.lastName} {parent.firstName}</div>
            </div>
            {parent.ci && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide"><CreditCard size={13}/> Cédula de identidad</div>
                <div className="text-sm font-medium text-brand-700">{parent.ci}</div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide"><Mail size={13}/> Email del sistema</div>
              <div className="text-[13px] text-neutral-500 font-mono bg-neutral-100 px-2.5 py-1.5 rounded-md border border-neutral-300">{parent.user?.email || '—'}</div>
            </div>

            <div className="border-t border-dashed border-neutral-300 my-0.5"/>
            <div className="text-[11px] font-bold text-brand-700 uppercase tracking-wide">Datos actualizables</div>

            <Input
              label="Teléfono" placeholder="Ej: 70012345"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Email personal" type="email" placeholder="Ej: mi.correo@gmail.com" hint="Correo personal diferente al del sistema"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label="Dirección" placeholder="Ej: Barrio Las Palmas..."
              value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
            />

            <Button onClick={handleSave} loading={saving} className="justify-center">
              {!saving && <Save size={14}/>}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </Card>

        {/* Cambiar contraseña */}
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center gap-2 px-4.5 py-3.5 border-b border-neutral-100 text-[13px] font-semibold text-brand-700">
            <Lock size={15}/> Cambiar contraseña
          </div>
          <div className="p-5 flex flex-col gap-3.5">
            <div className="relative">
              <Input
                label="Contraseña actual" required type={showCurr ? 'text' : 'password'} placeholder="Tu contraseña actual"
                value={pwForm.current} onChange={e => setPwForm({ ...pwForm, current: e.target.value })} className="pr-10"
              />
              <button onClick={() => setShowCurr(!showCurr)} className="absolute right-3 top-[34px] text-neutral-500 hover:text-brand-700">
                {showCurr ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
            <div className="relative">
              <Input
                label="Nueva contraseña" required type={showNew ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                value={pwForm.newPw} onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} className="pr-10"
              />
              <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-[34px] text-neutral-500 hover:text-brand-700">
                {showNew ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
            <div>
              <Input
                label="Confirmar nueva contraseña" required type="password" placeholder="Repite la nueva contraseña"
                value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
              />
              {pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
                <span className="text-[11px] text-danger-600 mt-1 block">Las contraseñas no coinciden</span>
              )}
              {pwForm.confirm && pwForm.newPw === pwForm.confirm && pwForm.newPw && (
                <span className="text-[11px] text-success-700 mt-1 block">✓ Las contraseñas coinciden</span>
              )}
            </div>

            <div className="bg-neutral-100 border border-neutral-300 rounded-lg px-3 py-2.5 text-xs text-neutral-500 leading-relaxed">
              💡 Usa una contraseña segura con letras y números. Mínimo 6 caracteres.
            </div>

            <Button onClick={handleChangePassword} loading={savingPw} className="justify-center">
              {!savingPw && <Lock size={14}/>}
              {savingPw ? 'Cambiando...' : 'Cambiar contraseña'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
