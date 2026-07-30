'use client'
import { useEffect, useState } from 'react'
import ParentView from './_ParentView'
import JuntaView from './_JuntaView'
import DelegateView from './_DelegateView'
import TesoreriaEnConstruccion from './_EnConstruccion'

export default function TesoreriaPage() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) setRole(JSON.parse(raw).role)
  }, [])

  if (!role) return null
  if (role === 'JUNTA_ESCOLAR') return <JuntaView/>
  // No existe (todavía) un concepto de tesorería a nivel de núcleo/distrito —
  // JuntaView está pensada para un solo colegio, no tiene sentido reusarla acá.
  if (role === 'JUNTA_NUCLEO' || role === 'JUNTA_DISTRITO') return <TesoreriaEnConstruccion/>
  if (role === 'DELEGATE') return <DelegateView/>
  return <ParentView/>
}
