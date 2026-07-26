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
  // Junta de Núcleo/Distrito reusa la misma vista — el backend ya filtra los
  // cobros a su alcance (núcleo/distrito) vía el motor de tenant-scoping.
  if (role === 'JUNTA_ESCOLAR' || role === 'JUNTA_NUCLEO' || role === 'JUNTA_DISTRITO') return <JuntaView/>
  if (role === 'DELEGATE') return <DelegateView/>
  return <ParentView/>
}
