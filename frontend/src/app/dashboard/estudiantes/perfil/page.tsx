'use client'

import { useEffect, useState } from 'react'
import { UserCircle, Lock, Save, Eye, EyeOff } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface StudentProfile {
  id:           number
  firstName:    string
  lastName:     string
  ci:           string | null
  rude:         string | null
  kardex:       string | null
  birthDate:    string | null
  gender:       string | null
  phone:        string | null
  email:        string | null
  address:      string | null
  course:       { grade: string; parallel: string; level: string; shift: string } | null
  academicYear: { year: number } | null
  tutor:        { firstName: string; lastName: string; phone: string | null } | null
}

const GENDER_LABEL: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMENINO:  'Femenino',
}

const SHIFT_LABEL: Record<string, string> = {
  MORNING:   'Mañana',
  AFTERNOON: 'Tarde',
  NIGHT:     'Noche',
}

const GRADE_LABEL: Record<string, string> = {
  PRIMERO:  '1°',
  SEGUNDO:  '2°',
  TERCERO:  '3°',
  CUARTO:   '4°',
  QUINTO:   '5°',
  SEXTO:    '6°',
}

export default function PerfilPage() {
  const toast = useToast()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'info' | 'password'>('info')

  const [currentPwd,  setCurrentPwd]  = useState('')
  const [newPwd,      setNewPwd]      = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwdLoading,  setPwdLoading]  = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API_URL}/api/students/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setProfile(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) {
      toast('Completa todos los campos', 'error'); return
    }
    if (newPwd.length < 6) {
      toast('La nueva contraseña debe tener al menos 6 caracteres', 'error'); return
    }
    if (newPwd !== confirmPwd) {
      toast('Las contraseñas no coinciden', 'error'); return
    }

    setPwdLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method:  'POST',
        headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.message || 'Error al cambiar contraseña', 'error'); return }
      toast('Contraseña actualizada correctamente', 'success')
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch {
      toast('Error de conexión', 'error')
    } finally {
      setPwdLoading(false)
    }
  }

  const formatDate = (d?: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-BO', { day:'2-digit', month:'long', year:'numeric' })
  }

  if (loading) return <div className="flex justify-center py-16"><p className="text-sm text-neutral-500">Cargando...</p></div>

  if (!profile) return <div className="text-center py-12 text-neutral-500">No se pudo cargar el perfil.</div>

  return (
    <div className="max-w-[700px]">
      {/* Header */}
      <div
        className="rounded-xl px-6 py-5 mb-6 text-white flex items-center gap-4"
        style={{ background: 'linear-gradient(90deg, #3B5BDB, #5B7CF0)' }}
      >
        <div className="w-[60px] h-[60px] rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <UserCircle size={36} className="text-white"/>
        </div>
        <div>
          <div className="text-[12px] uppercase tracking-wide text-white/70 mb-0.5">Tu perfil 🙌</div>
          <div className="text-xl font-extrabold">{profile.firstName} {profile.lastName}</div>
          {profile.course && (
            <div className="text-[13px] text-white/80 mt-1">
              {GRADE_LABEL[profile.course.grade] || profile.course.grade} {profile.course.parallel} ·{' '}
              {profile.course.level} · Turno {SHIFT_LABEL[profile.course.shift] || profile.course.shift}
              {profile.academicYear ? ` · Gestión ${profile.academicYear.year}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        {[
          { key: 'info',     label: 'Mis Datos',          icon: <UserCircle size={15}/> },
          { key: 'password', label: 'Cambiar Contraseña', icon: <Lock size={15}/> },
        ].map(t => (
          <button
            key={t.key} onClick={() => setTab(t.key as 'info' | 'password')}
            className={`flex items-center gap-1.5 px-4.5 py-2.5 rounded-lg text-[13px] shadow-sm transition-colors ${tab === t.key ? 'bg-brand-700 text-white font-semibold' : 'bg-white text-neutral-500 hover:bg-neutral-100'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Mis Datos */}
      {tab === 'info' && (
        <Card padded={false} className="overflow-hidden">
          <div className="px-4.5 py-3.5 border-b border-neutral-100">
            <span className="font-bold text-sm text-brand-700">Información Personal</span>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-5">
              {[
                { label:'Nombres',          value: profile.firstName },
                { label:'Apellidos',        value: profile.lastName },
                { label:'CI',               value: profile.ci        || '—' },
                { label:'RUDE',             value: profile.rude      || '—' },
                { label:'N° Kardex',        value: profile.kardex    || '—' },
                { label:'Fecha Nacimiento', value: formatDate(profile.birthDate) },
                { label:'Género',           value: GENDER_LABEL[profile.gender ?? ''] || '—' },
                { label:'Teléfono',         value: profile.phone     || '—' },
                { label:'Correo',           value: profile.email     || '—' },
                { label:'Dirección',        value: profile.address   || '—' },
              ].map(f => (
                <div key={f.label}>
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">{f.label}</div>
                  <div className="text-sm text-brand-700 font-medium">{f.value}</div>
                </div>
              ))}
            </div>

            {profile.tutor && (
              <>
                <div className="border-t border-neutral-100 my-6"/>
                <div className="text-[13px] font-bold text-brand-700 mb-4">Tutor Legal</div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Nombre Completo</div>
                    <div className="text-sm text-brand-700 font-medium">{profile.tutor.firstName} {profile.tutor.lastName}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">Teléfono</div>
                    <div className="text-sm text-brand-700 font-medium">{profile.tutor.phone || '—'}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Tab: Cambiar Contraseña */}
      {tab === 'password' && (
        <Card padded={false} className="overflow-hidden">
          <div className="px-4.5 py-3.5 border-b border-neutral-100">
            <span className="font-bold text-sm text-brand-700">Cambiar Contraseña</span>
          </div>
          <div className="p-6">
            <div className="flex flex-col gap-4.5 max-w-[400px]">
              {[
                { label:'Contraseña actual',          value: currentPwd, set: setCurrentPwd, show: showCurrent, toggle: () => setShowCurrent(!showCurrent) },
                { label:'Nueva contraseña',           value: newPwd,     set: setNewPwd,     show: showNew,     toggle: () => setShowNew(!showNew) },
                { label:'Confirmar nueva contraseña', value: confirmPwd, set: setConfirmPwd, show: showConfirm, toggle: () => setShowConfirm(!showConfirm) },
              ].map(f => (
                <div key={f.label} className="relative">
                  <Input
                    label={f.label}
                    type={f.show ? 'text' : 'password'}
                    value={f.value}
                    onChange={e => f.set(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    onClick={f.toggle}
                    className="absolute right-3 top-[34px] text-neutral-500 hover:text-neutral-700"
                  >
                    {f.show ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              ))}

              <Button onClick={handleChangePassword} loading={pwdLoading} className="mt-1">
                {!pwdLoading && <Save size={16}/>}
                {pwdLoading ? 'Guardando...' : 'Actualizar Contraseña'}
              </Button>
            </div>

            <div className="mt-5 px-4 py-3 bg-neutral-100 rounded-lg text-xs text-neutral-500">
              💡 La contraseña debe tener al menos 6 caracteres.
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
