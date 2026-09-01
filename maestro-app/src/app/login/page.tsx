'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap } from 'lucide-react'
import Button from '@/components/Button'
import { login, getToken } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (getToken()) router.replace('/')
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Completá los dos campos'); return }
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (!result.ok) { setError(result.message); return }
    router.replace('/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="w-16 h-16 rounded-2xl bg-brand-700 flex items-center justify-center">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-brand-700">EduLink Maestro</h1>
          <p className="text-sm text-text-secondary text-center">Asistencia y notificaciones desde tu celular</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-brand-700">Correo institucional</label>
            <input
              type="email" autoComplete="username" inputMode="email"
              value={email} onChange={e => setEmail(e.target.value)}
              className="h-12 px-3.5 rounded-xl border border-border bg-white text-[15px] outline-none focus:border-brand-600"
              placeholder="tu.correo@colegio.edu.bo"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-brand-700">Contraseña</label>
            <input
              type="password" autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              className="h-12 px-3.5 rounded-xl border border-border bg-white text-[15px] outline-none focus:border-brand-600"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-[13px] text-danger-600 bg-danger-100 rounded-lg px-3 py-2.5">{error}</p>}

          <Button type="submit" loading={loading} className="mt-2">Ingresar</Button>
        </form>
      </div>
    </div>
  )
}
