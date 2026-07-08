'use client'
import { useEffect, useState } from 'react'
import { PerfilPage } from '@/components/PerfilPage'

export default function Perfil() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  return role === 'TEACHER_TUTOR'
    ? <PerfilPage rolLabel="Maestro Tutor" roleColor="#0F6E56" />
    : <PerfilPage rolLabel="Maestro Docente" roleColor="#1A3A7C" />
}
