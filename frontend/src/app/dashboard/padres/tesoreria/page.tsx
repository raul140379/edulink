'use client'
import { useEffect, useState } from 'react'
import ParentView from './_ParentView'
import JuntaView from './_JuntaView'
import DelegateView from './_DelegateView'

export default function TesoreriaPage() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  if (role === 'JUNTA_ESCOLAR') return <JuntaView/>
  if (role === 'DELEGATE') return <DelegateView/>
  return <ParentView/>
}
