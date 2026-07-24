'use client'

import { useState } from 'react'
import { KeyRound, Eye, EyeOff, Check, UserCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface PerfilPageProps {
  rolLabel:  string
  roleColor: string
}

export function PerfilPage({ rolLabel, roleColor }: PerfilPageProps) {
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent,     setShowCurrent]     = useState(false)
  const [showNew,         setShowNew]         = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)
  const [saving,          setSaving]          = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const user  = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('user') || '{}')
    : {}

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast('Todos los campos son requeridos', 'error'); return
    }
    if (newPassword.length < 6) {
      toast('La nueva contraseña debe tener al menos 6 caracteres', 'error'); return
    }
    if (newPassword !== confirmPassword) {
      toast('Las contraseñas no coinciden', 'error'); return
    }
    setSaving(true)
    try {
      const res  = await fetch(`${API_URL}/api/auth/change-password`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message, 'error'); return }
      toast('Contraseña actualizada correctamente', 'success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch { toast('Error de conexión', 'error') }
    finally  { setSaving(false) }
  }

  return (
    <div className="max-w-[500px]">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-brand-700 mb-1">Mi Perfil</h1>
        <p className="text-[13px] text-neutral-500">Gestiona tu información de acceso</p>
      </div>

      <Card className="flex items-center gap-3.5 mb-5">
        <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0" style={{ background: `${roleColor}20` }}>
          <UserCircle size={40} style={{ color: roleColor }}/>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-semibold text-brand-700">{user.email}</div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full w-fit" style={{ background: `${roleColor}20`, color: roleColor }}>
            {rolLabel}
          </span>
        </div>
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-neutral-100 text-[13px] font-bold" style={{ color: roleColor }}>
          <KeyRound size={16}/> Cambiar contraseña
        </div>
        <div className="p-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Contraseña actual *</label>
            <div className="relative flex items-center">
              <input
                type={showCurrent ? 'text' : 'password'} placeholder="Ingresa tu contraseña actual"
                value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none focus:border-info-500 focus:ring-2 focus:ring-info-500/15"
              />
              <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2.5 text-neutral-500 hover:text-brand-700">
                {showCurrent ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Nueva contraseña *</label>
            <div className="relative flex items-center">
              <input
                type={showNew ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none focus:border-info-500 focus:ring-2 focus:ring-info-500/15"
              />
              <button onClick={() => setShowNew(!showNew)} className="absolute right-2.5 text-neutral-500 hover:text-brand-700">
                {showNew ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-brand-700 uppercase tracking-wide">Confirmar nueva contraseña *</label>
            <div className="relative flex items-center">
              <input
                type={showConfirm ? 'text' : 'password'} placeholder="Repite la nueva contraseña"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 border border-neutral-300 rounded-lg text-[13px] text-brand-700 outline-none focus:border-info-500 focus:ring-2 focus:ring-info-500/15"
              />
              <button onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2.5 text-neutral-500 hover:text-brand-700">
                {showConfirm ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <span className="text-[11px] text-danger-600">Las contraseñas no coinciden</span>
            )}
            {newPassword && confirmPassword && newPassword === confirmPassword && (
              <span className="text-[11px] text-success-700 flex items-center gap-1"><Check size={12}/> Contraseñas coinciden</span>
            )}
          </div>
          <button
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            className="flex items-center justify-center gap-1.5 px-4.5 py-2.5 text-white rounded-lg text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            style={{ background: roleColor }}
          >
            {saving ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/> : <KeyRound size={14}/>}
            {saving ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </div>
      </Card>
    </div>
  )
}
