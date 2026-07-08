'use client'
import { useEffect, useState } from 'react'
import { PerfilPage } from '@/components/PerfilPage'
import ParentPerfil from '../_ParentPerfil'

export default function Perfil() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  if (role === 'JUNTA_ESCOLAR') return <PerfilPage rolLabel="Junta Escolar" roleColor="#006D75" />
  if (role === 'DELEGATE') return <PerfilPage rolLabel="Delegado de Curso" roleColor="#00838F" />
  return <ParentPerfil/>
}
