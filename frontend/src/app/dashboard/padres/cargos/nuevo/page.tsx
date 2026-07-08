'use client'
import { useEffect, useState } from 'react'
import JuntaView from './_JuntaView'
import DelegateView from './_DelegateView'

export default function NuevoCargoPage() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  return role === 'DELEGATE' ? <DelegateView/> : <JuntaView/>
}
