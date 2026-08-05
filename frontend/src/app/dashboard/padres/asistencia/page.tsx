'use client'
import { useEffect, useState } from 'react'
import DelegateView from './_DelegateView'
import JuntaView from './_JuntaView'

export default function AsistenciaPage() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  return role === 'JUNTA_ESCOLAR' ? <JuntaView/> : <DelegateView/>
}
