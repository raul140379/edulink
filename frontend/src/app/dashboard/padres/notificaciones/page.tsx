'use client'
import { useEffect, useState } from 'react'
import ParentView from './_ParentView'
import JuntaView from './_JuntaView'

export default function NotificacionesPage() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  return role === 'JUNTA_ESCOLAR' ? <JuntaView/> : <ParentView/>
}
